/** KI-Tools für das Bewerbungs-Modul (JobBoard). */
import { z } from 'zod';
import { jobRepository } from '../../db/repositories';
import type { JobApplication, JobPhase } from '../../schemas';
import { defineTools } from '../toolTypes';
import { ok, fail, containsCI } from '../toolUtils';

const JOB_PHASES = ['research', 'applied', 'interview', 'offer', 'rejected', 'closed'] as const;

export const jobTools = defineTools([
  {
    name: 'list_job_applications',
    description: 'Listet alle Bewerbungen auf.',
    parameters: z.object({}),
    execute: async () => {
      const jobs = await jobRepository.getAll();
      const byPhase: Record<string, string[]> = {};
      jobs.forEach((j) => {
        if (!byPhase[j.phase]) byPhase[j.phase] = [];
        byPhase[j.phase]!.push(`${j.role} @ ${j.company}`);
      });
      let summary = `💼 Bewerbungen (${jobs.length}):\n`;
      Object.entries(byPhase).forEach(([phase, items]) => {
        summary += `\n**${phase}** (${items.length}):\n`;
        items.forEach((i) => (summary += `  - ${i}\n`));
      });
      return ok(jobs, summary);
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
      return ok(job, `💼 Bewerbung bei ${job.company} als ${job.role} erstellt`);
    },
  },
  {
    name: 'update_job_phase',
    description: 'Ändert die Phase einer Bewerbung (research, applied, interview, offer, rejected, closed).',
    parameters: z.object({
      company: z.string().describe('Firmenname'),
      phase: z.enum(JOB_PHASES).describe('Neue Phase'),
    }),
    execute: async (args) => {
      const jobs = await jobRepository.getAll();
      const found = jobs.find((j) => containsCI(j.company, args.company as string));
      if (!found) {
        return fail(`Bewerbung bei "${args.company}" nicht gefunden`);
      }
      await jobRepository.update(found.id, { phase: args.phase as JobPhase });
      return ok(found, `✅ ${found.company} → Phase: ${args.phase}`);
    },
  },
  {
    name: 'update_job_application',
    description: 'Aktualisiert eine Bewerbung: Phase ändern, Notizen hinzufügen, Gehalt aktualisieren.',
    parameters: z.object({
      jobId: z.string().describe('ID der Bewerbung'),
      phase: z.enum(JOB_PHASES).optional().describe('Neue Phase'),
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

      if (changes.length === 0) {
        return fail('Keine Änderungen angegeben');
      }

      const updated = await jobRepository.update(jobId, updates);
      if (!updated) {
        return fail('Bewerbung nicht gefunden');
      }

      return ok(updated, `✅ Bewerbung aktualisiert:\n${changes.map((c) => `  • ${c}`).join('\n')}`);
    },
  },
]);
