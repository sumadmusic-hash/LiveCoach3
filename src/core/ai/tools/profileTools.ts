/** KI-Tools für das Profil-Modul (lesen/schreiben des Benutzerprofils). */
import { z } from 'zod';
import { profileRepository } from '../../db/repositories';
import type { UserProfile } from '../../schemas';
import { defineTools } from '../toolTypes';
import { ok, fail } from '../toolUtils';

export const profileTools = defineTools([
  {
    name: 'get_user_profile',
    description:
      'Liest das Benutzerprofil. Zeigt Name, Werte, Energiezeiten, Stressfaktoren, Kommunikationsstil und Interessen.',
    parameters: z.object({}),
    execute: async () => {
      const profile = await profileRepository.get();
      if (!profile) {
        return ok(null, '👤 Profil ist leer. Nutze update_user_profile um es zu füllen.');
      }

      const field = (label: string, value: string | string[] | undefined): string => {
        const text = Array.isArray(value) ? value.join(', ') : value;
        return `**${label}:** ${text && text.length > 0 ? text : '(nicht gesetzt)'}\n`;
      };

      let summary = `👤 **Profil**\n\n`;
      summary += field('Name', profile.name);
      summary += field('Werte', profile.values);
      summary += field('Energiezeiten', profile.energyTimes);
      summary += field('Stressfaktoren', profile.stressFactors);
      summary += `**Kommunikationsstil:** ${profile.communicationStyle}\n`;
      summary += field('Interessen', profile.interests);

      return ok(profile, summary);
    },
  },
  {
    name: 'update_user_profile',
    description:
      'Aktualisiert das Benutzerprofil. Kann einzelne Felder setzen oder ergänzen. Wenn Felder fehlen, können sie hier gesetzt werden.',
    parameters: z.object({
      name: z.string().optional().describe('Name des Benutzers'),
      values: z.array(z.string()).optional().describe('Persönliche Werte (z.B. Familie, Gesundheit, Lernen)'),
      energyTimes: z
        .array(z.string())
        .optional()
        .describe('Zeiten mit hoher Energie (z.B. Morgens 8-11)'),
      stressFactors: z.array(z.string()).optional().describe('Stressfaktoren (z.B. Zeitdruck, Unklarheit)'),
      communicationStyle: z
        .enum(['balanced', 'direct', 'warm', 'analytical'])
        .optional()
        .describe('Bevorzugter Kommunikationsstil'),
      interests: z.array(z.string()).optional().describe('Interessen/Hobbys'),
    }),
    execute: async (args) => {
      const updates: Partial<UserProfile> = {};
      const changes: string[] = [];

      const applyField = <K extends 'name' | 'values' | 'energyTimes' | 'stressFactors' | 'communicationStyle' | 'interests'>(
        key: K,
        label: string,
      ) => {
        if (args[key] !== undefined) {
          updates[key] = args[key] as UserProfile[K];
          const value = args[key];
          changes.push(`${label}: ${Array.isArray(value) ? value.join(', ') : value}`);
        }
      };

      applyField('name', 'Name');
      applyField('values', 'Werte');
      applyField('energyTimes', 'Energiezeiten');
      applyField('stressFactors', 'Stressfaktoren');
      applyField('communicationStyle', 'Kommunikationsstil');
      applyField('interests', 'Interessen');

      if (changes.length === 0) {
        return fail('Keine Felder zum Aktualisieren angegeben');
      }

      await profileRepository.save(updates);
      return ok(updates, `✅ Profil aktualisiert:\n${changes.map((c) => `  • ${c}`).join('\n')}`);
    },
  },
]);
