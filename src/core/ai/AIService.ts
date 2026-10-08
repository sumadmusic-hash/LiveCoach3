import { settingsRepository } from '../db/repositories';
import { toolsToFunctionDefinitions, executeTool, type ToolCall } from './tools';

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onDone: (fullText: string) => void;
  onError: (error: string) => void;
  onToolCall?: (toolCall: ToolCall, result: { success: boolean; displayMessage?: string; data?: unknown }) => void;
}

export async function streamAIResponse(
  messages: { role: string; content: string }[],
  callbacks: StreamCallbacks,
  signal: AbortSignal
): Promise<void> {
  const settings = await settingsRepository.get();
  
  if (!settings?.aiProvider || !settings.aiApiKey) {
    callbacks.onError('Kein KI-Provider konfiguriert. Bitte in den Einstellungen einrichten.');
    return;
  }

  const baseUrl = settings.aiBaseUrl || getDefaultBaseUrl(settings.aiProvider);
  const model = settings.aiModel || getDefaultModel(settings.aiProvider);
  const apiKey = settings.aiApiKey;

  const url = `${baseUrl}/chat/completions`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: `Du bist LifeOS, ein persönlicher Life-Assistent. Antworte kurz, konkret und motivierend auf Deutsch. Du hilfst bei Aufgaben, Zielen, Gewohnheiten und Reflexion.

WICHTIG: Du hast Zugriff auf Tools, mit denen du die App bedienen kannst. Nutze sie aktiv!
- Wenn der Nutzer eine Aufgabe erstellen will → create_task
- Wenn der Nutzer Aufgaben sehen will → list_tasks
- Wenn der Nutzer eine Aufgabe erledigen will → complete_task
- Wenn der Nutzer ein Ziel erstellen will → create_goal
- Wenn der Nutzer eine Gewohnheit loggen will → log_habit
- Wenn der Nutzer eine neue Gewohnheit anlegen will → create_habit
- Wenn der Nutzer einen Überblick will → get_today_summary
- Wenn der Nutzer zu einem Modul navigieren will → navigate_to
- Wenn der Nutzer sein Profil sehen will → get_user_profile
- Wenn der Nutzer sein Profil aktualisieren/ausfüllen will → update_user_profile
- Wenn der Nutzer nach der Uhrzeit, dem Datum oder zeitbezogenen Fragen fragt → get_current_datetime

ZEIT: Wenn der Nutzer nach der aktuellen Uhrzeit, dem Datum oder Wochentag fragt, nutze IMMER get_current_datetime. Du hast kein eingebautes Zeitgefühl.

PROFIL: Wenn das Profil leer ist oder wichtige Felder fehlen, biete proaktiv an, es zu füllen. Frage nach Name, Werten, Energiezeiten, Stressfaktoren und Interessen.

GEWOHNHEITEN: Wenn der Nutzer über Routinen spricht, die er aufbauen will, biete an, sie als Gewohnheit anzulegen.

Führe Tools aus, wenn der Nutzer eine Aktion wünscht. Antworte danach mit einer kurzen Bestätigung.`
          },
          ...messages.map(m => ({ role: m.role, content: m.content }))
        ],
        tools: toolsToFunctionDefinitions(),
        tool_choice: 'auto',
        stream: true,
        max_tokens: 1024,
        temperature: 0.7,
      }),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `API-Fehler (${response.status})`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorMessage;
      } catch {
        errorMessage = `${errorMessage}: ${errorText.slice(0, 200)}`;
      }
      callbacks.onError(errorMessage);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      callbacks.onError('Kein Stream verfügbar');
      return;
    }

    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';
    const toolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const json = JSON.parse(trimmed.slice(6));
          const delta = json.choices?.[0]?.delta;
          
          if (delta?.content) {
            fullText += delta.content;
            callbacks.onToken(delta.content);
          }
          
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index as number;
              if (!toolCalls.has(idx)) {
                toolCalls.set(idx, { id: tc.id || '', name: '', arguments: '' });
              }
              const existing = toolCalls.get(idx)!;
              if (tc.id) existing.id = tc.id;
              if (tc.function?.name) existing.name += tc.function.name;
              if (tc.function?.arguments) existing.arguments += tc.function.arguments;
            }
          }
        } catch {
          // Skip malformed chunks
        }
      }
    }

    // Execute tool calls if any
    if (toolCalls.size > 0) {
      const toolResults: { role: string; content: string; tool_call_id?: string }[] = [];
      const assistantToolCalls = Array.from(toolCalls.values()).map(tc => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.name, arguments: tc.arguments },
      }));
      
      for (const tc of toolCalls.values()) {
        try {
          const args = JSON.parse(tc.arguments);
          const result = await executeTool({ name: tc.name, arguments: args });
          toolResults.push({
            role: 'tool',
            content: JSON.stringify({ success: result.success, message: result.displayMessage || result.error || 'OK' }),
            tool_call_id: tc.id,
          });
          callbacks.onToolCall?.({ name: tc.name, arguments: args }, { success: result.success, displayMessage: result.displayMessage, data: result.data });
        } catch {
          toolResults.push({
            role: 'tool',
            content: JSON.stringify({ success: false, message: 'Tool-Ausführung fehlgeschlagen' }),
            tool_call_id: tc.id,
          });
        }
      }
      
      // Send tool results back to get final response
      try {
        const followUpResponse = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: 'Du bist LifeOS, ein persönlicher Life-Assistent. Antworte kurz, konkret und motivierend auf Deutsch. Bestätige ausgeführte Aktionen kurz. Wenn das Profil noch unvollständig ist, biete proaktiv an, fehlende Felder zu ergänzen.' },
              ...messages.map(m => ({ role: m.role, content: m.content })),
              { role: 'assistant', tool_calls: assistantToolCalls, content: null },
              ...toolResults,
            ],
            stream: true,
            max_tokens: 512,
            temperature: 0.7,
          }),
          signal,
        });
        
        if (followUpResponse.ok && followUpResponse.body) {
          const followUpReader = followUpResponse.body.getReader();
          let followUpBuffer = '';
          
          while (true) {
            const { done, value } = await followUpReader.read();
            if (done) break;
            followUpBuffer += decoder.decode(value, { stream: true });
            const followUpLines = followUpBuffer.split('\n');
            followUpBuffer = followUpLines.pop() || '';
            
            for (const line of followUpLines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith('data: ')) continue;
              const data = trimmed.slice(6);
              if (data === '[DONE]') continue;
              try {
                const json = JSON.parse(data);
                const content = json.choices?.[0]?.delta?.content;
                if (content) {
                  fullText += content;
                  callbacks.onToken(content);
                }
              } catch { /* skip */ }
            }
          }
        }
      } catch {
        const toolSummary = toolResults.map(r => {
          try { return JSON.parse(r.content).message; } catch { return r.content; }
        }).join('\n');
        fullText = toolSummary;
        callbacks.onToken(toolSummary);
      }
    }

    callbacks.onDone(fullText);
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      callbacks.onDone('');
      return;
    }
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
    
    if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
      callbacks.onError('Netzwerkfehler: API nicht erreichbar. Prüfe Base URL und Internetverbindung.');
    } else {
      callbacks.onError(`Fehler: ${message}`);
    }
  }
}

function getDefaultBaseUrl(provider: string): string {
  switch (provider) {
    case 'groq': return 'https://api.groq.com/openai/v1';
    case 'openai': return 'https://api.openai.com/v1';
    case 'anthropic': return 'https://api.anthropic.com/v1';
    case 'ollama': return 'http://localhost:11434/v1';
    case 'gemini': return 'https://generativelanguage.googleapis.com/v1beta/openai';
    case 'openrouter': return 'https://openrouter.ai/api/v1';
    default: return 'https://api.openai.com/v1';
  }
}

function getDefaultModel(provider: string): string {
  switch (provider) {
    case 'groq': return 'qwen/qwen3-27b';
    case 'openai': return 'gpt-4o-mini';
    case 'anthropic': return 'claude-3-5-sonnet-20241022';
    case 'ollama': return 'llama3.2';
    case 'gemini': return 'gemini-2.0-flash';
    case 'openrouter': return 'meta-llama/llama-3.3-70b-instruct';
    default: return 'gpt-4o-mini';
  }
}
