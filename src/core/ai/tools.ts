import { z } from 'zod';
import { taskRepository } from '../db/repositories/taskRepo';
import { goalRepository } from '../db/repositories/goalRepo';
import { habitRepository } from '../db/repositories/habitRepo';
import { journalRepository } from '../db/repositories/journalRepo';
import { jobRepository, calendarRepository, profileRepository, focusRepository } from '../db/repositories';
import { moduleRegistry, type ModuleId } from '../modules/ModuleRegistry';
import type { Priority, JobPhase, Task, Goal, Habit, HabitLog, JournalEntry, CalendarEvent, FocusSession, JobApplication } from '../schemas';
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval, isToday, isTomorrow, isThisWeek, parseISO, differenceInDays } from 'date-fns';

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  displayMessage?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodType<Record<string, unknown>>;
  execute: (args: Record<string, unknown>) => Promise<ToolResult>;
}

// ============ TOOL DEFINITIONS ============

export const tools: ToolDefinition[] = [
  {
    name: 'navigate_to',
    description: 'Navigiert zu einem Modul der App. Verfügbare Module: today, tasks, goals, habits, journal, chat, statistics, calendar, focus, jobs, offers, profile, settings',
    parameters: z.object({
      moduleId: z.string().describe('Die ID des Moduls'),
    }),
    execute: async (args) => {
      const moduleId = args.moduleId as string;
      const mod = moduleRegistry.find(m => m.id === moduleId);
      if (!mod) {
        return { success: false, error: `Unbekanntes Modul: ${moduleId}` };
      }
      return { 
        success: true, 
        data: { moduleId, route: mod.route, name: mod.name },
        displayMessage: `Navigiere zu ${mod.name}...`
      };
    },
  },
  {
    name: 'list_tasks',
    description: 'Listet alle offenen Aufgaben auf. Optional gefiltert nach Status.',
    parameters: z.object({
      includeCompleted: z.boolean().optional().default(false).describe('Auch erledigte Aufgaben anzeigen'),
    }),
    execute: async (args) => {
      const includeCompleted = args.includeCompleted as boolean | undefined;
      const tasks = await taskRepository.getAll();
      const filtered = includeCompleted ? tasks : tasks.filter(t => !t.completed);
      const summary = filtered.slice(0, 20).map(t => 
        `- ${t.completed ? '✅' : '⬜'} ${t.title} [${t.priority}]${t.dueAt ? ` (fällig: ${t.dueAt})` : ''}`
      ).join('\n');
      return { 
        success: true, 
        data: filtered,
        displayMessage: `${filtered.length} Aufgaben gefunden:\n${summary}${filtered.length > 20 ? '\n... und weitere' : ''}`
      };
    },
  },
  {
    name: 'create_task',
    description: 'Erstellt eine neue Aufgabe.',
    parameters: z.object({
      title: z.string().describe('Titel der Aufgabe'),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium').describe('Priorität'),
      dueAt: z.string().optional().describe('Fälligkeitsdatum im Format YYYY-MM-DD'),
      tags: z.array(z.string()).optional().default([]).describe('Tags'),
    }),
    execute: async (args) => {
      const task = await taskRepository.create({
        title: args.title as string,
        priority: (args.priority as Priority) || 'medium',
        dueAt: args.dueAt as string | undefined,
        tags: (args.tags as string[]) || [],
        completed: false,
      });
      return { 
        success: true, 
        data: task,
        displayMessage: `✅ Aufgabe "${task.title}" erstellt (Priorität: ${task.priority})`
      };
    },
  },
  {
    name: 'complete_task',
    description: 'Markiert eine Aufgabe als erledigt. Finde die Aufgabe anhand des Titels.',
    parameters: z.object({
      title: z.string().describe('Titel der Aufgabe (oder Teil davon)'),
    }),
    execute: async (args) => {
      const search = (args.title as string).toLowerCase();
      const tasks = await taskRepository.getAll();
      const found = tasks.find(t => !t.completed && t.title.toLowerCase().includes(search));
      if (!found) {
        return { success: false, error: `Keine offene Aufgabe mit "${args.title}" gefunden` };
      }
      await taskRepository.complete(found.id);
      return { 
        success: true, 
        data: found,
        displayMessage: `✅ "${found.title}" als erledigt markiert!`
      };
    },
  },
  {
    name: 'delete_task',
    description: 'Löscht eine Aufgabe anhand des Titels.',
    parameters: z.object({
      title: z.string().describe('Titel der Aufgabe'),
    }),
    execute: async (args) => {
      const search = (args.title as string).toLowerCase();
      const tasks = await taskRepository.getAll();
      const found = tasks.find(t => t.title.toLowerCase().includes(search));
      if (!found) {
        return { success: false, error: `Keine Aufgabe mit "${args.title}" gefunden` };
      }
      await taskRepository.softDelete(found.id);
      return { 
        success: true, 
        data: found,
        displayMessage: `🗑️ "${found.title}" gelöscht`
      };
    },
  },
  {
    name: 'list_goals',
    description: 'Listet alle Ziele auf.',
    parameters: z.object({}),
    execute: async () => {
      const goals = await goalRepository.getAll();
      const summary = goals.map(g => `- ${g.title}: ${g.progress}% (${g.status})`).join('\n');
      return { 
        success: true, 
        data: goals,
        displayMessage: `${goals.length} Ziele:\n${summary || 'Keine Ziele vorhanden'}`
      };
    },
  },
  {
    name: 'create_goal',
    description: 'Erstellt ein neues Ziel.',
    parameters: z.object({
      title: z.string().describe('Titel des Ziels'),
      description: z.string().optional().describe('Beschreibung'),
      dueAt: z.string().optional().describe('Fälligkeitsdatum YYYY-MM-DD'),
    }),
    execute: async (args) => {
      const goal = await goalRepository.create({
        title: args.title as string,
        description: args.description as string | undefined,
        dueAt: args.dueAt as string | undefined,
        progress: 0,
        status: 'active',
        milestones: [],
      });
      return { 
        success: true, 
        data: goal,
        displayMessage: `🎯 Ziel "${goal.title}" erstellt!`
      };
    },
  },
  {
    name: 'update_goal_progress',
    description: 'Aktualisiert den Fortschritt eines Ziels.',
    parameters: z.object({
      title: z.string().describe('Titel des Ziels'),
      progress: z.number().min(0).max(100).describe('Neuer Fortschritt in Prozent'),
    }),
    execute: async (args) => {
      const search = (args.title as string).toLowerCase();
      const goals = await goalRepository.getAll();
      const found = goals.find(g => g.title.toLowerCase().includes(search));
      if (!found) {
        return { success: false, error: `Ziel "${args.title}" nicht gefunden` };
      }
      await goalRepository.update(found.id, { progress: args.progress as number });
      return { 
        success: true, 
        data: found,
        displayMessage: `📈 "${found.title}" jetzt bei ${args.progress}%`
      };
    },
  },
  {
    name: 'list_habits',
    description: 'Listet alle Gewohnheiten auf.',
    parameters: z.object({}),
    execute: async () => {
      const habits = await habitRepository.getAll();
      const today = format(new Date(), 'yyyy-MM-dd');
      const logs = await habitRepository.getLogsForDate(today);
      const loggedIds = new Set(logs.map(l => l.habitId));
      const summary = habits.map(h => `- ${loggedIds.has(h.id) ? '✅' : '⬜'} ${h.name}`).join('\n');
      return { 
        success: true, 
        data: habits,
        displayMessage: `Gewohnheiten heute:\n${summary || 'Keine Gewohnheiten'}`
      };
    },
  },
  {
    name: 'log_habit',
    description: 'Protokolliert eine Gewohnheit für heute als erledigt.',
    parameters: z.object({
      name: z.string().describe('Name der Gewohnheit'),
    }),
    execute: async (args) => {
      const search = (args.name as string).toLowerCase();
      const habits = await habitRepository.getAll();
      const found = habits.find(h => h.name.toLowerCase().includes(search));
      if (!found) {
        return { success: false, error: `Gewohnheit "${args.name}" nicht gefunden` };
      }
      const today = format(new Date(), 'yyyy-MM-dd');
      await habitRepository.logHabit(found.id, today);
      return { 
        success: true, 
        data: found,
        displayMessage: `✅ "${found.name}" für heute erledigt!`
      };
    },
  },
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
        date: format(new Date(), 'yyyy-MM-dd'),
        content: args.content as string,
        mood: args.mood as number | undefined,
        tags: (args.tags as string[]) || [],
      });
      return { 
        success: true, 
        data: entry,
        displayMessage: `📝 Journal-Eintrag gespeichert`
      };
    },
  },
  {
    name: 'get_today_summary',
    description: 'Gibt eine Zusammenfassung des heutigen Tages: offene Aufgaben, fällige Tasks, Gewohnheiten, aktive Ziele.',
    parameters: z.object({}),
    execute: async () => {
      const tasks = await taskRepository.getAll();
      const habits = await habitRepository.getAll();
      const goals = await goalRepository.getAll();
      const today = format(new Date(), 'yyyy-MM-dd');
      const todayLogs = await habitRepository.getLogsForDate(today);
      
      const openTasks = tasks.filter(t => !t.completed);
      const dueTasks = tasks.filter(t => t.dueAt === today && !t.completed);
      const activeGoals = goals.filter(g => g.status === 'active');
      const loggedHabits = new Set(todayLogs.map(l => l.habitId));
      
      let summary = `📅 **Zusammenfassung für heute**\n\n`;
      summary += `📋 Offene Aufgaben: ${openTasks.length}\n`;
      if (dueTasks.length > 0) {
        summary += `⚠️ Heute fällig: ${dueTasks.map(t => t.title).join(', ')}\n`;
      }
      summary += `\n🔁 Gewohnheiten: ${todayLogs.length}/${habits.length} erledigt\n`;
      if (habits.length > 0) {
        const missing = habits.filter(h => !loggedHabits.has(h.id));
        if (missing.length > 0) {
          summary += `Noch offen: ${missing.map(h => h.name).join(', ')}\n`;
        }
      }
      summary += `\n🎯 Aktive Ziele: ${activeGoals.length}\n`;
      activeGoals.slice(0, 3).forEach(g => {
        summary += `  - ${g.title}: ${g.progress}%\n`;
      });
      
      return { success: true, data: { openTasks: openTasks.length, dueTasks: dueTasks.length }, displayMessage: summary };
    },
  },
  {
    name: 'list_job_applications',
    description: 'Listet alle Bewerbungen auf.',
    parameters: z.object({}),
    execute: async () => {
      const jobs = await jobRepository.getAll();
      const byPhase: Record<string, string[]> = {};
      jobs.forEach(j => {
        if (!byPhase[j.phase]) byPhase[j.phase] = [];
        byPhase[j.phase]!.push(`${j.role} @ ${j.company}`);
      });
      let summary = `💼 Bewerbungen (${jobs.length}):\n`;
      Object.entries(byPhase).forEach(([phase, items]) => {
        summary += `\n**${phase}** (${items.length}):\n`;
        items.forEach(i => summary += `  - ${i}\n`);
      });
      return { success: true, data: jobs, displayMessage: summary };
    },
  },
  {
    name: 'create_job_application',
    description: 'Erstellt eine neue Bewerbung.',
    parameters: z.object({
      company: z.string().describe('Firmenname'),
      role: z.string().describe('Rolle/Position'),
      url: z.string().optional().describe('Link zur Stelle'),
      salary: z.string().optional().describe('Gehalt'),
    }),
    execute: async (args) => {
      const job = await jobRepository.create({
        company: args.company as string,
        role: args.role as string,
        url: args.url as string | undefined,
        salary: args.salary as string | undefined,
        phase: 'research',
        notes: [],
        history: [],
      });
      return { 
        success: true, 
        data: job,
        displayMessage: `💼 Bewerbung bei ${job.company} als ${job.role} erstellt`
      };
    },
  },
  {
    name: 'update_job_phase',
    description: 'Ändert die Phase einer Bewerbung (research, applied, interview, offer, rejected, closed).',
    parameters: z.object({
      company: z.string().describe('Firmenname'),
      phase: z.enum(['research', 'applied', 'interview', 'offer', 'rejected', 'closed']).describe('Neue Phase'),
    }),
    execute: async (args) => {
      const search = (args.company as string).toLowerCase();
      const jobs = await jobRepository.getAll();
      const found = jobs.find(j => j.company.toLowerCase().includes(search));
      if (!found) {
        return { success: false, error: `Bewerbung bei "${args.company}" nicht gefunden` };
      }
      await jobRepository.update(found.id, { phase: args.phase as JobPhase });
      return { 
        success: true, 
        data: found,
        displayMessage: `✅ ${found.company} → Phase: ${args.phase}`
      };
    },
  },
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
      return { 
        success: true, 
        data: event,
        displayMessage: `📅 Termin "${event.title}" am ${args.date} erstellt`
      };
    },
  },
  {
    name: 'get_user_profile',
    description: 'Liest das Benutzerprofil. Zeigt Name, Werte, Energiezeiten, Stressfaktoren, Kommunikationsstil und Interessen.',
    parameters: z.object({}),
    execute: async () => {
      const profile = await profileRepository.get();
      if (!profile) {
        return { 
          success: true, 
          displayMessage: '👤 Profil ist leer. Nutze update_user_profile um es zu füllen.'
        };
      }
      let summary = `👤 **Profil**\n\n`;
      summary += profile.name ? `**Name:** ${profile.name}\n` : '**Name:** (nicht gesetzt)\n';
      summary += profile.values.length > 0 ? `**Werte:** ${profile.values.join(', ')}\n` : '**Werte:** (nicht gesetzt)\n';
      summary += profile.energyTimes.length > 0 ? `**Energiezeiten:** ${profile.energyTimes.join(', ')}\n` : '**Energiezeiten:** (nicht gesetzt)\n';
      summary += profile.stressFactors.length > 0 ? `**Stressfaktoren:** ${profile.stressFactors.join(', ')}\n` : '**Stressfaktoren:** (nicht gesetzt)\n';
      summary += `**Kommunikationsstil:** ${profile.communicationStyle}\n`;
      summary += profile.interests.length > 0 ? `**Interessen:** ${profile.interests.join(', ')}\n` : '**Interessen:** (nicht gesetzt)\n';
      return { 
        success: true, 
        data: profile,
        displayMessage: summary
      };
    },
  },
  {
    name: 'update_user_profile',
    description: 'Aktualisiert das Benutzerprofil. Kann einzelne Felder setzen oder ergänzen. Wenn Felder fehlen, können sie hier gesetzt werden.',
    parameters: z.object({
      name: z.string().optional().describe('Name des Benutzers'),
      values: z.array(z.string()).optional().describe('Persönliche Werte (z.B. Familie, Gesundheit, Lernen)'),
      energyTimes: z.array(z.string()).optional().describe('Zeiten mit hoher Energie (z.B. Morgens 8-11)'),
      stressFactors: z.array(z.string()).optional().describe('Stressfaktoren (z.B. Zeitdruck, Unklarheit)'),
      communicationStyle: z.enum(['balanced', 'direct', 'warm', 'analytical']).optional().describe('Bevorzugter Kommunikationsstil'),
      interests: z.array(z.string()).optional().describe('Interessen/Hobbys'),
    }),
    execute: async (args) => {
      const updates: Record<string, unknown> = {};
      const changes: string[] = [];
      
      if (args.name !== undefined) {
        updates.name = args.name;
        changes.push(`Name: ${args.name}`);
      }
      if (args.values !== undefined) {
        updates.values = args.values;
        changes.push(`Werte: ${(args.values as string[]).join(', ')}`);
      }
      if (args.energyTimes !== undefined) {
        updates.energyTimes = args.energyTimes;
        changes.push(`Energiezeiten: ${(args.energyTimes as string[]).join(', ')}`);
      }
      if (args.stressFactors !== undefined) {
        updates.stressFactors = args.stressFactors;
        changes.push(`Stressfaktoren: ${(args.stressFactors as string[]).join(', ')}`);
      }
      if (args.communicationStyle !== undefined) {
        updates.communicationStyle = args.communicationStyle;
        changes.push(`Kommunikationsstil: ${args.communicationStyle}`);
      }
      if (args.interests !== undefined) {
        updates.interests = args.interests;
        changes.push(`Interessen: ${(args.interests as string[]).join(', ')}`);
      }
      
      if (Object.keys(updates).length === 0) {
        return { success: false, error: 'Keine Felder zum Aktualisieren angegeben' };
      }
      
      await profileRepository.save(updates);
      return { 
        success: true, 
        data: updates,
        displayMessage: `✅ Profil aktualisiert:\n${changes.map(c => `  • ${c}`).join('\n')}`
      };
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
      return { 
        success: true, 
        data: habit,
        displayMessage: `✅ Gewohnheit "${habit.name}" erstellt (${habit.frequency === 'daily' ? 'täglich' : 'wöchentlich'})`
      };
    },
  },
  {
    name: 'get_current_datetime',
    description: 'Gibt das aktuelle Datum und die aktuelle Uhrzeit zurück. Nutze dieses Tool, wenn du zeitbezogene Fragen beantworten musst.',
    parameters: z.object({}),
    execute: async () => {
      const now = new Date();
      const date = format(now, 'yyyy-MM-dd');
      const time = format(now, 'HH:mm');
      const weekday = format(now, 'EEEE');
      const weekNumber = format(now, 'I');
      
      const summary = `📅 **Aktuelles Datum & Uhrzeit**\n\n**Datum:** ${date}\n**Uhrzeit:** ${time}\n**Wochentag:** ${weekday}\n**Kalenderwoche:** ${weekNumber}\n`;
      
      return { 
        success: true, 
        data: { date, time, weekday, weekNumber },
        displayMessage: summary
      };
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
      const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      
      const upcoming = events
        .filter(e => {
          const eventDate = new Date(e.startAt);
          return eventDate >= now && eventDate <= futureDate;
        })
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
      
      if (upcoming.length === 0) {
        return { success: true, data: [], displayMessage: `📅 Keine Termine in den nächsten ${days} Tagen` } as const;
      }
      
      const summary = upcoming.map(e => {
        const date = format(new Date(e.startAt), 'dd.MM.yyyy');
        const time = e.allDay ? 'ganztägig' : format(new Date(e.startAt), 'HH:mm');
        return `• ${date} ${time}: ${e.title}`;
      }).join('\n');
      
      return { 
        success: true, 
        data: upcoming,
        displayMessage: `📅 **Termine (nächste ${days} Tage):**\n${summary}`
      };
    },
  },
  {
    name: 'update_task',
    description: 'Bearbeitet eine bestehende Aufgabe. Kann Titel, Priorität, Fälligkeitsdatum oder Tags ändern.',
    parameters: z.object({
      taskId: z.string().describe('ID der Aufgabe'),
      title: z.string().optional().describe('Neuer Titel'),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().describe('Neue Priorität'),
      dueAt: z.string().optional().describe('Neues Fälligkeitsdatum (YYYY-MM-DD)'),
      tags: z.array(z.string()).optional().describe('Neue Tags'),
    }),
    execute: async (args) => {
      const taskId = args.taskId as string;
      const updates: Partial<Task> = {};
      const changes: string[] = [];
      
      if (args.title) {
        updates.title = args.title as string;
        changes.push(`Titel: ${args.title}`);
      }
      if (args.priority) {
        updates.priority = args.priority as Priority;
        changes.push(`Priorität: ${args.priority}`);
      }
      if (args.dueAt) {
        updates.dueAt = args.dueAt as string;
        changes.push(`Fällig: ${args.dueAt}`);
      }
      if (args.tags) {
        updates.tags = args.tags as string[];
        changes.push(`Tags: ${(args.tags as string[]).join(', ')}`);
      }
      
      if (Object.keys(updates).length === 0) {
        return { success: false, error: 'Keine Änderungen angegeben' };
      }
      
      const updated = await taskRepository.update(taskId, updates);
      if (!updated) {
        return { success: false, error: 'Aufgabe nicht gefunden' };
      }
      
      return { 
        success: true, 
        data: updated,
        displayMessage: `✅ Aufgabe aktualisiert:\n${changes.map(c => `  • ${c}`).join('\n')}`
      };
    },
  },
  {
    name: 'delete_goal',
    description: 'Löscht ein Ziel vollständig.',
    parameters: z.object({
      goalId: z.string().describe('ID des Ziels'),
    }),
    execute: async (args) => {
      const goalId = args.goalId as string;
      const goal = await goalRepository.getById(goalId);
      if (!goal) {
        return { success: false, error: 'Ziel nicht gefunden' };
      }
      
      await goalRepository.delete(goalId);
      return { 
        success: true, 
        data: goal,
        displayMessage: `🗑️ Ziel "${goal.title}" gelöscht`
      };
    },
  },
  {
    name: 'complete_goal',
    description: 'Markiert ein Ziel als abgeschlossen (100% Fortschritt).',
    parameters: z.object({
      goalId: z.string().describe('ID des Ziels'),
    }),
    execute: async (args) => {
      const goalId = args.goalId as string;
      const goal = await goalRepository.getById(goalId);
      if (!goal) {
        return { success: false, error: 'Ziel nicht gefunden' };
      }
      
      await goalRepository.update(goalId, { progress: 100, status: 'completed' });
      return { 
        success: true, 
        data: goal,
        displayMessage: `🎉 Ziel "${goal.title}" als abgeschlossen markiert!`
      };
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
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      let filtered = entries.filter(e => new Date(e.date) >= cutoff);
      
      if (search) {
        const searchLower = search.toLowerCase();
        filtered = filtered.filter(e => 
          e.content.toLowerCase().includes(searchLower) ||
          e.tags.some(t => t.toLowerCase().includes(searchLower))
        );
      }
      
      if (filtered.length === 0) {
        return { success: true, data: [], displayMessage: `📝 Keine Journal-Einträge gefunden` };
      }
      
      const summary = filtered.slice(0, 10).map(e => {
        const date = format(new Date(e.date), 'dd.MM.yyyy');
        const mood = e.mood ? ` (${e.mood}/5)` : '';
        const preview = e.content.substring(0, 60);
        return `• ${date}${mood}: ${preview}${e.content.length > 60 ? '...' : ''}`;
      }).join('\n');
      
      return { 
        success: true, 
        data: filtered.slice(0, 10),
        displayMessage: `📝 **Journal-Einträge (letzte ${days} Tage):**\n${summary}${filtered.length > 10 ? `\n... und ${filtered.length - 10} weitere` : ''}`
      };
    },
  },
  {
    name: 'get_habit_streaks',
    description: 'Zeigt aktuelle Streaks und Erfolgsquote für alle Gewohnheiten.',
    parameters: z.object({}),
    execute: async () => {
      const habits = await habitRepository.getAll();
      if (habits.length === 0) {
        return { success: true, data: [], displayMessage: '🔁 Keine Gewohnheiten vorhanden' };
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
        
        streaks.push({
          habit: habit.name,
          currentStreak,
          totalLogs: logs.length,
        });
      }
      
      const summary = streaks.map(s => {
        const fire = s.currentStreak >= 7 ? '🔥' : s.currentStreak >= 3 ? '✨' : '💪';
        return `• ${fire} ${s.habit}: ${s.currentStreak} Tage Streak (${s.totalLogs} gesamt)`;
      }).join('\n');
      
      return { 
        success: true, 
        data: streaks,
        displayMessage: `🔁 **Gewohnheiten-Streaks:**\n${summary}`
      };
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
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      const tasks = await taskRepository.getAll();
      const completedTasks = tasks.filter(t => t.completed && new Date(t.updatedAt) >= cutoff);
      
      const focusSessions = await focusRepository.getAll();
      const recentFocus = focusSessions.filter(s => new Date(s.startedAt) >= cutoff);
      const totalFocusMinutes = recentFocus.reduce((sum, s) => sum + s.duration, 0);
      
      const journalEntries = await journalRepository.getAll();
      const recentJournal = journalEntries.filter(e => new Date(e.date) >= cutoff && e.mood);
      const avgMood = recentJournal.length > 0
        ? (recentJournal.reduce((sum, e) => sum + (e.mood || 0), 0) / recentJournal.length).toFixed(1)
        : 'N/A';
      
      let summary = `📊 **Statistiken (letzte ${days} Tage):**\n`;
      summary += `• ✅ Abgeschlossene Aufgaben: ${completedTasks.length}\n`;
      summary += `• ⏱️ Fokuszeit: ${totalFocusMinutes} Minuten\n`;
      summary += `• 😊 Durchschnittliche Stimmung: ${avgMood}/5\n`;
      summary += `• 📝 Journal-Einträge: ${recentJournal.length}`;
      
      return { 
        success: true, 
        data: { completedTasks: completedTasks.length, focusMinutes: totalFocusMinutes, avgMood, journalEntries: recentJournal.length },
        displayMessage: summary
      };
    },
  },
  {
    name: 'update_job_application',
    description: 'Aktualisiert eine Bewerbung: Phase ändern, Notizen hinzufügen, Gehalt aktualisieren.',
    parameters: z.object({
      jobId: z.string().describe('ID der Bewerbung'),
      phase: z.enum(['research', 'applied', 'interview', 'offer', 'rejected', 'closed']).optional().describe('Neue Phase'),
      notes: z.array(z.string()).optional().describe('Notizen hinzufügen'),
      salary: z.string().optional().describe('Gehaltsinformation'),
    }),
    execute: async (args) => {
      const jobId = args.jobId as string;
      const updates: Partial<JobApplication> = {};
      const changes: string[] = [];
      
      if (args.phase) {
        updates.phase = args.phase as JobPhase;
        changes.push(`Phase: ${args.phase}`);
      }
      if (args.notes) {
        const job = await jobRepository.getById(jobId);
        if (job) {
          updates.notes = [...(job.notes || []), ...(args.notes as string[])];
          changes.push(`Notizen: ${(args.notes as string[]).length} hinzugefügt`);
        }
      }
      if (args.salary) {
        updates.salary = args.salary as string;
        changes.push(`Gehalt: ${args.salary}`);
      }
      
      if (Object.keys(updates).length === 0) {
        return { success: false, error: 'Keine Änderungen angegeben' };
      }
      
      const updated = await jobRepository.update(jobId, updates);
      if (!updated) {
        return { success: false, error: 'Bewerbung nicht gefunden' };
      }
      
      return { 
        success: true, 
        data: updated,
        displayMessage: `✅ Bewerbung aktualisiert:\n${changes.map(c => `  • ${c}`).join('\n')}`
      };
    },
  },
  {
    name: 'set_reminder',
    description: 'Erstellt eine Erinnerung als Aufgabe mit Tag "reminder".',
    parameters: z.object({
      text: z.string().describe('Erinnerungstext'),
      dueAt: z.string().describe('Fälligkeitsdatum (YYYY-MM-DD)'),
    }),
    execute: async (args) => {
      const task = await taskRepository.create({
        title: `⏰ ${args.text}`,
        priority: 'medium',
        dueAt: args.dueAt as string,
        tags: ['reminder'],
        completed: false,
      });
      
      return { 
        success: true, 
        data: task,
        displayMessage: `⏰ Erinnerung gesetzt: "${args.text}" am ${args.dueAt}`
      };
    },
  },
  {
    name: 'search_all',
    description: 'Durchsucht alle Daten: Aufgaben, Ziele, Journal, Termine. Gibt relevante Treffer zurück.',
    parameters: z.object({
      query: z.string().describe('Suchbegriff'),
    }),
    execute: async (args) => {
      const query = (args.query as string).toLowerCase();
      const results: { type: string; title: string; date?: string }[] = [];
      
      const tasks = await taskRepository.getAll();
      tasks.filter(t => t.title.toLowerCase().includes(query) || t.tags.some(tag => tag.toLowerCase().includes(query)))
        .forEach(t => results.push({ type: 'Aufgabe', title: t.title, date: t.dueAt }));
      
      const goals = await goalRepository.getAll();
      goals.filter(g => g.title.toLowerCase().includes(query) || g.description?.toLowerCase().includes(query))
        .forEach(g => results.push({ type: 'Ziel', title: g.title }));
      
      const entries = await journalRepository.getAll();
      entries.filter(e => e.content.toLowerCase().includes(query) || e.tags.some(t => t.toLowerCase().includes(query)))
        .forEach(e => results.push({ type: 'Journal', title: e.content.substring(0, 50), date: e.date }));
      
      const events = await calendarRepository.getAll();
      events.filter(e => e.title.toLowerCase().includes(query))
        .forEach(e => results.push({ type: 'Termin', title: e.title, date: e.startAt }));
      
      if (results.length === 0) {
        return { success: true, data: [], displayMessage: `🔍 Keine Ergebnisse für "${args.query}"` };
      }
      
      const summary = results.slice(0, 15).map(r => {
        const date = r.date ? ` (${format(new Date(r.date), 'dd.MM')})` : '';
        return `• [${r.type}] ${r.title}${date}`;
      }).join('\n');
      
      return { 
        success: true, 
        data: results.slice(0, 15),
        displayMessage: `🔍 **Suchergebnisse für "${args.query}":**\n${summary}`
      };
    },
  },
  {
    name: 'generate_weekly_review',
    description: 'Erstellt eine automatische Wochenreflexion mit Statistiken und Erkenntnissen.',
    parameters: z.object({}),
    execute: async () => {
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
      
      const tasks = await taskRepository.getAll();
      const completedThisWeek = tasks.filter(t => {
        const updated = new Date(t.updatedAt);
        return t.completed && updated >= weekStart && updated <= weekEnd;
      });
      
      const journalEntries = await journalRepository.getAll();
      const thisWeekJournal = journalEntries.filter(e => {
        const date = new Date(e.date);
        return date >= weekStart && date <= weekEnd;
      });
      
      const avgMood = thisWeekJournal.length > 0
        ? (thisWeekJournal.reduce((sum, e) => sum + (e.mood || 0), 0) / thisWeekJournal.length).toFixed(1)
        : 'N/A';
      
      const focusSessions = await focusRepository.getAll();
      const thisWeekFocus = focusSessions.filter(s => {
        const started = new Date(s.startedAt);
        return started >= weekStart && started <= weekEnd;
      });
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
        completedThisWeek.slice(0, 3).forEach(t => {
          review += `• ${t.title}\n`;
        });
      }
      
      return { 
        success: true, 
        data: { completedTasks: completedThisWeek.length, focusMinutes: totalFocusMinutes, journalEntries: thisWeekJournal.length, avgMood },
        displayMessage: review
      };
    },
  },
  {
    name: 'suggest_next_action',
    description: 'Schlägt die nächste sinnvolle Aktion vor basierend auf Priorität, Fälligkeit und Energie.',
    parameters: z.object({}),
    execute: async () => {
      const tasks = await taskRepository.getAll();
      const openTasks = tasks.filter(t => !t.completed);
      
      if (openTasks.length === 0) {
        return { success: true, data: null, displayMessage: '✨ Keine offenen Aufgaben – genieße den Tag!' };
      }
      
      const now = new Date();
      const today = format(now, 'yyyy-MM-dd');
      
      const scored = openTasks.map(t => {
        let score = 0;
        if (t.priority === 'urgent') score += 100;
        else if (t.priority === 'high') score += 50;
        else if (t.priority === 'medium') score += 20;
        else score += 5;
        
        if (t.dueAt === today) score += 80;
        else if (t.dueAt && differenceInDays(new Date(t.dueAt), now) < 0) score += 150;
        else if (t.dueAt && differenceInDays(new Date(t.dueAt), now) === 1) score += 60;
        
        return { task: t, score };
      });
      
      scored.sort((a, b) => b.score - a.score);
      const top = scored[0];
      
      if (!top) {
        return { success: true, data: null, displayMessage: '✨ Keine priorisierten Aufgaben' };
      }
      
      const dueInfo = top.task.dueAt 
        ? isToday(new Date(top.task.dueAt)) ? ' (heute fällig!)' 
        : isTomorrow(new Date(top.task.dueAt)) ? ' (morgen fällig)'
        : ` (fällig: ${format(new Date(top.task.dueAt), 'dd.MM')})`
        : '';
      
      return { 
        success: true, 
        data: top.task,
        displayMessage: `💡 **Nächste Aktion:**\n${top.task.title}${dueInfo}\n\nPriorität: ${top.task.priority}`
      };
    },
  },
  {
    name: 'breakdown_goal',
    description: 'Zerlegt ein großes Ziel in konkrete Meilensteine und Teilaufgaben.',
    parameters: z.object({
      goalId: z.string().describe('ID des Ziels'),
      milestones: z.array(z.string()).describe('Liste von Meilensteinen'),
    }),
    execute: async (args) => {
      const goalId = args.goalId as string;
      const milestones = args.milestones as string[];
      
      const goal = await goalRepository.getById(goalId);
      if (!goal) {
        return { success: false, error: 'Ziel nicht gefunden' };
      }
      
      const milestoneObjects = milestones.map((title, idx) => ({
        id: `ms-${Date.now()}-${idx}`,
        title,
        completed: false,
      }));
      
      await goalRepository.update(goalId, { milestones: milestoneObjects });
      
      const summary = milestoneObjects.map((m, i) => `${i + 1}. ${m.title}`).join('\n');
      
      return { 
        success: true, 
        data: { goal, milestones: milestoneObjects },
        displayMessage: `🎯 **Ziel "${goal.title}" zerlegt:**\n${summary}`
      };
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
      
      const emojis = ['', '😞', '😕', '😐', '😊', '😄'];
      
      const entry = await journalRepository.create({
        date: format(new Date(), 'yyyy-MM-dd'),
        content: note || `Stimmung: ${emojis[mood]}`,
        mood,
        tags: ['mood-check'],
      });
      
      return { 
        success: true, 
        data: entry,
        displayMessage: `${emojis[mood]} Stimmung ${mood}/5 gespeichert${note ? `: "${note}"` : ''}`
      };
    },
  },
  {
    name: 'plan_day',
    description: 'Erstellt einen Tagesplan aus offenen Aufgaben und Terminen.',
    parameters: z.object({}),
    execute: async () => {
      const tasks = await taskRepository.getAll();
      const openTasks = tasks.filter(t => !t.completed);
      
      const events = await calendarRepository.getAll();
      const today = format(new Date(), 'yyyy-MM-dd');
      const todayEvents = events.filter(e => format(new Date(e.startAt), 'yyyy-MM-dd') === today);
      
      const prioritized = openTasks.sort((a, b) => {
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        const aScore = priorityOrder[a.priority] * 10 + (a.dueAt === today ? -5 : 0);
        const bScore = priorityOrder[b.priority] * 10 + (b.dueAt === today ? -5 : 0);
        return aScore - bScore;
      });
      
      let plan = `📋 **Tagesplan für heute:**\n\n`;
      
      if (todayEvents.length > 0) {
        plan += `📅 **Termine:**\n`;
        todayEvents.forEach(e => {
          const time = e.allDay ? 'ganztägig' : format(new Date(e.startAt), 'HH:mm');
          plan += `• ${time}: ${e.title}\n`;
        });
        plan += `\n`;
      }
      
      if (prioritized.length > 0) {
        plan += `✅ **Aufgaben (nach Priorität):**\n`;
        prioritized.slice(0, 5).forEach(t => {
          const dueInfo = t.dueAt === today ? ' ⚠️' : '';
          plan += `• [${t.priority.toUpperCase()}] ${t.title}${dueInfo}\n`;
        });
      }
      
      if (openTasks.length === 0 && todayEvents.length === 0) {
        plan += `✨ Keine offenen Aufgaben oder Termine – genieße den Tag!`;
      }
      
      return { 
        success: true, 
        data: { tasks: prioritized.slice(0, 5), events: todayEvents },
        displayMessage: plan
      };
    },
  },
  {
    name: 'import_from_text',
    description: 'Konvertiert unstrukturierten Text in Aufgaben und Termine. Erkennt Datumsangaben und erstellt entsprechende Einträge.',
    parameters: z.object({
      text: z.string().describe('Unstrukturierter Text mit Aufgaben/Terminen'),
    }),
    execute: async (args) => {
      const text = args.text as string;
      const lines = text.split('\n').filter(l => l.trim());
      const created: { type: string; title: string }[] = [];
      
      const datePatterns = [
        { regex: /morgen/i, getDate: () => format(new Date(Date.now() + 86400000), 'yyyy-MM-dd') },
        { regex: /übermorgen/i, getDate: () => format(new Date(Date.now() + 2 * 86400000), 'yyyy-MM-dd') },
        { regex: /heute/i, getDate: () => format(new Date(), 'yyyy-MM-dd') },
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
        return { success: false, error: 'Keine Aufgaben erkannt' };
      }
      
      const summary = created.map(c => `• ${c.title}`).join('\n');
      
      return { 
        success: true, 
        data: created,
        displayMessage: `✅ **${created.length} Einträge erstellt:**\n${summary}`
      };
    },
  },
  {
    name: 'detect_patterns',
    description: 'Erkennt Muster in deinen Daten: produktivste Tage, Stimmungstrends, Gewohnheits-Streaks.',
    parameters: z.object({}),
    execute: async () => {
      const tasks = await taskRepository.getAll();
      const journalEntries = await journalRepository.getAll();
      const habits = await habitRepository.getAll();
      const allLogs: HabitLog[] = [];
      for (const habit of habits) {
        const logs = await habitRepository.getLogs(habit.id);
        allLogs.push(...logs);
      }
      
      let patterns = `🔍 **Erkannte Muster:**\n\n`;
      
      const completedByDay: Record<string, number> = {};
      tasks.filter(t => t.completed).forEach(t => {
        const day = format(new Date(t.updatedAt), 'EEEE');
        completedByDay[day] = (completedByDay[day] || 0) + 1;
      });
      
      if (Object.keys(completedByDay).length > 0) {
        const bestDay = Object.entries(completedByDay).sort((a, b) => b[1] - a[1])[0];
        if (bestDay) {
          patterns += `📊 **Produktivster Tag:** ${bestDay[0]} (${bestDay[1]} Aufgaben)\n\n`;
        }
      }
      
      if (journalEntries.length >= 3) {
        const recentMoods = journalEntries
          .filter(e => e.mood)
          .slice(-7)
          .map(e => e.mood!);
        
        if (recentMoods.length >= 3) {
          const avg = recentMoods.reduce((a, b) => a + b, 0) / recentMoods.length;
          const trend = avg >= 4 ? 'steigend 😊' : avg >= 3 ? 'stabil 😐' : 'sinkend 😕';
          patterns += `😊 **Stimmungstrend:** ${trend} (Durchschnitt: ${avg.toFixed(1)}/5)\n\n`;
        }
      }
      
      if (allLogs.length > 0) {
        const last7Days = Array.from({ length: 7 }, (_, i) => 
          format(new Date(Date.now() - i * 86400000), 'yyyy-MM-dd')
        );
        const logsInLast7 = allLogs.filter(l => last7Days.includes(l.date));
        const consistency = (logsInLast7.length / 7 * 100).toFixed(0);
        patterns += `🔁 **Gewohnheits-Konsistenz:** ${consistency}% (letzte 7 Tage)\n`;
      }
      
      return { 
        success: true, 
        data: { completedByDay, habitConsistency: allLogs.length },
        displayMessage: patterns
      };
    },
  },
];

// ============ TOOL REGISTRY ============

export function getTool(name: string): ToolDefinition | undefined {
  return tools.find(t => t.name === name);
}

export function getAllTools(): ToolDefinition[] {
  return tools;
}

export async function executeTool(call: ToolCall): Promise<ToolResult> {
  const tool = getTool(call.name);
  if (!tool) {
    return { success: false, error: `Unbekanntes Tool: ${call.name}` };
  }
  
  try {
    const validated = tool.parameters.parse(call.arguments);
    return await tool.execute(validated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { success: false, error: `Ungültige Parameter: ${err.issues.map((issue: { message: string }) => issue.message).join(', ')}` };
    }
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
    return { success: false, error: message };
  }
}

// ============ CONVERT TO OPENAI FUNCTION SCHEMA ============

export function zodToJsonSchema(schema: z.ZodType<unknown>): Record<string, unknown> {
  // Simple conversion for our specific use case
  if (schema instanceof z.ZodObject) {
    const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodFieldToJsonSchema(value as z.ZodType<unknown>);
      if (!(value instanceof z.ZodOptional) && !(value instanceof z.ZodDefault)) {
        required.push(key);
      }
    }
    
    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }
  return { type: 'object' };
}

function zodFieldToJsonSchema(schema: z.ZodType<unknown>): Record<string, unknown> {
  if (schema instanceof z.ZodString) {
    return { type: 'string', description: (schema as z.ZodString).description };
  }
  if (schema instanceof z.ZodNumber) {
    return { type: 'number', description: (schema as z.ZodNumber).description };
  }
  if (schema instanceof z.ZodBoolean) {
    return { type: 'boolean', description: (schema as z.ZodBoolean).description };
  }
  if (schema instanceof z.ZodEnum) {
    const enumSchema = schema as unknown as { options: readonly string[]; description?: string };
    return { 
      type: 'string', 
      enum: enumSchema.options,
      description: enumSchema.description 
    };
  }
  if (schema instanceof z.ZodArray) {
    const arraySchema = schema as z.ZodArray<z.ZodType<unknown>>;
    const inner = arraySchema.element;
    return { 
      type: 'array', 
      items: zodFieldToJsonSchema(inner),
      description: arraySchema.description 
    };
  }
  if (schema instanceof z.ZodOptional) {
    const optSchema = schema as z.ZodOptional<z.ZodType<unknown>>;
    return zodFieldToJsonSchema(optSchema.unwrap());
  }
  if (schema instanceof z.ZodDefault) {
    const defSchema = schema as z.ZodDefault<z.ZodType<unknown>>;
    const inner = zodFieldToJsonSchema(defSchema.removeDefault());
    return { ...inner, description: defSchema.description };
  }
  return { type: 'string' };
}

export function toolsToFunctionDefinitions() {
  return tools.map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: zodToJsonSchema(tool.parameters),
    },
  }));
}
