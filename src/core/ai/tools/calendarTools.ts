/** KI-Tools für das Kalender-Modul. */
import { z } from 'zod';
import { format } from 'date-fns';
import { calendarRepository } from '../../db/repositories';
import { defineTools } from '../toolTypes';
import { ok } from '../toolUtils';

export const calendarTools = defineTools([
  {
    name: 'create_calendar_event',
    description: 'Erstellt einen neuen Kalendereintrag.',
    parameters: z.object({
      title: z.string().describe('Titel des Termins'),
      date: z.string().describe('Datum im Format YYYY-MM-DD'),
    }),
    execute: async (args) => {
      const event = await calendarRepository.create({
        title: args.title as string,
        startAt: new Date(args.date as string).toISOString(),
        allDay: true,
        recurrence: 'none',
        color: '#3b82f6',
      });
      return ok(event, `📅 Termin "${event.title}" am ${args.date} erstellt`);
    },
  },
  {
    name: 'list_calendar_events',
    description: 'Listet alle Kalendetermine auf. Optional für einen bestimmten Zeitraum.',
    parameters: z.object({
      days: z.number().optional().default(7).describe('Anzahl der Tage in die Zukunft (Standard: 7)'),
    }),
    execute: async (args) => {
      const events = await calendarRepository.getAll();
      const now = new Date();
      const days = (args.days as number) || 7;
      const untilDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

      const upcoming = events
        .filter((e) => {
          const eventDate = new Date(e.startAt);
          return eventDate >= now && eventDate <= untilDate;
        })
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

      if (upcoming.length === 0) {
        return ok([], `📅 Keine Termine in den nächsten ${days} Tagen`);
      }

      const summary = upcoming
        .map((e) => {
          const date = format(new Date(e.startAt), 'dd.MM.yyyy');
          const time = e.allDay ? 'ganztägig' : format(new Date(e.startAt), 'HH:mm');
          return `• ${date} ${time}: ${e.title}`;
        })
        .join('\n');

      return ok(upcoming, `📅 **Termine (nächste ${days} Tage):**\n${summary}`);
    },
  },
]);
