/** Avatares e temas. Os itens com `unlock` exigem a conquista indicada. */

export interface AvatarDef {
  id: string;
  icon: string; // ícone lucide
  from: string;
  to: string;
  unlock?: string; // achievement id
}

export const AVATARS: AvatarDef[] = [
  { id: 'headphones', icon: 'headphones', from: '#7c3aed', to: '#c026d3' },
  { id: 'mic', icon: 'mic', from: '#6d28d9', to: '#4f46e5' },
  { id: 'music', icon: 'music', from: '#9333ea', to: '#db2777' },
  { id: 'radio', icon: 'radio', from: '#5b21b6', to: '#0ea5e9' },
  { id: 'disc', icon: 'disc', from: '#a855f7', to: '#6366f1' },
  { id: 'speaker', icon: 'speaker', from: '#7e22ce', to: '#14b8a6' },
  { id: 'flame', icon: 'flame', from: '#f97316', to: '#a21caf', unlock: 'hardcore-king' },
  { id: 'crown', icon: 'crown', from: '#f5c451', to: '#b45309', unlock: 'first-place' },
  { id: 'zap', icon: 'zap', from: '#facc15', to: '#7c3aed', unlock: 'streak-10' },
  { id: 'gem', icon: 'gem', from: '#22d3ee', to: '#7c3aed', unlock: 'discover-100' },
  { id: 'swords', icon: 'swords', from: '#ef4444', to: '#7c3aed', unlock: 'duel-champ' },
  { id: 'star', icon: 'star', from: '#fde047', to: '#ec4899', unlock: 'legend' },
];

export const AVATAR_BY_ID: Record<string, AvatarDef> = Object.fromEntries(AVATARS.map((a) => [a.id, a]));

export interface ThemeDef {
  id: string;
  name: string;
  accent: string; // "r g b"
  soft: string;
  deep: string;
  unlock?: string;
}

export const THEMES: ThemeDef[] = [
  { id: 'violeta', name: 'Violeta', accent: '139 92 246', soft: '196 181 253', deep: '91 33 182' },
  { id: 'ametista', name: 'Ametista', accent: '168 85 247', soft: '233 213 255', deep: '107 33 168' },
  { id: 'neon-rosa', name: 'Neon Rosa', accent: '217 70 239', soft: '245 208 254', deep: '134 25 143', unlock: 'hits-10' },
  { id: 'indigo', name: 'Índigo Elétrico', accent: '99 102 241', soft: '199 210 254', deep: '55 48 163', unlock: 'streak-perfect' },
  { id: 'aurora', name: 'Aurora', accent: '45 212 191', soft: '153 246 228', deep: '17 94 89', unlock: 'survivor' },
  { id: 'ouro', name: 'Ouro', accent: '245 196 81', soft: '254 240 138', deep: '161 98 7', unlock: 'legend' },
];

export const THEME_BY_ID: Record<string, ThemeDef> = Object.fromEntries(THEMES.map((t) => [t.id, t]));
