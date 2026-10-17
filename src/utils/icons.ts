import {
  Award,
  BookOpen,
  FolderGit2,
  Github,
  Linkedin,
  Mail,
  Map,
  PenTool,
  Rss,
  Sparkles,
  Terminal,
  User,
} from 'lucide-astro';
import LeetCode from '../components/icons/LeetCode.astro';
import TakeUForward from '../components/icons/TakeUForward.astro';

export const ICONS = {
  Award,
  BookOpen,
  FolderGit2,
  Github,
  LeetCode,
  Linkedin,
  Mail,
  Map,
  PenTool,
  Rss,
  Sparkles,
  TakeUForward,
  Terminal,
  User,
} as const;

export type IconName = keyof typeof ICONS;

export function isIconName(name: string): name is IconName {
  return Object.hasOwn(ICONS, name);
}

export function resolveIcon(name?: string) {
  if (name && isIconName(name)) {
    return ICONS[name];
  }

  return ICONS.Sparkles;
}
