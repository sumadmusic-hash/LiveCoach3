import {
  Home, CheckSquare, Target, Repeat, BookOpen, MessageSquare,
  BarChart3, Calendar, Timer, Briefcase, ShoppingBag, User, Settings
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type ModuleId =
  | 'today' | 'tasks' | 'goals' | 'habits' | 'journal' | 'chat'
  | 'statistics' | 'calendar' | 'focus' | 'jobs' | 'offers' | 'profile' | 'settings';

export type ModuleGroup = 'primary' | 'more' | 'hidden';

export interface ModuleDefinition {
  id: ModuleId;
  name: string;
  description: string;
  route: string;
  icon: LucideIcon;
  group: ModuleGroup;
  enabled: boolean;
}

export const moduleRegistry: ModuleDefinition[] = [
  { id: 'today', name: 'Heute', description: 'Tagesübersicht', route: '/today', icon: Home, group: 'primary', enabled: true },
  { id: 'tasks', name: 'Aufgaben', description: 'Aufgaben verwalten', route: '/tasks', icon: CheckSquare, group: 'primary', enabled: true },
  { id: 'goals', name: 'Ziele', description: 'Ziele & Meilensteine', route: '/goals', icon: Target, group: 'primary', enabled: true },
  { id: 'habits', name: 'Gewohnheiten', description: 'Tägliche Routinen', route: '/habits', icon: Repeat, group: 'primary', enabled: true },
  { id: 'journal', name: 'Journal', description: 'Tagebuch & Reflexion', route: '/journal', icon: BookOpen, group: 'primary', enabled: true },
  { id: 'chat', name: 'KI-Chat', description: 'Intelligenter Assistent', route: '/chat', icon: MessageSquare, group: 'primary', enabled: true },
  { id: 'statistics', name: 'Statistiken', description: 'Fortschritt & Analysen', route: '/statistics', icon: BarChart3, group: 'more', enabled: true },
  { id: 'calendar', name: 'Kalender', description: 'Termine & Events', route: '/calendar', icon: Calendar, group: 'more', enabled: true },
  { id: 'focus', name: 'Fokus', description: 'Pomodoro & Deep Work', route: '/focus', icon: Timer, group: 'more', enabled: true },
  { id: 'jobs', name: 'JobBoard', description: 'Bewerbungs-Pipeline', route: '/jobs', icon: Briefcase, group: 'more', enabled: true },
  { id: 'offers', name: 'Angebote', description: 'Preisvergleich & Scanner', route: '/offers', icon: ShoppingBag, group: 'more', enabled: true },
  { id: 'profile', name: 'Profil', description: 'Persönliches Profil', route: '/profile', icon: User, group: 'more', enabled: true },
  { id: 'settings', name: 'Einstellungen', description: 'App-Konfiguration', route: '/settings', icon: Settings, group: 'more', enabled: true },
];

export function getModule(id: ModuleId): ModuleDefinition | undefined {
  return moduleRegistry.find(m => m.id === id);
}

export function getModulesByGroup(group: ModuleGroup): ModuleDefinition[] {
  return moduleRegistry.filter(m => m.group === group && m.enabled);
}

export function validateRegistry(): boolean {
  const ids = moduleRegistry.map(m => m.id);
  const routes = moduleRegistry.map(m => m.route);
  const hasDuplicateIds = new Set(ids).size !== ids.length;
  const hasDuplicateRoutes = new Set(routes).size !== routes.length;
  return !hasDuplicateIds && !hasDuplicateRoutes;
}
