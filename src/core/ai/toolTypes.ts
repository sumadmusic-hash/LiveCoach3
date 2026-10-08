/**
 * Zentrale Typen und Rahmen-Funktion für KI-Tools.
 * Alle Tool-Module definieren ihre Tools als reine Daten (ToolDefinition[])
 * und nutzen `defineTools` für die Validierung der eindeutigen Namen.
 */
import { z } from 'zod';

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

/**
 * Nimmt eine Liste von Tool-Definitionen entgegen und stellt sicher,
 * dass keine Tool-Namen doppelt vergeben sind (Fail-Fast beim Laden).
 */
export function defineTools(list: ToolDefinition[]): ToolDefinition[] {
  const seen = new Set<string>();
  for (const tool of list) {
    if (seen.has(tool.name)) {
      throw new Error(`Doppelter Tool-Name: ${tool.name}`);
    }
    seen.add(tool.name);
  }
  return list;
}
