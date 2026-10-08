/** Tool-Registry: bündelt alle Tool-Module und stellt Ausführung + JSON-Schema-Konvertion bereit. */
import { z } from 'zod';
import type { ToolCall, ToolDefinition, ToolResult } from './toolTypes';

// Rückwärtskompatible Re-Exports der Tool-Typen
export type { ToolCall, ToolDefinition, ToolResult } from './toolTypes';
import { navigationTools } from './tools/navigationTools';
import { taskTools } from './tools/taskTools';
import { goalTools } from './tools/goalTools';
import { habitTools } from './tools/habitTools';
import { journalTools } from './tools/journalTools';
import { jobTools } from './tools/jobTools';
import { calendarTools } from './tools/calendarTools';
import { profileTools } from './tools/profileTools';
import { insightTools } from './tools/insightTools';
import { planningTools } from './tools/planningTools';

export const tools: ToolDefinition[] = [
  ...navigationTools,
  ...taskTools,
  ...goalTools,
  ...habitTools,
  ...journalTools,
  ...jobTools,
  ...calendarTools,
  ...profileTools,
  ...insightTools,
  ...planningTools,
];

export function getTool(name: string): ToolDefinition | undefined {
  return tools.find((t) => t.name === name);
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
      return {
        success: false,
        error: `Ungültige Parameter: ${err.issues.map((issue) => issue.message).join(', ')}`,
      };
    }
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
    return { success: false, error: message };
  }
}

// ============ KONVERTIERUNG ZU OPENAI FUNCTION SCHEMAS ============

/** Konvertiert ein Zod-Schema in ein vereinfachtes JSON-Schema für Function Calling. */
export function zodToJsonSchema(schema: z.ZodType<unknown>): Record<string, unknown> {
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
    return { type: 'string', description: schema.description };
  }
  if (schema instanceof z.ZodNumber) {
    return { type: 'number', description: schema.description };
  }
  if (schema instanceof z.ZodBoolean) {
    return { type: 'boolean', description: schema.description };
  }
  if (schema instanceof z.ZodEnum) {
    const enumSchema = schema as unknown as { options: readonly string[]; description?: string };
    return { type: 'string', enum: enumSchema.options, description: enumSchema.description };
  }
  if (schema instanceof z.ZodArray) {
    const arraySchema = schema as z.ZodArray<z.ZodType<unknown>>;
    return { type: 'array', items: zodFieldToJsonSchema(arraySchema.element), description: arraySchema.description };
  }
  if (schema instanceof z.ZodOptional) {
    return zodFieldToJsonSchema((schema as z.ZodOptional<z.ZodType<unknown>>).unwrap());
  }
  if (schema instanceof z.ZodDefault) {
    const defSchema = schema as z.ZodDefault<z.ZodType<unknown>>;
    const inner = zodFieldToJsonSchema(defSchema.removeDefault());
    return { ...inner, description: defSchema.description };
  }
  return { type: 'string' };
}

export function toolsToFunctionDefinitions() {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: zodToJsonSchema(tool.parameters),
    },
  }));
}
