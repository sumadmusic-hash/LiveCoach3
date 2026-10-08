/** Planungs- und Analyse-KI-Tools: nächste Aktion, Tagesplan, Text-Import, Muster. */
import { z } from 'zod';
import { format, isToday, isTomorrow, differenceInDays } from 'date-fns';
import { taskRepository } from '../../db/repositories/taskRepo';
import { habitRepository } from '../../db/repositories/habitRepo';
import { journalRepository } from '../../db/repositories/journalRepo';
import { calendarRepository } from '../../db/repositories';
import type { HabitLog } from '../../schemas';
import { defineTools } from '../toolTypes';
import { ok, fail, todayDate } from '../toolUtils';

/** Datum `days` Tage in der Zukunft als YYYY-MM-DD. */
function daysAhead(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

/** Prioritäts-Gewichtung für Sortierung/Vorschläge (höher = wichtiger). */
const PRIORITY_WEIGHT: Record<string, number> = { urgent: 100, high: 50, medium: 20, low: 5 };

export const planningTools = defineTools([
  {
    name: 'suggest_next_action',
    description:
      'Schlägt die nächste sinnvolle Aktion vor basierend auf Priorität, Fälligkeit und Energie.',
    parameters: z.object({}),
    execute: async () => {
      const tasks = await taskRepository.getAll();
      const openTasks = tasks.filter((t) => !t.completed);

      if (openTasks.length === 0) {
        return ok(null, '✨ Keine offenen Aufgaben – genieße den Tag!');
      }

      const now = new Date();
      const today = todayDate();

      const scored = openTasks.map((t) => {
        let score = PRIORITY_WEIGHT[t.priority] ?? 0;

        if (t.dueAt === today) score += 80;
        else if (t.dueAt && differenceInDays(new Date(t.dueAt), now) < 0) score += 150;
        else if (t.dueAt && differenceInDays(new Date(t.dueAt), now) === 1) score += 60;

        return { task: t, score };
      });

      scored.sort((a, b) => b.score - a.score);
      const top = scored[0];

      if (!top) {
        return ok(null, '✨ Keine priorisierten Aufgaben');
      }

      const dueInfo = top.task.dueAt
        ? isToday(new Date(top.task.dueAt))
          ? ' (heute fällig!)'
          : isTomorrow(new Date(top.task.dueAt))
            ? ' (morgen fällig)'
            : ` (fällig: ${format(new Date(top.task.dueAt), 'dd.MM')})`
        : '';

      return ok(
        top.task,
        `💡 **Nächste Aktion:**\n${top.task.title}${dueInfo}\n\nPriorität: ${top.task.priority}`,
      );
    },
  },
  {
    name: 'plan_day',
    description: 'Erstellt einen Tagesplan aus offenen Aufgaben und Terminen.',
    parameters: z.object({}),
    execute: async () => {
      const [tasks, events] = await Promise.all([taskRepository.getAll(), calendarRepository.getAll()]);
      const openTasks = tasks.filter((t) => !t.completed);
      const today = todayDate();
      const todayEvents = events.filter((e) => new Date(e.startAt).toISOString().slice(0, 10) === today);

      const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
      const prioritized = [...openTasks].sort((a, b) => {
        const aScore = (priorityOrder[a.priority] ?? 4) * 10 + (a.dueAt === today ? -5 : 0);
        const bScore = (priorityOrder[b.priority] ?? 4) * 10 + (b.dueAt === today ? -5 : 0);
        return aScore - bScore;
      });

      let plan = `📋 **Tagesplan für heute:**\n\n`;

      if (todayEvents.length > 0) {
        plan += `📅 **Termine:**\n`;
        todayEvents.forEach((e) => {
          const time = e.allDay ? 'ganztägig' : format(new Date(e.startAt), 'HH:mm');
          plan += `• ${time}: ${e.title}\n`;
        });
        plan += `\n`;
      }

      if (prioritized.length > 0) {
        plan += `✅ **Aufgaben (nach Priorität):**\n`;
        prioritized.slice(0, 5).forEach((t) => {
          const dueInfo = t.dueAt === today ? ' ⚠️' : '';
          plan += `• [${t.priority.toUpperCase()}] ${t.title}${dueInfo}\n`;
        });
      }

      if (openTasks.length === 0 && todayEvents.length === 0) {
        plan += `✨ Keine offenen Aufgaben oder Termine – genieße den Tag!`;
      }

      return ok({ tasks: prioritized.slice(0, 5), events: todayEvents }, plan);
    },
  },
  {
    name: 'import_from_text',
    description:
      'Konvertiert unstrukturierten Text in Aufgaben und Termine. Erkennt Datumsangaben und erstellt entsprechende Einträge.',
    parameters: z.object({
      text: z.string().describe('Unstrukturierter Text mit Aufgaben/Terminen'),
    }),
    execute: async (args) => {
      const text = args.text as string;
      const lines = text.split('\n').filter((l) => l.trim());
      const created: { type: string; title: string }[] = [];

      const datePatterns: { regex: RegExp; getDate: () => string }[] = [
        { regex: /morgen/i, getDate: () => daysAhead(1) },
        { regex: /übermorgen/i, getDate: () => daysAhead(2) },
        { regex: /heute/i, getDate: () => todayDate() },
      ];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        let dueDate: string | undefined;
        let cleanText = trimmed;

        for (const pattern of datePatterns) {
          if (pattern.regex.test(trimmed)) {
            dueDate = pattern.getDate();
            cleanText = trimmed.replace(pattern.regex, '').trim();
            break;
          }
        }

        const dateMatch = trimmed.match(/(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
          dueDate = dateMatch[1];
          cleanText = trimmed.replace(dateMatch[0], '').trim();
        }

        if (cleanText) {
          await taskRepository.create({
            title: cleanText,
            priority: 'medium',
            dueAt: dueDate,
            tags: ['imported'],
            completed: false,
          });
          created.push({ type: 'Aufgabe', title: cleanText });
        }
      }

      if (created.length === 0) {
        return fail('Keine Aufgaben erkannt');
      }

      const summary = created.map((c) => `• ${c.title}`).join('\n');
      return ok(created, `✅ **${created.length} Einträge erstellt:**\n${summary}`);
    },
  },
  {
    name: 'detect_patterns',
    description:
      'Erkennt Muster in deinen Daten: produktivste Tage, Stimmungstrends, Gewohnheits-Streaks.',
    parameters: z.object({}),
    execute: async () => {
      const [tasks, journalEntries, habits] = await Promise.all([
        taskRepository.getAll(),
        journalRepository.getAll(),
        habitRepository.getAll(),
      ]);
      // Logs aller Gewohnheiten der letzten 7 Tage parallel einsammeln
      const logArrays = await Promise.all(habits.map((habit) => habitRepository.getLogs(habit.id)));
      const allLogs: HabitLog[] = logArrays.flat();

      let patterns = `🔍 **Erkannte Muster:**\n\n`;

      // Produktivster Wochentag anhand abgeschlossener Aufgaben
      const completedByDay: Record<string, number> = {};
      tasks
        .filter((t) => t.completed)
        .forEach((t) => {
          const day = format(new Date(t.updatedAt), 'EEEE');
          completedByDay[day] = (completedByDay[day] || 0) + 1;
        });

      const bestDay = Object.entries(completedByDay).sort((a, b) => b[1] - a[1])[0];
      if (bestDay) {
        patterns += `📊 **Produktivster Tag:** ${bestDay[0]} (${bestDay[1]} Aufgaben)\n\n`;
      }

      // Stimmungstrend über die letzten Entries
      if (journalEntries.length >= 3) {
        const recentMoods = journalEntries
          .filter((e) => e.mood)
          .slice(-7)
          .map((e) => e.mood!);

        if (recentMoods.length >= 3) {
          const avg = recentMoods.reduce((a, b) => a + b, 0) / recentMoods.length;
          const trend = avg >= 4 ? 'steigend 😊' : avg >= 3 ? 'stabil 😐' : 'sinkend 😕';
          patterns += `😊 **Stimmungstrend:** ${trend} (Durchschnitt: ${avg.toFixed(1)}/5)\n\n`;
        }
      }

      // Gewohnheits-Konsistenz über die letzten 7 Tage
      if (allLogs.length > 0) {
        const last7Days = new Set(
          Array.from({ length: 7 }, (_, i) => new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)),
        );
        const logsInLast7 = allLogs.filter((l) => last7Days.has(l.date));
        const consistency = ((logsInLast7.length / (7 * Math.max(habits.length, 1))) * 100).toFixed(0);
        patterns += `🔁 **Gewohnheits-Konsistenz:** ${consistency}% (letzte 7 Tage)\n`;
      }

      return ok({ completedByDay, habitConsistency: allLogs.length }, patterns);
    },
  },
]);
