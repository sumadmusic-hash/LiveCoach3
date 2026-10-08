import type { ToolResult } from './toolTypes';

/** Hilfsfunktion für erfolgreiche Tool-Ergebnisse mit Anzeigetext. */
export function ok(data: unknown, displayMessage: string): ToolResult {
  return { success: true, data, displayMessage };
}

/** Hilfsfunktion für fehlgeschlagene Tool-Ergebnisse mit Fehlermeldung. */
export function fail(error: string): ToolResult {
  return { success: false, error };
}

/** Formatiert eine Liste von Änderungen als Aufzählung ("• Änderung"). */
export function formatChanges(changes: string[]): string {
  return changes.map((c) => `  • ${c}`).join('\n');
}

/** Formatierter Datumsstring des heutigen Tages im Format YYYY-MM-DD. */
export function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Zeitpunkt `days` Tage in der Vergangenheit (für Zeitraum-Filter). */
export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/** Fall-insensitive Teilübereinstimmung (Trimming wird ignoriert). */
export function containsCI(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.trim().toLowerCase());
}
