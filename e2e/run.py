"""
Teste ponta a ponta no Chrome (headless) com rede SIMULADA:
- itunes.apple.com → respostas JSONP falsas (somente para teste)
- audio.test → um WAV de 30s
Valida: sincronização/verificação do catálogo, reprodução real (<audio>), modos,
ranking, persistência após recarregar, campeonato, exportação/importação, falhas de áudio
e ausência de erros no console.
"""
import json, re, sys, time, urllib.parse
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent.parent
DIST = (ROOT / 'dist' / 'index.html').as_uri()
TONE = (ROOT / 'e2e' / 'tone.wav').read_bytes()
SHOTS = ROOT / 'e2e' / 'shots'
SHOTS.mkdir(exist_ok=True)

ARTISTS = ['Matuê', 'Veigh', 'Teto', 'WIU', 'MC Cabelinho', 'KayBlack', 'Borges', 'Filipe Ret', 'Orochi', 'L7NNON',
           'TZ da Coronel', 'Vulgo FK', 'Derek', 'Alee', 'Yunk Vino', 'Brandão', 'Ryu, The Runner', 'MC Ryan SP', 'MC IG', 'MC Hariel']
BAD_TRACK = 100 * 1 + 3  # prévia que retorna 404


def songs_for(idx, name, apple_id=None):
    aid = apple_id or 5000 + idx
    out = []
    for n in range(12):
        tid = 100 * (idx + 1) + n
        s = dict(wrapperType='track', kind='song', trackId=tid, artistId=aid, artistName=name,
                 trackName=f'Faixa {n + 1} {name}', collectionName='Álbum', previewUrl=f'https://audio.test/{tid}.wav',
                 trackViewUrl='https://music.apple.com/', artworkUrl100='', releaseDate=f'{2018 + n % 9}-05-01T12:00:00Z',
                 primaryGenreName='Hip-Hop/Rap', trackExplicitness='notExplicit')
        if n in (10, 11): s['trackExplicitness'] = 'explicit'
        if n == 9: s['trackName'] += ' (Ao Vivo)'
        out.append(s)
    return out


def itunes_handler(route):
    url = urllib.parse.urlparse(route.request.url)
    q = urllib.parse.parse_qs(url.query)
    cb = q['callback'][0]
    results = []
    if url.path.endswith('/search'):
        term = q['term'][0]
        if term in ARTISTS:
            i = ARTISTS.index(term)
            results = songs_for(i, term)
            if term == 'Derek':  # homônimo → precisa de confirmação do professor
                results += [dict(r, artistId=9999, trackId=r['trackId'] + 50, trackName=r['trackName'] + ' B') for r in songs_for(i, term)[:4]]
        elif term == 'Matuê':
            results = songs_for(0, 'Matuê')[:1]
    elif url.path.endswith('/lookup'):
        aid = int(q['id'][0])
        i = ARTISTS.index('Derek')
        results = songs_for(i, 'Derek') if aid == 5000 + i else []
    body = f'{cb}({json.dumps({"resultCount": len(results), "results": results})});'
    route.fulfill(status=200, content_type='text/javascript', body=body)


def audio_handler(route):
    if f'/{BAD_TRACK}.wav' in route.request.url:
        route.fulfill(status=404, body='')
    else:
        route.fulfill(status=200, content_type='audio/wav', body=TONE, headers={'Accept-Ranges': 'none'})


errors = []
checks = []


def ok(msg):
    checks.append(msg)
    print('  ✓', msg, flush=True)


def answer_current(page, idx=0):
    """Clica numa alternativa habilitada; se cair na segunda chance, responde de novo."""
    for _ in range(3):
        enabled = page.locator('main button.group:not([disabled])')
        enabled.nth(min(idx, enabled.count() - 1)).click()
        try:
            page.wait_for_function('() => !document.querySelector("main button.group:not([disabled])")', timeout=2500)
            return
        except Exception:
            idx = 0  # segunda chance: continua na mesma pergunta


def play_solo_match(page, answers=10, pick='first'):
    for i in range(answers):
        page.wait_for_selector('main button.group:not([disabled])', timeout=20000)
        answer_current(page, 0 if pick == 'first' else i % 4)


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--autoplay-policy=no-user-gesture-required'])
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True)
    ctx.route('https://itunes.apple.com/**', itunes_handler)
    ctx.route('https://audio.test/**', audio_handler)
    page = ctx.new_page()
    def _err(t):
        errors.append(t)
        print('   [erro no navegador]', t[:300], flush=True)
    page.on('console', lambda m: m.type == 'error' and _err(m.text))
    page.on('pageerror', lambda e: _err(str(e)))

    print('1. Abertura e catálogo vazio')
    page.goto(DIST)
    expect(page.get_by_text('Catálogo musical ainda não sincronizado')).to_be_visible()
    page.screenshot(path=SHOTS / '01-home-vazio.png')
    ok('home abre do disco (file://) e avisa que o catálogo não foi sincronizado')

    print('2. Sincronização do catálogo (≈65s por causa do limite da Apple)')
    page.get_by_role('button', name='Abrir painel do professor').click()
    page.get_by_role('button', name='Catálogo musical').click()
    page.get_by_role('button', name='Sincronizar catálogo').click()
    expect(page.get_by_text('Catálogo atualizado')).to_be_visible(timeout=120000)
    txt = page.locator('main').inner_text()
    m = re.search(r'Catálogo atualizado: (\d+) músicas', page.locator('body').inner_text())
    n_tracks = int(m.group(1))
    assert n_tracks == 19 * 9, n_tracks  # 19 artistas ok × (12 − 2 explícitas − 1 ao vivo); Derek pendente
    ok(f'{n_tracks} músicas verificadas (explícitas e "ao vivo" removidas, homônimo pendente)')
    page.get_by_role('button', name=re.compile('^Derek')).click()
    expect(page.get_by_text('Há 2 artistas chamados "Derek"')).to_be_visible()
    page.locator('input[type=checkbox]').first.check()
    page.get_by_role('button', name='Confirmar seleção').click()
    page.get_by_role('button', name='Confirmar e sincronizar').click()
    expect(page.get_by_text('Catálogo atualizado: 180 músicas')).to_be_visible(timeout=30000)
    ok('professor confirmou o perfil correto de "Derek" → 180 músicas')
    page.get_by_role('button', name=re.compile('^Matuê')).click()
    page.screenshot(path=SHOTS / '02-catalogo.png', full_page=True)

    print('3. Identificação e Modo Clássico')
    page.get_by_role('button', name='Entrar').click()
    page.get_by_role('button', name='Continuar').click()
    expect(page.get_by_text('Digite um nome ou apelido.')).to_be_visible()
    ok('validação de nome vazio')
    page.get_by_label('Nome ou apelido').fill('Ana')
    page.get_by_role('button', name='Continuar').click()
    page.get_by_role('button', name='JOGAR', exact=True).click()
    expect(page.get_by_text('180').first).to_be_visible()
    page.screenshot(path=SHOTS / '03-setup.png')
    page.get_by_role('button', name='Começar', exact=True).click()
    page.wait_for_selector('main button.group:not([disabled])', timeout=20000)
    playing = page.evaluate('() => [...document.querySelectorAll("audio")].length >= 0')
    page.screenshot(path=SHOTS / '04-jogo.png')
    # usa a dica 50/50 na primeira pergunta
    page.get_by_role('button', name=re.compile(r'50\/50')).click()
    expect(page.locator('main button.group[disabled]')).to_have_count(2)
    ok('50/50 elimina exatamente duas alternativas')
    play_solo_match(page, 10)
    expect(page.get_by_text('fim de jogo')).to_be_visible(timeout=20000)
    page.screenshot(path=SHOTS / '05-resultado.png', full_page=True)
    ok('partida clássica completa (10 músicas) com tela de resultado')

    print('4. Ranking e persistência após recarregar')
    page.get_by_role('button', name='Ver ranking').click()
    expect(page.locator('table').get_by_text('Ana')).to_be_visible()
    page.reload()
    page.get_by_role('button', name='Ranking').first.click()
    expect(page.locator('table').get_by_text('Ana')).to_be_visible()
    ok('ranking preservado após recarregar a página')

    print('5. Duelo (passa-e-joga)')
    page.get_by_role('button', name='Jogar').first.click()
    page.locator('button:has-text("Duelo")').first.click()
    expect(page.get_by_role('button', name='Começar', exact=True)).to_be_disabled()  # só a Ana
    page.get_by_placeholder('Adicionar novo participante').fill('Bia')
    page.get_by_role('button', name='Adicionar').click()
    expect(page.get_by_role('button', name='Começar', exact=True)).to_be_enabled()
    page.get_by_role('button', name='Começar', exact=True).click()
    for q in range(10):
        for turn in range(2):
            page.get_by_role('button', name='Estou pronto').click()
            page.wait_for_selector('main button.group:not([disabled])', timeout=20000)
            page.locator('main button.group').nth(turn).click()
            if turn == 0:
                expect(page.get_by_text('Resposta registrada')).to_be_visible()
                assert page.locator('main button.group.border-emerald-400\\/60').count() == 0, 'resposta vazou antes do 2º jogador'
        expect(page.get_by_text('Classificação ao vivo')).to_be_visible()
        if q == 0:
            page.screenshot(path=SHOTS / '06-duelo-revelacao.png')
    expect(page.get_by_text('venceu!')).to_be_visible(timeout=20000)
    page.screenshot(path=SHOTS / '07-duelo-resultado.png')
    ok('duelo completo; resposta só revelada após os dois jogadores')

    print('6. Falha de áudio → substituição sem perder pontos')
    page.get_by_role('button', name='Voltar ao menu').click()
    page.locator('button:has-text("Relâmpago")').first.click()
    # filtra apenas Matuê (onde está a faixa quebrada) para aumentar a chance de sorteá-la
    page.locator('button:has-text("Matuê")').first.click()
    page.get_by_role('button', name='Começar', exact=True).click()
    replaced = False
    finished_early = False
    for i in range(9):
        try:
            page.wait_for_selector('main button.group:not([disabled])', timeout=20000)
        except Exception:
            finished_early = page.get_by_text('catálogo esgotado').count() > 0
            break
        if page.get_by_text('Trocamos por outra música').count():
            replaced = True
        answer_current(page)
    page.wait_for_timeout(2600)
    print('   faixa com 404 foi substituída:', replaced, '| catálogo esgotado:', finished_early)
    if not finished_early and page.get_by_role('button', name='Encerrar partida').count():
        page.get_by_role('button', name='Encerrar partida').click()
        page.get_by_role('button', name='Encerrar', exact=True).click()
        expect(page.get_by_text('partida encerrada')).to_be_visible(timeout=10000)
    page.screenshot(path=SHOTS / '07b-falha-audio.png')
    hist = page.evaluate("""async () => new Promise(r => { const q = indexedDB.open('adivinhe-a-musica'); q.onsuccess = () => { const g = q.result.transaction('kv').objectStore('kv').get('data'); g.onsuccess = () => r(g.result.matches.at(-1)); }; })""")
    assert all(a['trackId'] != f'itunes:{BAD_TRACK}' for a in hist['answers']), 'faixa quebrada foi pontuada'
    assert len({a['trackId'] for a in hist['answers']}) == len(hist['answers']), 'música repetida na partida'
    ok(f"partida registrada sem a faixa quebrada e sem repetições ({len(hist['answers'])} respostas)")

    import atexit
    atexit.register(lambda: None)
    print('7. Campeonato')
    for nm in ['Caio', 'Davi']:
        page.get_by_role('button', name='Fila').first.click()
        page.wait_for_timeout(400)
        page.get_by_placeholder('Nome ou apelido').fill(nm)
        page.get_by_role('button', name='Adicionar').click()
    page.get_by_role('button', name='Campeonato').first.click()
    page.get_by_role('button', name='Novo campeonato').click()
    page.get_by_role('button', name='Selecionar todos').click()
    page.locator('input[type=range]').first.fill('5')
    page.get_by_role('button', name='Criar campeonato').click()
    page.wait_for_timeout(1500)
    page.screenshot(path=SHOTS / '08a-campeonato-criado.png', full_page=True)
    for k in range(4):
        page.locator('main button:has-text("Jogar")').first.click()
        try:
            play_solo_match(page, 5)
        except Exception:
            page.screenshot(path=SHOTS / 'fail.png'); raise
        expect(page.get_by_role('button', name='Voltar ao campeonato')).to_be_visible(timeout=20000)
        page.get_by_role('button', name='Voltar ao campeonato').click()
    page.get_by_role('button', name='Encerrar fase').click()
    page.get_by_role('button', name='Iniciar mata-mata').click()
    expect(page.get_by_text('Semifinal 1')).to_be_visible()
    page.screenshot(path=SHOTS / '08-campeonato.png', full_page=True)
    for bout in range(3):
        page.get_by_role('button', name='Iniciar confronto').click()
        for q in range(5):
            for turn in range(2):
                page.get_by_role('button', name='Estou pronto').click()
                page.wait_for_selector('main button.group:not([disabled])', timeout=20000)
                page.locator('main button.group').nth(turn).click()
        expect(page.get_by_role('button', name='Voltar ao campeonato')).to_be_visible(timeout=20000)
        page.get_by_role('button', name='Voltar ao campeonato').click()
    expect(page.get_by_text('Campeão', exact=True)).to_be_visible()
    page.wait_for_timeout(1200)
    page.screenshot(path=SHOTS / '09-campeao.png')
    ok('campeonato: classificatória → semifinais → final → tela do campeão')

    print('8. Exportação e importação')
    page.get_by_role('button', name='Professor').first.click()
    page.get_by_role('button', name='Dados e backup').click()
    with page.expect_download() as d:
        page.get_by_role('button', name='Exportar todos os dados').click()
    path = d.value.path()
    exported = json.loads(Path(path).read_text())
    assert exported['app'] == 'adivinhe-a-musica' and len(exported['data']['players']) == 4, exported['data']['players']
    n_matches = len(exported['data']['matches'])
    ok(f'exportação JSON: 4 jogadores, {n_matches} partidas')
    page.locator('input[type=file]').set_input_files(path)
    expect(page.get_by_text('Serão adicionados: 0 jogadores, 0 partidas')).to_be_visible()
    ok('importar o mesmo arquivo não duplica nada')
    page.get_by_role('button', name='Cancelar').click()
    bad = ROOT / 'e2e' / 'bad.json'
    bad.write_text('{"app":"outro"}')
    page.locator('input[type=file]').set_input_files(str(bad))
    expect(page.get_by_text('Arquivo recusado')).to_be_visible()
    ok('arquivo inválido é recusado com mensagem clara')
    page.keyboard.press('Escape')
    page.screenshot(path=SHOTS / '10-dados.png')

    print('9. Hall da Fama, conquistas, modo apresentador, responsividade')
    page.get_by_role('button', name='Hall da Fama').first.click()
    expect(page.get_by_text('Campeões anteriores')).to_be_visible()
    page.screenshot(path=SHOTS / '11-hall.png', full_page=True)
    page.get_by_role('button', name='Conquistas').first.click()
    expect(page.get_by_text('Primeiro Acerto')).to_be_visible()
    page.screenshot(path=SHOTS / '12-conquistas.png', full_page=True)
    page.get_by_role('button', name='Modo apresentador').click()
    assert page.evaluate('() => document.documentElement.classList.contains("presenter")')
    page.get_by_role('button', name='Jogar').first.click()
    page.screenshot(path=SHOTS / '13-apresentador-home.png')
    ok('modo apresentador ativo (tipografia ampliada)')
    page.set_viewport_size({'width': 390, 'height': 844})
    page.get_by_role('button', name='Ranking').first.click()
    page.screenshot(path=SHOTS / '14-mobile-ranking.png', full_page=True)
    page.get_by_role('button', name='Jogar').first.click()
    page.screenshot(path=SHOTS / '15-mobile-home.png')
    ok('layout responsivo (390px)')

    real_errors = [e for e in errors if 'audio.test' not in e and '404' not in e]
    print('\nErros de console:', real_errors or 'nenhum')
    browser.close()
    if real_errors:
        sys.exit(1)
print(f'\nTODOS OS {len(checks)} CHECKS PASSARAM')
