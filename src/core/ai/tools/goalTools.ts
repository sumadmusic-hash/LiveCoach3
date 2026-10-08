/** KI-Tools für das Ziele-Modul (list, create, progress, complete, delete, breakdown). */
import { z } from 'zod';
import { goalRepository } from '../../db/repositories/goalRepo';
import { defineTools } from '../toolTypes';
import { ok, fail, containsCI } from '../toolUtils';

export const goalTools = defineTools([
  {
    name: 'list_goals',
    description: 'Listet alle Ziele auf.',
    parameters: z.object({}),
    execute: async () => {
      const goals = await goalRepository.getAll();
      const summary = goals.map((g) => `- ${g.title}: ${g.progress}% (${g.status})`).join('\n');
      return ok(goals, `${goals.length} Ziele:\n${summary || 'Keine Ziele vorhanden'}`);
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
      return ok(goal, `🎯 Ziel "${goal.title}" erstellt!`);
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
      const goals = await goalRepository.getAll();
      const found = goals.find((g) => containsCI(g.title, args.title as string));
      if (!found) {
        return fail(`Ziel "${args.title}" nicht gefunden`);
      }
      await goalRepository.update(found.id, { progress: args.progress as number });
      return ok(found, `📈 "${found.title}" jetzt bei ${args.progress}%`);
    },
  },
  {
    name: 'delete_goal',
    description: 'Löscht ein Ziel vollständig.',
    parameters: z.object({
      goalId: z.string().describe('ID des Ziels'),
    }),
    execute: async (args) => {
      const goal = await goalRepository.getById(args.goalId as string);
      if (!goal) {
        return fail('Ziel nicht gefunden');
      }
      await goalRepository.delete(args.goalId as string);
      return ok(goal, `🗑️ Ziel "${goal.title}" gelöscht`);
    },
  },
  {
    name: 'complete_goal',
    description: 'Markiert ein Ziel als abgeschlossen (100% Fortschritt).',
    parameters: z.object({
      goalId: z.string().describe('ID des Ziels'),
    }),
    execute: async (args) => {
      const goal = await goalRepository.getById(args.goalId as string);
      if (!goal) {
        return fail('Ziel nicht gefunden');
      }
      await goalRepository.update(args.goalId as string, { progress: 100, status: 'completed' });
      return ok(goal, `🎉 Ziel "${goal.title}" als abgeschlossen markiert!`);
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
        return fail('Ziel nicht gefunden');
      }

      const milestoneObjects = milestones.map((title, idx) => ({
        id: `ms-${Date.now()}-${idx}`,
        title,
        completed: false,
      }));

      await goalRepository.update(goalId, { milestones: milestoneObjects });

      const summary = milestoneObjects.map((m, i) => `${i + 1}. ${m.title}`).join('\n');
      return ok({ goal, milestones: milestoneObjects }, `🎯 **Ziel "${goal.title}" zerlegt:**\n${summary}`);
    },
  },
]);
