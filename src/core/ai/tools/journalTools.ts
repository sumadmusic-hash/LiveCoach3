/** KI-Tools für das Journal-Modul (Eintrag erstellen, listen, Stimmung protokollieren). */
import { z } from 'zod';
import { format } from 'date-fns';
import { journalRepository } from '../../db/repositories/journalRepo';
import { defineTools } from '../toolTypes';
import { ok, fail, containsCI, daysAgo, todayDate } from '../toolUtils';

const MOOD_EMOJIS = ['', '😞', '😕', '😐', '😊', '😄'];

export const journalTools = defineTools([
  {
    name: 'create_journal_entry',
    description: 'Erstellt einen neuen Journal-Eintrag.',
    parameters: z.object({
      content: z.string().describe('Inhalt des Eintrags'),
      mood: z.number().min(1).max(5).optional().describe('Stimmung 1-5'),
      tags: z.array(z.string()).optional().default([]).describe('Tags'),
    }),
    execute: async (args) => {
      const entry = await journalRepository.create({
        date: todayDate(),
        content: args.content as string,
        mood: args.mood as number | undefined,
        tags: (args.tags as string[]) || [],
      });
      return ok(entry, `📝 Journal-Eintrag gespeichert`);
    },
  },
  {
    name: 'list_journal_entries',
    description: 'Listet Journal-Einträge auf. Optional mit Suchbegriff oder Zeitraum.',
    parameters: z.object({
      search: z.string().optional().describe('Suchbegriff'),
      days: z.number().optional().default(30).describe('Zeitraum in Tagen (Standard: 30)'),
    }),
    execute: async (args) => {
      const entries = await journalRepository.getAll();
      const search = args.search as string | undefined;
      const days = (args.days as number) || 30;
      const cutoff = daysAgo(days);

      let filtered = entries.filter((e) => new Date(e.date) >= cutoff);

      if (search) {
        filtered = filtered.filter(
          (e) => containsCI(e.content, search) || e.tags.some((t) => containsCI(t, search)),
        );
      }

      if (filtered.length === 0) {
        return ok([], `📝 Keine Journal-Einträge gefunden`);
      }

      const previewEntries = filtered.slice(0, 10);
      const summary = previewEntries
        .map((e) => {
          const date = format(new Date(e.date), 'dd.MM.yyyy');
          const mood = e.mood ? ` (${e.mood}/5)` : '';
          const preview = e.content.substring(0, 60);
          return `• ${date}${mood}: ${preview}${e.content.length > 60 ? '...' : ''}`;
        })
        .join('\n');

      return ok(
        previewEntries,
        `📝 **Journal-Einträge (letzte ${days} Tage):**\n${summary}${
          filtered.length > 10 ? `\n... und ${filtered.length - 10} weitere` : ''
        }`,
      );
    },
  },
  {
    name: 'log_mood',
    description: 'Schnelle Stimmungs-Regelung (1-5) ohne langen Journal-Eintrag.',
    parameters: z.object({
      mood: z.number().min(1).max(5).describe('Stimmung von 1 (schlecht) bis 5 (super)'),
      note: z.string().optional().describe('Kurze Notiz (optional)'),
    }),
    execute: async (args) => {
      const mood = args.mood as number;
      const note = args.note as string | undefined;
      const emoji = MOOD_EMOJIS[mood] ?? '';

      const entry = await journalRepository.create({
        date: todayDate(),
        content: note || `Stimmung: ${emoji}`,
        mood,
        tags: ['mood-check'],
      });

      return ok(entry, `${emoji} Stimmung ${mood}/5 gespeichert${note ? `: "${note}"` : ''}`);
    },
  },
]);
