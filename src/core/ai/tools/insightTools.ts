/** Übergreifende KI-Tools: Tagesübersicht, Statistiken, Suche, Wochenrückblick. */
import { z } from 'zod';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { taskRepository } from '../../db/repositories/taskRepo';
import { goalRepository } from '../../db/repositories/goalRepo';
import { habitRepository } from '../../db/repositories/habitRepo';
import { journalRepository } from '../../db/repositories/journalRepo';
import { focusRepository, calendarRepository } from '../../db/repositories';
import { defineTools } from '../toolTypes';
import { ok, containsCI, daysAgo, todayDate } from '../toolUtils';

export const insightTools = defineTools([
  {
    name: 'get_today_summary',
    description:
      'Gibt eine Zusammenfassung des heutigen Tages: offene Aufgaben, fällige Tasks, Gewohnheiten, aktive Ziele.',
    parameters: z.object({}),
    execute: async () => {
      const [tasks, habits, goals] = await Promise.all([
        taskRepository.getAll(),
        habitRepository.getAll(),
        goalRepository.getAll(),
      ]);
      const today = todayDate();
      const todayLogs = await habitRepository.getLogsForDate(today);

      const openTasks = tasks.filter((t) => !t.completed);
      const dueTasks = tasks.filter((t) => t.dueAt === today && !t.completed);
      const activeGoals = goals.filter((g) => g.status === 'active');
      const loggedHabits = new Set(todayLogs.map((l) => l.habitId));

      let summary = `📅 **Zusammenfassung für heute**\n\n`;
      summary += `📋 Offene Aufgaben: ${openTasks.length}\n`;
      if (dueTasks.length > 0) {
        summary += `⚠️ Heute fällig: ${dueTasks.map((t) => t.title).join(', ')}\n`;
      }
      summary += `\n🔁 Gewohnheiten: ${todayLogs.length}/${habits.length} erledigt\n`;
      const missing = habits.filter((h) => !loggedHabits.has(h.id));
      if (missing.length > 0) {
        summary += `Noch offen: ${missing.map((h) => h.name).join(', ')}\n`;
      }
      summary += `\n🎯 Aktive Ziele: ${activeGoals.length}\n`;
      activeGoals.slice(0, 3).forEach((g) => {
        summary += `  - ${g.title}: ${g.progress}%\n`;
      });

      return ok({ openTasks: openTasks.length, dueTasks: dueTasks.length }, summary);
    },
  },
  {
    name: 'get_statistics',
    description: 'Zeigt Statistiken: abgeschlossene Aufgaben, Fokuszeit, Mood-Verlauf.',
    parameters: z.object({
      days: z.number().optional().default(7).describe('Zeitraum in Tagen (Standard: 7)'),
    }),
    execute: async (args) => {
      const days = (args.days as number) || 7;
      const cutoff = daysAgo(days);

      const tasks = await taskRepository.getAll();
      const completedTasks = tasks.filter((t) => t.completed && new Date(t.updatedAt) >= cutoff);

      const focusSessions = await focusRepository.getAll();
      const recentFocus = focusSessions.filter((s) => new Date(s.startedAt) >= cutoff);
      const totalFocusMinutes = recentFocus.reduce((sum, s) => sum + s.duration, 0);

      const journalEntries = await journalRepository.getAll();
      const recentJournal = journalEntries.filter((e) => new Date(e.date) >= cutoff && e.mood);
      const avgMood =
        recentJournal.length > 0
          ? (recentJournal.reduce((sum, e) => sum + (e.mood || 0), 0) / recentJournal.length).toFixed(1)
          : 'N/A';

      let summary = `📊 **Statistiken (letzte ${days} Tage):**\n`;
      summary += `• ✅ Abgeschlossene Aufgaben: ${completedTasks.length}\n`;
      summary += `• ⏱️ Fokuszeit: ${totalFocusMinutes} Minuten\n`;
      summary += `• 😊 Durchschnittliche Stimmung: ${avgMood}/5\n`;
      summary += `• 📝 Journal-Einträge: ${recentJournal.length}`;

      return ok(
        {
          completedTasks: completedTasks.length,
          focusMinutes: totalFocusMinutes,
          avgMood,
          journalEntries: recentJournal.length,
        },
        summary,
      );
    },
  },
  {
    name: 'search_all',
    description: 'Durchsucht alle Daten: Aufgaben, Ziele, Journal, Termine. Gibt relevante Treffer zurück.',
    parameters: z.object({
      query: z.string().describe('Suchbegriff'),
    }),
    execute: async (args) => {
      const query = args.query as string;
      const results: { type: string; title: string; date?: string }[] = [];

      const [tasks, goals, entries, events] = await Promise.all([
        taskRepository.getAll(),
        goalRepository.getAll(),
        journalRepository.getAll(),
        calendarRepository.getAll(),
      ]);

      tasks
        .filter((t) => containsCI(t.title, query) || t.tags.some((tag) => containsCI(tag, query)))
        .forEach((t) => results.push({ type: 'Aufgabe', title: t.title, date: t.dueAt }));

      goals
        .filter((g) => containsCI(g.title, query) || (g.description ? containsCI(g.description, query) : false))
        .forEach((g) => results.push({ type: 'Ziel', title: g.title }));

      entries
        .filter((e) => containsCI(e.content, query) || e.tags.some((t) => containsCI(t, query)))
        .forEach((e) => results.push({ type: 'Journal', title: e.content.substring(0, 50), date: e.date }));

      events
        .filter((e) => containsCI(e.title, query))
        .forEach((e) => results.push({ type: 'Termin', title: e.title, date: e.startAt }));

      if (results.length === 0) {
        return ok([], `🔍 Keine Ergebnisse für "${query}"`);
      }

      const top = results.slice(0, 15);
      const summary = top
        .map((r) => {
          const date = r.date ? ` (${format(new Date(r.date), 'dd.MM')})` : '';
          return `• [${r.type}] ${r.title}${date}`;
        })
        .join('\n');

      return ok(top, `🔍 **Suchergebnisse für "${query}":**\n${summary}`);
    },
  },
  {
    name: 'generate_weekly_review',
    description: 'Erstellt eine automatische Wochenreflexion mit Statistiken und Erkenntnissen.',
    parameters: z.object({}),
    execute: async () => {
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
      const inWeek = (iso: string) => {
        const d = new Date(iso);
        return d >= weekStart && d <= weekEnd;
      };

      const tasks = await taskRepository.getAll();
      const completedThisWeek = tasks.filter((t) => t.completed && inWeek(t.updatedAt));

      const journalEntries = await journalRepository.getAll();
      const thisWeekJournal = journalEntries.filter((e) => inWeek(e.date));

      const avgMood =
        thisWeekJournal.length > 0
          ? (thisWeekJournal.reduce((sum, e) => sum + (e.mood || 0), 0) / thisWeekJournal.length).toFixed(1)
          : 'N/A';

      const focusSessions = await focusRepository.getAll();
      const thisWeekFocus = focusSessions.filter((s) => inWeek(s.startedAt));
      const totalFocusMinutes = thisWeekFocus.reduce((sum, s) => sum + s.duration, 0);

      let review = `📊 **Wochenrückblick**\n\n`;
      review += `✅ **Produktivität:**\n`;
      review += `• ${completedThisWeek.length} Aufgaben abgeschlossen\n`;
      review += `• ${totalFocusMinutes} Minuten Fokuszeit\n\n`;
      review += `😊 **Wohlbefinden:**\n`;
      review += `• ${thisWeekJournal.length} Journal-Einträge\n`;
      review += `• Durchschnittliche Stimmung: ${avgMood}/5\n\n`;

      if (completedThisWeek.length > 0) {
        review += `🏆 **Top-Erfolge:**\n`;
        completedThisWeek.slice(0, 3).forEach((t) => {
          review += `• ${t.title}\n`;
        });
      }

      return ok(
        {
          completedTasks: completedThisWeek.length,
          focusMinutes: totalFocusMinutes,
          journalEntries: thisWeekJournal.length,
          avgMood,
        },
        review,
      );
    },
  },
]);
