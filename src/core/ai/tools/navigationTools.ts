/** KI-Tools für Navigation und aktuelle Zeit. */
import { z } from 'zod';
import { format } from 'date-fns';
import { moduleRegistry } from '../../modules/ModuleRegistry';
import { defineTools } from '../toolTypes';
import { ok, fail } from '../toolUtils';

export const navigationTools = defineTools([
  {
    name: 'navigate_to',
    description:
      'Navigiert zu einem Modul der App. Verfügbare Module: today, tasks, goals, habits, journal, chat, statistics, calendar, focus, jobs, offers, profile, settings',
    parameters: z.object({
      moduleId: z.string().describe('Die ID des Moduls'),
    }),
    execute: async (args) => {
      const moduleId = args.moduleId as string;
      const mod = moduleRegistry.find((m) => m.id === moduleId);
      if (!mod) {
        return fail(`Unbekanntes Modul: ${moduleId}`);
      }
      return ok({ moduleId, route: mod.route, name: mod.name }, `Navigiere zu ${mod.name}...`);
    },
  },
  {
    name: 'get_current_datetime',
    description:
      'Gibt das aktuelle Datum und die aktuelle Uhrzeit zurück. Nutze dieses Tool, wenn du zeitbezogene Fragen beantworten musst.',
    parameters: z.object({}),
    execute: async () => {
      const now = new Date();
      const date = format(now, 'yyyy-MM-dd');
      const time = format(now, 'HH:mm');
      const weekday = format(now, 'EEEE');
      const weekNumber = format(now, 'I');

      const summary = `📅 **Aktuelles Datum & Uhrzeit**\n\n**Datum:** ${date}\n**Uhrzeit:** ${time}\n**Wochentag:** ${weekday}\n**Kalenderwoche:** ${weekNumber}\n`;

      return ok({ date, time, weekday, weekNumber }, summary);
    },
  },
]);
