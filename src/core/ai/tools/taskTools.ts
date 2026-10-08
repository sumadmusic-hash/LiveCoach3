/** KI-Tools für das Aufgaben-Modul (list, create, complete, delete, update, reminder). */
import { z } from 'zod';
import { taskRepository } from '../../db/repositories/taskRepo';
import type { Priority } from '../../schemas';
import { defineTools } from '../toolTypes';
import { ok, fail, containsCI } from '../toolUtils';

export const taskTools = defineTools([
  {
    name: 'list_tasks',
    description: 'Listet alle offenen Aufgaben auf. Optional gefiltert nach Status.',
    parameters: z.object({
      includeCompleted: z.boolean().optional().default(false).describe('Auch erledigte Aufgaben anzeigen'),
    }),
    execute: async (args) => {
      const tasks = await taskRepository.getAll();
      const filtered = args.includeCompleted ? tasks : tasks.filter((t) => !t.completed);
      const summary = filtered
        .slice(0, 20)
        .map((t) => `- ${t.completed ? '✅' : '⬜'} ${t.title} [${t.priority}]${t.dueAt ? ` (fällig: ${t.dueAt})` : ''}`)
        .join('\n');
      return ok(
        filtered,
        `${filtered.length} Aufgaben gefunden:\n${summary}${filtered.length > 20 ? '\n... und weitere' : ''}`,
      );
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
      return ok(task, `✅ Aufgabe "${task.title}" erstellt (Priorität: ${task.priority})`);
    },
  },
  {
    name: 'complete_task',
    description: 'Markiert eine Aufgabe als erledigt. Finde die Aufgabe anhand des Titels.',
    parameters: z.object({
      title: z.string().describe('Titel der Aufgabe (oder Teil davon)'),
    }),
    execute: async (args) => {
      const tasks = await taskRepository.getAll();
      const found = tasks.find((t) => !t.completed && containsCI(t.title, args.title as string));
      if (!found) {
        return fail(`Keine offene Aufgabe mit "${args.title}" gefunden`);
      }
      await taskRepository.complete(found.id);
      return ok(found, `✅ "${found.title}" als erledigt markiert!`);
    },
  },
  {
    name: 'delete_task',
    description: 'Löscht eine Aufgabe anhand des Titels.',
    parameters: z.object({
      title: z.string().describe('Titel der Aufgabe'),
    }),
    execute: async (args) => {
      const tasks = await taskRepository.getAll();
      const found = tasks.find((t) => containsCI(t.title, args.title as string));
      if (!found) {
        return fail(`Keine Aufgabe mit "${args.title}" gefunden`);
      }
      await taskRepository.softDelete(found.id);
      return ok(found, `🗑️ "${found.title}" gelöscht`);
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
      const updates: Record<string, unknown> = {};
      const changes: string[] = [];

      if (args.title) {
        updates.title = args.title;
        changes.push(`Titel: ${args.title}`);
      }
      if (args.priority) {
        updates.priority = args.priority;
        changes.push(`Priorität: ${args.priority}`);
      }
      if (args.dueAt) {
        updates.dueAt = args.dueAt;
        changes.push(`Fällig: ${args.dueAt}`);
      }
      if (args.tags) {
        updates.tags = args.tags;
        changes.push(`Tags: ${(args.tags as string[]).join(', ')}`);
      }

      if (changes.length === 0) {
        return fail('Keine Änderungen angegeben');
      }

      const updated = await taskRepository.update(args.taskId as string, updates);
      if (!updated) {
        return fail('Aufgabe nicht gefunden');
      }

      return ok(updated, `✅ Aufgabe aktualisiert:\n${changes.map((c) => `  • ${c}`).join('\n')}`);
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
      return ok(task, `⏰ Erinnerung gesetzt: "${args.text}" am ${args.dueAt}`);
    },
  },
]);
