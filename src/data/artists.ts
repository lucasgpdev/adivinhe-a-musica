import type { ArtistDef, CategoryId } from '../types';

/**
 * Artistas cadastrados (lista definida pelo professor).
 * IMPORTANTE: aqui ficam apenas os nomes dos artistas. Nenhum título de música
 * é digitado à mão — as músicas, créditos, anos e prévias vêm da Apple Music
 * (iTunes Search API) e passam pela verificação em services/catalog.ts.
 *
 * Cada gênero tem 8+ artistas para garantir bem mais de 25 músicas verificadas
 * por categoria (cada artista costuma render de 10 a 60 músicas limpas).
 */
export const ARTISTS: ArtistDef[] = [
  // ── Trap / Rap / Funk ──────────────────────────────────────
  { id: 'matue', name: 'Matuê', categories: ['trap'] },
  { id: 'veigh', name: 'Veigh', categories: ['trap'] },
  { id: 'teto', name: 'Teto', categories: ['trap'] },
  { id: 'wiu', name: 'WIU', categories: ['trap'] },
  { id: 'mc-cabelinho', name: 'MC Cabelinho', categories: ['funk', 'rap'], tiktok: true },
  { id: 'kayblack', name: 'KayBlack', aliases: ['kay black'], categories: ['trap'] },
  { id: 'borges', name: 'Borges', categories: ['trap', 'rap'] },
  { id: 'filipe-ret', name: 'Filipe Ret', categories: ['trap', 'rap'] },
  { id: 'orochi', name: 'Orochi', categories: ['trap', 'rap'] },
  { id: 'l7nnon', name: 'L7NNON', categories: ['trap', 'rap'] },
  { id: 'tz-da-coronel', name: 'TZ da Coronel', categories: ['trap'] },
  { id: 'vulgo-fk', name: 'Vulgo FK', categories: ['trap'] },
  { id: 'derek', name: 'Derek', categories: ['trap'] },
  { id: 'alee', name: 'Alee', categories: ['trap'] },
  { id: 'yunk-vino', name: 'Yunk Vino', categories: ['trap'] },
  { id: 'brandao', name: 'Brandão', aliases: ['brandao85', 'brandão85'], categories: ['trap'] },
  { id: 'ryu-the-runner', name: 'Ryu, The Runner', categories: ['trap'] },
  { id: 'mc-ryan-sp', name: 'MC Ryan SP', categories: ['funk'], tiktok: true },
  { id: 'mc-ig', name: 'MC IG', categories: ['funk'], tiktok: true },
  { id: 'mc-hariel', name: 'MC Hariel', categories: ['funk'], tiktok: true },
  { id: 'racionais', name: "Racionais MC's", aliases: ['racionais mcs', 'racionais'], categories: ['rap'] },
  { id: 'emicida', name: 'Emicida', categories: ['rap'] },
  { id: 'criolo', name: 'Criolo', categories: ['rap'] },
  { id: 'djonga', name: 'Djonga', categories: ['rap'] },
  { id: 'mc-kevin-o-chris', name: 'MC Kevin o Chris', categories: ['funk'], tiktok: true },
  { id: 'mc-don-juan', name: 'MC Don Juan', categories: ['funk'] },
  { id: 'mc-livinho', name: 'MC Livinho', categories: ['funk'], tiktok: true },

  // ── Sertanejo ──────────────────────────────────────────────
  { id: 'jorge-mateus', name: 'Jorge & Mateus', aliases: ['jorge e mateus'], categories: ['sertanejo'] },
  { id: 'henrique-juliano', name: 'Henrique & Juliano', aliases: ['henrique e juliano'], categories: ['sertanejo', 'sofrencia'], tiktok: true },
  { id: 'ze-neto-cristiano', name: 'Zé Neto & Cristiano', aliases: ['ze neto e cristiano'], categories: ['sertanejo', 'sofrencia'], tiktok: true },
  { id: 'gusttavo-lima', name: 'Gusttavo Lima', categories: ['sertanejo'], tiktok: true },
  { id: 'luan-santana', name: 'Luan Santana', categories: ['sertanejo'] },
  { id: 'ana-castela', name: 'Ana Castela', categories: ['sertanejo'], tiktok: true },
  { id: 'chitaozinho-xororo', name: 'Chitãozinho & Xororó', aliases: ['chitaozinho e xororo'], categories: ['sertanejo'] },
  { id: 'bruno-marrone', name: 'Bruno & Marrone', aliases: ['bruno e marrone'], categories: ['sertanejo', 'sofrencia'] },
  { id: 'leonardo', name: 'Leonardo', categories: ['sertanejo'] },
  { id: 'matheus-kauan', name: 'Matheus & Kauan', aliases: ['matheus e kauan'], categories: ['sertanejo'], tiktok: true },
  { id: 'hugo-guilherme', name: 'Hugo & Guilherme', aliases: ['hugo e guilherme'], categories: ['sertanejo'] },
  { id: 'luan-pereira', name: 'Luan Pereira', categories: ['sertanejo'], tiktok: true },

  // ── Sofrência ──────────────────────────────────────────────
  { id: 'marilia-mendonca', name: 'Marília Mendonça', categories: ['sofrencia', 'sertanejo'] },
  { id: 'maiara-maraisa', name: 'Maiara & Maraisa', aliases: ['maiara e maraisa'], categories: ['sofrencia', 'sertanejo'] },
  { id: 'simone-mendes', name: 'Simone Mendes', categories: ['sofrencia', 'sertanejo'], tiktok: true },
  { id: 'naiara-azevedo', name: 'Naiara Azevedo', categories: ['sofrencia'] },
  { id: 'lauana-prado', name: 'Lauana Prado', categories: ['sofrencia', 'sertanejo'] },
  { id: 'israel-rodolffo', name: 'Israel & Rodolffo', aliases: ['israel e rodolffo'], categories: ['sofrencia', 'sertanejo'], tiktok: true },
  { id: 'pablo', name: 'Pablo', aliases: ['pablo do arrocha'], categories: ['sofrencia'] },
  { id: 'murilo-huff', name: 'Murilo Huff', categories: ['sofrencia', 'sertanejo'] },
  { id: 'tarcisio-do-acordeon', name: 'Tarcísio do Acordeon', categories: ['sofrencia', 'forro'] },

  // ── MPB ────────────────────────────────────────────────────
  { id: 'marisa-monte', name: 'Marisa Monte', categories: ['mpb'] },
  { id: 'caetano-veloso', name: 'Caetano Veloso', categories: ['mpb'] },
  { id: 'gilberto-gil', name: 'Gilberto Gil', categories: ['mpb'] },
  { id: 'djavan', name: 'Djavan', categories: ['mpb'] },
  { id: 'chico-buarque', name: 'Chico Buarque', categories: ['mpb'] },
  { id: 'milton-nascimento', name: 'Milton Nascimento', categories: ['mpb'] },
  { id: 'elis-regina', name: 'Elis Regina', categories: ['mpb'] },
  { id: 'tim-maia', name: 'Tim Maia', categories: ['mpb'] },
  { id: 'jorge-ben-jor', name: 'Jorge Ben Jor', aliases: ['jorge ben'], categories: ['mpb'] },
  { id: 'ana-carolina', name: 'Ana Carolina', categories: ['mpb'] },
  { id: 'tribalistas', name: 'Tribalistas', categories: ['mpb'] },
  { id: 'maria-gadu', name: 'Maria Gadú', categories: ['mpb'] },

  // ── Pop Nacional ───────────────────────────────────────────
  { id: 'pollo', name: 'Pollo', categories: ['pop-br'] }, // "Vagalumes"
  { id: 'anitta', name: 'Anitta', categories: ['pop-br'], tiktok: true },
  { id: 'ludmilla', name: 'Ludmilla', categories: ['pop-br', 'funk'], tiktok: true },
  { id: 'luisa-sonza', name: 'Luísa Sonza', categories: ['pop-br'], tiktok: true },
  { id: 'pabllo-vittar', name: 'Pabllo Vittar', categories: ['pop-br'] },
  { id: 'iza', name: 'IZA', categories: ['pop-br'] },
  { id: 'jao', name: 'Jão', categories: ['pop-br'] },
  { id: 'vitor-kley', name: 'Vitor Kley', categories: ['pop-br'] },
  { id: 'melim', name: 'Melim', categories: ['pop-br'] },
  { id: 'manu-gavassi', name: 'Manu Gavassi', categories: ['pop-br'] },
  { id: 'lagum', name: 'Lagum', categories: ['pop-br'] },
  { id: 'ivete-sangalo', name: 'Ivete Sangalo', categories: ['pop-br'] },

  // ── Pop Internacional ──────────────────────────────────────
  { id: 'taylor-swift', name: 'Taylor Swift', categories: ['pop-intl'] },
  { id: 'ed-sheeran', name: 'Ed Sheeran', categories: ['pop-intl'] },
  { id: 'dua-lipa', name: 'Dua Lipa', categories: ['pop-intl'] },
  { id: 'bruno-mars', name: 'Bruno Mars', categories: ['pop-intl'] },
  { id: 'the-weeknd', name: 'The Weeknd', categories: ['pop-intl'] },
  { id: 'billie-eilish', name: 'Billie Eilish', categories: ['pop-intl'] },
  { id: 'olivia-rodrigo', name: 'Olivia Rodrigo', categories: ['pop-intl'] },
  { id: 'ariana-grande', name: 'Ariana Grande', categories: ['pop-intl'] },
  { id: 'harry-styles', name: 'Harry Styles', categories: ['pop-intl'] },
  { id: 'sabrina-carpenter', name: 'Sabrina Carpenter', categories: ['pop-intl'] },
  { id: 'coldplay', name: 'Coldplay', categories: ['pop-intl'] },
  { id: 'adele', name: 'Adele', categories: ['pop-intl'] },

  // ── Pagode ─────────────────────────────────────────────────
  { id: 'thiaguinho', name: 'Thiaguinho', categories: ['pagode'], tiktok: true },
  { id: 'pericles', name: 'Péricles', categories: ['pagode'], tiktok: true },
  { id: 'ferrugem', name: 'Ferrugem', categories: ['pagode'], tiktok: true },
  { id: 'menos-e-mais', name: 'Menos É Mais', aliases: ['grupo menos e mais'], categories: ['pagode'], tiktok: true },
  { id: 'sorriso-maroto', name: 'Sorriso Maroto', categories: ['pagode'] },
  { id: 'dilsinho', name: 'Dilsinho', categories: ['pagode'], tiktok: true },
  { id: 'grupo-revelacao', name: 'Grupo Revelação', categories: ['pagode'] },
  { id: 'turma-do-pagode', name: 'Turma do Pagode', categories: ['pagode'] },
  { id: 'exaltasamba', name: 'Exaltasamba', categories: ['pagode'] },
  { id: 'belo', name: 'Belo', categories: ['pagode'] },
  { id: 'mumuzinho', name: 'Mumuzinho', categories: ['pagode'] },

  // ── Rock Nacional ──────────────────────────────────────────
  { id: 'legiao-urbana', name: 'Legião Urbana', categories: ['rock-br'] },
  { id: 'charlie-brown-jr', name: 'Charlie Brown Jr.', aliases: ['charlie brown jr'], categories: ['rock-br'] },
  { id: 'skank', name: 'Skank', categories: ['rock-br'] },
  { id: 'titas', name: 'Titãs', categories: ['rock-br'] },
  { id: 'paralamas', name: 'Os Paralamas do Sucesso', aliases: ['paralamas do sucesso'], categories: ['rock-br'] },
  { id: 'capital-inicial', name: 'Capital Inicial', categories: ['rock-br'] },
  { id: 'barao-vermelho', name: 'Barão Vermelho', categories: ['rock-br'] },
  { id: 'engenheiros', name: 'Engenheiros do Hawaii', categories: ['rock-br'] },
  { id: 'pitty', name: 'Pitty', categories: ['rock-br'] },
  { id: 'cpm-22', name: 'CPM 22', categories: ['rock-br'] },
  { id: 'nx-zero', name: 'NX Zero', categories: ['rock-br'] },

  // ── Forró / Piseiro ────────────────────────────────────────
  { id: 'wesley-safadao', name: 'Wesley Safadão', categories: ['forro'], tiktok: true },
  { id: 'xand-aviao', name: 'Xand Avião', categories: ['forro'], tiktok: true },
  { id: 'joao-gomes', name: 'João Gomes', categories: ['forro'], tiktok: true },
  { id: 'ze-vaqueiro', name: 'Zé Vaqueiro', categories: ['forro'], tiktok: true },
  { id: 'baroes-da-pisadinha', name: 'Os Barões da Pisadinha', aliases: ['baroes da pisadinha'], categories: ['forro'], tiktok: true },
  { id: 'luiz-gonzaga', name: 'Luiz Gonzaga', categories: ['forro'] },
  { id: 'calcinha-preta', name: 'Calcinha Preta', categories: ['forro'] },
  { id: 'mastruz-com-leite', name: 'Mastruz com Leite', categories: ['forro'] },
  { id: 'rai-saia-rodada', name: 'Raí Saia Rodada', categories: ['forro'] },
  { id: 'nattan', name: 'Nattan', categories: ['forro'], tiktok: true },

  // ── Virais do TikTok (funk, sertanejo, pagode e piseiro) ──
  { id: 'pedro-sampaio', name: 'Pedro Sampaio', categories: ['funk', 'pop-br'], tiktok: true },
  { id: 'dennis-dj', name: 'Dennis DJ', aliases: ['dennis'], categories: ['funk'], tiktok: true },
  { id: 'mc-daniel', name: 'MC Daniel', categories: ['funk'], tiktok: true },
  { id: 'mc-paiva', name: 'MC Paiva', categories: ['funk'], tiktok: true },
  { id: 'mc-tuto', name: 'MC Tuto', categories: ['funk'], tiktok: true },
  { id: 'mari-fernandez', name: 'Mari Fernandez', categories: ['forro', 'sofrencia'], tiktok: true },
  { id: 'dj-arana', name: 'DJ Arana', categories: ['funk'], tiktok: true },
  { id: 'dj-oreia', name: 'DJ Oreia', aliases: ['dj oreia', 'oreia'], categories: ['funk'], tiktok: true },

  // ── Submundo 808 (funk mandelão de Campinas) — entram só as de 2024 em diante ──
  { id: 'submundo-808', name: 'Submundo 808', aliases: ['submundo808'], categories: ['funk'], submundo: true },
  { id: 'dj-clei', name: 'Dj Clei', categories: ['funk'], submundo: true },
  { id: 'dj-tresk', name: 'DJ Tresk', aliases: ['tresk'], categories: ['funk'], submundo: true },
  { id: 'kenan-kel', name: 'Kenan & Kel DJs', aliases: ['kenan e kel djs', 'kenan & kel', 'kenan e kel'], categories: ['funk'], submundo: true },
  { id: 'novin-yarp', name: 'Novin Yarp', categories: ['funk'], submundo: true },
  { id: 'dj-petala', name: 'Dj Pétala', categories: ['funk'], submundo: true },
  { id: 'mc-jhey', name: 'MC Jhey', categories: ['funk'], submundo: true },
  { id: 'yuri-redicopa', name: 'Yuri Redicopa', categories: ['funk'], submundo: true },
  { id: 'chris-silva', name: 'Chris Silva', categories: ['funk'], submundo: true },
  { id: 'dj-caio-prince', name: 'DJ Caio Prince', categories: ['funk'], submundo: true },
  { id: 'dj-thiago-martins', name: 'DJ Thiago Martins', categories: ['funk'], submundo: true },
  { id: 'mc-gw', name: 'MC GW', categories: ['funk'], submundo: true },
  { id: 'mc-magrinho', name: 'Mc Magrinho', categories: ['funk'], submundo: true },
  { id: 'dj-ll', name: 'DJ LL', categories: ['funk'], submundo: true },
  { id: 'mc-meduza', name: 'MC Meduza', categories: ['funk'], submundo: true },
  { id: 'dj-m13', name: 'DJ M13 da ZO', aliases: ['dj m13'], categories: ['funk'], submundo: true },
];

export const ARTIST_BY_ID: Record<string, ArtistDef> = Object.fromEntries(ARTISTS.map((a) => [a.id, a]));

export const CATEGORIES: { id: CategoryId; name: string; short: string; description: string }[] = [
  { id: 'tiktok', name: 'Virais do TikTok', short: 'TikTok', description: 'As famosinhas do TikTok: funk, sertanejo, pagode e piseiro.' },
  { id: 'submundo', name: 'Submundo 808', short: 'Submundo', description: 'O funk mandelão da cena de Campinas — lançamentos de 2024 a 2026.' },
  { id: 'trap', name: 'Trap Nacional', short: 'Trap', description: 'O trap brasileiro que domina as paradas.' },
  { id: 'funk', name: 'Funk Nacional', short: 'Funk', description: 'Funk de SP e do Rio, das quebradas para o mundo.' },
  { id: 'rap', name: 'Rap Nacional', short: 'Rap', description: 'Rimas e flow de quem escreve a cena.' },
  { id: 'sertanejo', name: 'Sertanejo', short: 'Sertanejo', description: 'Das modas clássicas ao sertanejo universitário.' },
  { id: 'sofrencia', name: 'Sofrência', short: 'Sofrência', description: 'Pra cantar no último volume com o coração partido.' },
  { id: 'mpb', name: 'MPB', short: 'MPB', description: 'Os clássicos e as vozes da música popular brasileira.' },
  { id: 'pop-br', name: 'Pop Nacional', short: 'Pop BR', description: 'O pop brasileiro que toca em todo lugar.' },
  { id: 'pop-intl', name: 'Pop Internacional', short: 'Pop Intl', description: 'Os maiores nomes do pop mundial.' },
  { id: 'pagode', name: 'Pagode', short: 'Pagode', description: 'Roda de samba e pagode romântico.' },
  { id: 'rock-br', name: 'Rock Nacional', short: 'Rock', description: 'As bandas que marcaram o rock brasileiro.' },
  { id: 'forro', name: 'Forró e Piseiro', short: 'Forró', description: 'Do pé-de-serra ao piseiro.' },
  { id: 'hits', name: 'Hits do Momento', short: 'Hits', description: 'Lançamentos recentes mais bem posicionados.' },
];

export const ALL_CATEGORY_IDS: CategoryId[] = CATEGORIES.map((c) => c.id);

/**
 * Gêneros oficiais da Apple (primaryGenreName) aceitos para cada categoria.
 * Usado para escolher automaticamente o perfil certo quando existe mais de
 * um artista com o mesmo nome na Apple Music.
 */
export const CATEGORY_GENRES: Record<Exclude<CategoryId, 'hits' | 'tiktok' | 'submundo'>, RegExp> = {
  trap: /hip|rap|trap|funk|brasil|brazil|urban|pop|r&b|soul|dance|electronic|eletr/i,
  funk: /hip|rap|trap|funk|brasil|brazil|urban|pop|r&b|soul|dance|electronic|eletr/i,
  rap: /hip|rap|trap|funk|brasil|brazil|urban|pop|r&b|soul|dance|electronic|eletr/i,
  sertanejo: /sertanej|country|brasil|brazil|pop|forr|regional/i,
  sofrencia: /sertanej|country|brasil|brazil|pop|forr|arrocha|regional/i,
  mpb: /mpb|brasil|brazil|samba|bossa|pop|rock|soul|world|singer|cantor|jazz/i,
  'pop-br': /pop|brasil|brazil|dance|eletr|electronic|r&b|soul|funk|mpb|rock|alternativ|indie|ax[eé]|reggae/i,
  'pop-intl': /pop|rock|country|dance|electronic|r&b|soul|alternativ|indie|singer/i,
  pagode: /pagode|samba|brasil|brazil|mpb|pop/i,
  'rock-br': /rock|alternativ|punk|metal|brasil|brazil|pop|mpb|indie|reggae/i,
  forro: /forr|piseiro|sertanej|brasil|brazil|ax[eé]|nordest|regional|pop/i,
};

export const CATEGORY_NAME: Record<CategoryId, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.name]),
) as Record<CategoryId, string>;

export const DIFFICULTY_NAME = { 1: 'Fácil', 2: 'Médio', 3: 'Difícil', 4: 'Extremo' } as const;
