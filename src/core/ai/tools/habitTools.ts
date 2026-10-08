/** KI-Tools für das Gewohnheiten-Modul (list, log, create, streaks). */
import { z } from 'zod';
import { habitRepository } from '../../db/repositories/habitRepo';
import { defineTools } from '../toolTypes';
import { ok, fail, containsCI, todayDate } from '../toolUtils';

export const habitTools = defineTools([
  {
    name: 'list_habits',
    description: 'Listet alle Gewohnheiten auf.',
    parameters: z.object({}),
    execute: async () => {
      const habits = await habitRepository.getAll();
      const logs = await habitRepository.getLogsForDate(todayDate());
      const loggedIds = new Set(logs.map((l) => l.habitId));
      const summary = habits.map((h) => `- ${loggedIds.has(h.id) ? '✅' : '⬜'} ${h.name}`).join('\n');
      return ok(habits, `Gewohnheiten heute:\n${summary || 'Keine Gewohnheiten'}`);
    },
  },
  {
    name: 'log_habit',
    description: 'Protokolliert eine Gewohnheit für heute als erledigt.',
    parameters: z.object({
      name: z.string().describe('Name der Gewohnheit'),
    }),
    execute: async (args) => {
      const habits = await habitRepository.getAll();
      const found = habits.find((h) => containsCI(h.name, args.name as string));
      if (!found) {
        return fail(`Gewohnheit "${args.name}" nicht gefunden`);
      }
      await habitRepository.logHabit(found.id, todayDate());
      return ok(found, `✅ "${found.name}" für heute erledigt!`);
    },
  },
  {
    name: 'create_habit',
    description: 'Erstellt eine neue Gewohnheit. Die Gewohnheit wird täglich getrackt.',
    parameters: z.object({
      name: z.string().describe('Name der Gewohnheit (z.B. Meditation, Sport, Lesen)'),
      color: z.string().optional().default('#6366f1').describe('Farbe als Hex-Code (z.B. #6366f1)'),
      frequency: z.enum(['daily', 'weekly']).optional().default('daily').describe('Häufigkeit: daily oder weekly'),
    }),
    execute: async (args) => {
      const habit = await habitRepository.create({
        name: args.name as string,
        color: (args.color as string) || '#6366f1',
        frequency: (args.frequency as 'daily' | 'weekly') || 'daily',
        archived: false,
        targetPerWeek: args.frequency === 'weekly' ? 3 : 7,
      });
      return ok(
        habit,
        `✅ Gewohnheit "${habit.name}" erstellt (${habit.frequency === 'daily' ? 'täglich' : 'wöchentlich'})`,
      );
    },
  },
  {
    name: 'get_habit_streaks',
    description: 'Zeigt aktuelle Streaks und Erfolgsquote für alle Gewohnheiten.',
    parameters: z.object({}),
    execute: async () => {
      const habits = await habitRepository.getAll();
      if (habits.length === 0) {
        return ok([], '🔁 Keine Gewohnheiten vorhanden');
      }

      const streaks: { habit: string; currentStreak: number; totalLogs: number }[] = [];

      for (const habit of habits) {
        const logs = await habitRepository.getLogs(habit.id);
        const sortedLogs = logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        let currentStreak = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 0; i < sortedLogs.length; i++) {
          const log = sortedLogs[i];
          if (!log) break;
          const logDate = new Date(log.date);
          logDate.setHours(0, 0, 0, 0);
          const expectedDate = new Date(today);
          expectedDate.setDate(expectedDate.getDate() - i);

          if (logDate.getTime() === expectedDate.getTime()) {
            currentStreak++;
          } else {
            break;
          }
        }

        streaks.push({ habit: habit.name, currentStreak, totalLogs: logs.length });
      }

      const summary = streaks
        .map((s) => {
          const fire = s.currentStreak >= 7 ? '🔥' : s.currentStreak >= 3 ? '✨' : '💪';
          return `• ${fire} ${s.habit}: ${s.currentStreak} Tage Streak (${s.totalLogs} gesamt)`;
        })
        .join('\n');

      return ok(streaks, `🔁 **Gewohnheiten-Streaks:**\n${summary}`);
    },
  },
]);
