import { z } from 'zod';
import { taskRepository } from '../db/repositories/taskRepo';
import { goalRepository } from '../db/repositories/goalRepo';
import { habitRepository } from '../db/repositories/habitRepo';
import { journalRepository } from '../db/repositories/journalRepo';
import { jobRepository, calendarRepository, profileRepository } from '../db/repositories';
import { moduleRegistry, type ModuleId } from '../modules/ModuleRegistry';
import type { Priority, JobPhase } from '../schemas';
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';

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
