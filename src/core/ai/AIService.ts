import { settingsRepository } from '../db/repositories';

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onDone: (fullText: string) => void;
  onError: (error: string) => void;
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
            content: 'Du bist LifeOS, ein persönlicher Life-Assistent. Antworte kurz, konkret und motivierend auf Deutsch. Du hilfst bei Aufgaben, Zielen, Gewohnheiten und Reflexion.'
          },
          ...messages.map(m => ({ role: m.role, content: m.content }))
        ],
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
          const content = json.choices?.[0]?.delta?.content;
          if (content) {
            fullText += content;
            callbacks.onToken(content);
          }
        } catch {
          // Skip malformed chunks
        }
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
