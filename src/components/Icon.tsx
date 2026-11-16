import {
  Award, CheckCheck, Crown, Disc, Disc3, Ear, EyeOff, Flame, Gem, Headphones, HeartPulse, Infinity as InfinityIcon,
  Library, Mic, Music, Radio, Shield, SlidersHorizontal, Sparkles, Speaker, Star, Swords, Target, Trophy, Users, Zap,
  type LucideIcon, type LucideProps,
} from 'lucide-react';

const MAP: Record<string, LucideIcon> = {
  disc: Disc, 'disc-3': Disc3, zap: Zap, flame: Flame, infinity: InfinityIcon, swords: Swords, users: Users,
  'eye-off': EyeOff, 'heart-pulse': HeartPulse, sliders: SlidersHorizontal, sparkles: Sparkles, target: Target,
  library: Library, gem: Gem, 'check-check': CheckCheck, mic: Mic, speaker: Speaker, ear: Ear, shield: Shield,
  crown: Crown, trophy: Trophy, headphones: Headphones, music: Music, radio: Radio, star: Star,
};

export function Icon({ name, ...props }: { name: string } & LucideProps) {
  const C = MAP[name] ?? Award;
  return <C {...props} />;
}
