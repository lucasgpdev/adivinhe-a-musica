# Adivinhe a Música 🎧

Jogo de adivinhar músicas de **Trap, Funk e Rap nacional** para a turma jogar no computador do professor.
Não usa servidor nem banco de dados online: tudo fica salvo no navegador desse computador.

---

## 1. Como abrir (sem instalar nada)

1. Abra o arquivo **`adivinhe-a-musica.html`** no **Google Chrome** ou no **Microsoft Edge**. Basta dar dois cliques.
2. Na primeira vez, clique em **Professor → Catálogo musical → Sincronizar catálogo**.
   - Precisa de internet. Leva cerca de **1 minuto**, porque a Apple limita as consultas.
   - Ao final aparece quantas músicas verificadas entraram no jogo, artista por artista.
3. Clique em **JOGAR**.

> **Importante:** use sempre o **mesmo arquivo, no mesmo lugar, no mesmo navegador**.
> O ranking fica guardado no navegador. Se você mover o arquivo para outra pasta ou abrir em outro navegador, ele começa vazio.
> Nesse caso, use **Professor → Dados e backup → Exportar** e depois **Importar** no novo local.

## 2. De onde vêm as músicas (e por que são confiáveis)

- **Fonte:** API pública oficial da Apple (iTunes Search API), loja do Brasil.
- **Áudio:** a prévia oficial de 30 segundos que a própria Apple disponibiliza para divulgação. Nada é baixado nem extraído. O jogo só toca a prévia pela internet.
- **Título, artista, participações e ano** vêm **da mesma ficha** da prévia, então o áudio sempre corresponde ao título mostrado. Nenhum título foi digitado à mão.
- **Versões limpas:** só entram faixas que a Apple marca como *não explícitas* ou *limpas*. Também ficam de fora versões ao vivo, remix, acelerada, slowed, instrumental e similares.
- **Artistas com nome repetido** (ex.: dois perfis "Derek" na Apple) ficam como **"confirmar artista"**. As músicas desses artistas só entram depois que o professor marca o perfil correto no painel.
- **Letras:** o jogo não exibe letras.
- Se uma prévia falhar durante a partida, a pergunta é trocada por outra música verificada e **ninguém perde pontos**. Uma faixa que falha 3 vezes sai do jogo sozinha.
- No painel, o professor pode **ouvir cada prévia** e **excluir** qualquer música manualmente.

⚠️ **Limitação esperada:** muitas músicas de trap e funk são marcadas como explícitas pela Apple. Alguns artistas podem ficar com poucas músicas, ou nenhuma, em versão limpa. O painel mostra os números de cada um.

## 3. Modos de jogo

| Modo | Regras |
|---|---|
| Clássico | 10 músicas, 15 s cada, 100 pts por acerto |
| Relâmpago | 20 músicas, 10 s cada, 150 pts por acerto |
| Hardcore | 15 músicas, 5 s cada, 200 pts por acerto, músicas difíceis, sem dicas |
| Infinito | Sem limite de perguntas; a dificuldade sobe e o jogo termina no primeiro erro |
| Duelo | 2 jogadores ouvem as mesmas músicas; a resposta só é revelada depois que os dois respondem |
| Batalha | 3 a 12 jogadores com placar ao vivo |
| Misterioso | Trecho de 1 s; "Ouvir mais" aumenta o trecho, mas vale menos pontos |
| Sobrevivência | 1 a 12 jogadores; quem erra é eliminado e o tempo diminui a cada rodada |
| Personalizado | Você define todas as regras (partida amistosa, não conta no ranking) |

**Pontuação:** pontos-base + bônus de velocidade (até +50%) × combo (×1,5 com 3 acertos seguidos, ×2 com 6, ×3 com 10). A rodada bônus vale o dobro.

**Penalidade das dicas:** artista −25%, ano −15%, 50/50 −30%. O máximo é 3 dicas por partida.

**Segunda chance:** 1 por partida, vale metade dos pontos.

**Roubo de pontos (modos competitivos):** o jogador que acertar mais rápido leva o valor-base de cada adversário que errou.

**Teclado:** `1–4` ou `A–D` respondem · `Espaço` toca/pausa a música · `Enter` avança.

## 4. Jogar online com amigos

1. Clique em **Jogar online**, digite seu nome e escolha um avatar.
2. **Criar sala**: você vira o dono e recebe um código de 4 letras (ex.: `K7Q2`) e um link de convite.
3. Os amigos entram com o código (ou abrindo o link) e escolhem o time.
4. O dono escolhe o formato — **Times** (Time Roxo × Time Azul, de 1v1 até 4v4) ou **Todos contra todos** (até 8) —, os gêneros, a quantidade de músicas e o tempo.
5. Todos ouvem a mesma música ao mesmo tempo. Acerto vale 500 pontos + até 500 pela velocidade. Nos times, os pontos de cada jogador somam para o time.

Se a internet cair, o jogo reconecta sozinho e volta para a mesma sala.

As músicas são buscadas na Apple Music durante a publicação no Render (`scripts/build-catalog.ts`) e entregues prontas em `catalog.json` — não é mais preciso sincronizar nada.

### Rodando localmente

```
npm install
npm run catalog   # opcional: baixa as músicas (~7 min)
npm run build
npm start         # http://localhost:3000
```

## 5. Para desenvolvedores

```bash
npm install
npm run dev        # servidor de desenvolvimento
npm test           # 32 testes unitários (motor, pontuação, catálogo, ranking, campeonato, backup)
npm run build      # gera dist/index.html (arquivo único, funciona via file://)
python3 e2e/run.py # teste ponta a ponta no Chrome (rede simulada)
```

**Tecnologias:** React 18, Vite, TypeScript, Tailwind CSS, Framer Motion, Lucide, IndexedDB e localStorage, HTML Audio API e Web Audio API (efeitos sonoros sintetizados).

**Estrutura do código (`src/`):**

| Pasta | Conteúdo |
|---|---|
| `types/` | tipos |
| `data/` | artistas, modos, cosméticos |
| `services/` | Apple e catálogo |
| `audio/` | player e efeitos sonoros |
| `game/` | motor puro e pontuação |
| `ranking/` | rankings |
| `achievements/` | conquistas |
| `championship/` | campeonato |
| `storage/` | IndexedDB, backup e importação |
| `state/` | estado global |
| `components/` | componentes visuais |
| `pages/` | telas |
| `styles/` | estilos |

O ranking é compartilhado **dentro deste computador e navegador**. Ele não é sincronizado automaticamente com outros computadores.
