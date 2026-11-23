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
  { id: 'mc-cabelinho', name: 'MC Cabelinho', categories: ['funk', 'rap'] },
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
  { id: 'brandao', name: 'Brandão', categories: ['trap'] },
  { id: 'ryu-the-runner', name: 'Ryu, The Runner', categories: ['trap'] },
  { id: 'mc-ryan-sp', name: 'MC Ryan SP', categories: ['funk'] },
  { id: 'mc-ig', name: 'MC IG', categories: ['funk'] },
  { id: 'mc-hariel', name: 'MC Hariel', categories: ['funk'] },
  { id: 'racionais', name: "Racionais MC's", aliases: ['racionais mcs', 'racionais'], categories: ['rap'] },
  { id: 'emicida', name: 'Emicida', categories: ['rap'] },
  { id: 'criolo', name: 'Criolo', categories: ['rap'] },
  { id: 'djonga', name: 'Djonga', categories: ['rap'] },
  { id: 'mc-kevin-o-chris', name: 'MC Kevin o Chris', categories: ['funk'] },
  { id: 'mc-don-juan', name: 'MC Don Juan', categories: ['funk'] },
  { id: 'mc-livinho', name: 'MC Livinho', categories: ['funk'] },

  // ── Sertanejo ──────────────────────────────────────────────
  { id: 'jorge-mateus', name: 'Jorge & Mateus', aliases: ['jorge e mateus'], categories: ['sertanejo'] },
  { id: 'henrique-juliano', name: 'Henrique & Juliano', aliases: ['henrique e juliano'], categories: ['sertanejo', 'sofrencia'] },
  { id: 'ze-neto-cristiano', name: 'Zé Neto & Cristiano', aliases: ['ze neto e cristiano'], categories: ['sertanejo', 'sofrencia'] },
  { id: 'gusttavo-lima', name: 'Gusttavo Lima', categories: ['sertanejo'] },
  { id: 'luan-santana', name: 'Luan Santana', categories: ['sertanejo'] },
  { id: 'ana-castela', name: 'Ana Castela', categories: ['sertanejo'] },
  { id: 'chitaozinho-xororo', name: 'Chitãozinho & Xororó', aliases: ['chitaozinho e xororo'], categories: ['sertanejo'] },
  { id: 'bruno-marrone', name: 'Bruno & Marrone', aliases: ['bruno e marrone'], categories: ['sertanejo', 'sofrencia'] },
  { id: 'leonardo', name: 'Leonardo', categories: ['sertanejo'] },
  { id: 'matheus-kauan', name: 'Matheus & Kauan', aliases: ['matheus e kauan'], categories: ['sertanejo'] },
  { id: 'hugo-guilherme', name: 'Hugo & Guilherme', aliases: ['hugo e guilherme'], categories: ['sertanejo'] },
  { id: 'luan-pereira', name: 'Luan Pereira', categories: ['sertanejo'] },

  // ── Sofrência ──────────────────────────────────────────────
  { id: 'marilia-mendonca', name: 'Marília Mendonça', categories: ['sofrencia', 'sertanejo'] },
  { id: 'maiara-maraisa', name: 'Maiara & Maraisa', aliases: ['maiara e maraisa'], categories: ['sofrencia', 'sertanejo'] },
  { id: 'simone-mendes', name: 'Simone Mendes', categories: ['sofrencia', 'sertanejo'] },
  { id: 'naiara-azevedo', name: 'Naiara Azevedo', categories: ['sofrencia'] },
  { id: 'lauana-prado', name: 'Lauana Prado', categories: ['sofrencia', 'sertanejo'] },
  { id: 'israel-rodolffo', name: 'Israel & Rodolffo', aliases: ['israel e rodolffo'], categories: ['sofrencia', 'sertanejo'] },
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
  { id: 'anitta', name: 'Anitta', categories: ['pop-br'] },
  { id: 'ludmilla', name: 'Ludmilla', categories: ['pop-br', 'funk'] },
  { id: 'luisa-sonza', name: 'Luísa Sonza', categories: ['pop-br'] },
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
  { id: 'thiaguinho', name: 'Thiaguinho', categories: ['pagode'] },
  { id: 'pericles', name: 'Péricles', categories: ['pagode'] },
  { id: 'ferrugem', name: 'Ferrugem', categories: ['pagode'] },
  { id: 'menos-e-mais', name: 'Menos É Mais', categories: ['pagode'] },
  { id: 'sorriso-maroto', name: 'Sorriso Maroto', categories: ['pagode'] },
  { id: 'dilsinho', name: 'Dilsinho', categories: ['pagode'] },
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
  { id: 'wesley-safadao', name: 'Wesley Safadão', categories: ['forro'] },
  { id: 'xand-aviao', name: 'Xand Avião', categories: ['forro'] },
  { id: 'joao-gomes', name: 'João Gomes', categories: ['forro'] },
  { id: 'ze-vaqueiro', name: 'Zé Vaqueiro', categories: ['forro'] },
  { id: 'baroes-da-pisadinha', name: 'Os Barões da Pisadinha', aliases: ['baroes da pisadinha'], categories: ['forro'] },
  { id: 'luiz-gonzaga', name: 'Luiz Gonzaga', categories: ['forro'] },
  { id: 'calcinha-preta', name: 'Calcinha Preta', categories: ['forro'] },
  { id: 'mastruz-com-leite', name: 'Mastruz com Leite', categories: ['forro'] },
  { id: 'rai-saia-rodada', name: 'Raí Saia Rodada', categories: ['forro'] },
  { id: 'nattan', name: 'Nattan', categories: ['forro'] },

  // ── Gospel ─────────────────────────────────────────────────
  { id: 'aline-barros', name: 'Aline Barros', categories: ['gospel'] },
  { id: 'fernandinho', name: 'Fernandinho', categories: ['gospel'] },
  { id: 'gabriela-rocha', name: 'Gabriela Rocha', categories: ['gospel'] },
  { id: 'anderson-freire', name: 'Anderson Freire', categories: ['gospel'] },
  { id: 'thalles-roberto', name: 'Thalles Roberto', categories: ['gospel'] },
  { id: 'isadora-pompeo', name: 'Isadora Pompeo', categories: ['gospel'] },
  { id: 'bruna-karla', name: 'Bruna Karla', categories: ['gospel'] },
  { id: 'cassiane', name: 'Cassiane', categories: ['gospel'] },
  { id: 'eli-soares', name: 'Eli Soares', categories: ['gospel'] },
];

export const ARTIST_BY_ID: Record<string, ArtistDef> = Object.fromEntries(ARTISTS.map((a) => [a.id, a]));

export const CATEGORIES: { id: CategoryId; name: string; short: string; description: string }[] = [
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
  { id: 'gospel', name: 'Gospel', short: 'Gospel', description: 'Louvores e hits da música gospel.' },
  { id: 'hits', name: 'Hits do Momento', short: 'Hits', description: 'Lançamentos recentes mais bem posicionados.' },
];

export const ALL_CATEGORY_IDS: CategoryId[] = CATEGORIES.map((c) => c.id);

/**
 * Gêneros oficiais da Apple (primaryGenreName) aceitos para cada categoria.
 * Usado para escolher automaticamente o perfil certo quando existe mais de
 * um artista com o mesmo nome na Apple Music.
 */
export const CATEGORY_GENRES: Record<Exclude<CategoryId, 'hits'>, RegExp> = {
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
  gospel: /gospel|crist|christian|religio|worship|inspira|louvor/i,
};

export const CATEGORY_NAME: Record<CategoryId, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.name]),
) as Record<CategoryId, string>;

export const DIFFICULTY_NAME = { 1: 'Fácil', 2: 'Médio', 3: 'Difícil', 4: 'Extremo' } as const;
