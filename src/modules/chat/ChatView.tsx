import { useState, useEffect, useRef } from 'react';
import { chatRepository, settingsRepository } from '../../core/db/repositories';
import type { ChatMessage } from '../../core/schemas';
import { streamAIResponse } from '../../core/ai/AIService';
import { Send, StopCircle, Trash2, Sparkles, AlertCircle } from 'lucide-react';
import { useAiSessionStore } from '../../core/state/stores';

export default function ChatView() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [streamText, setStreamText] = useState('');
  const [error, setError] = useState('');
  const [settings, setSettings] = useState<{ aiProvider?: string; aiModel?: string; aiApiKey?: string; aiBaseUrl?: string } | null>(null);
  const { isStreaming, setStreaming, abortController, setAbortController } = useAiSessionStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadMessages(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streamText]);

  async function loadMessages() {
    setLoading(true);
    const [msgs, s] = await Promise.all([
      chatRepository.getAll(),
      settingsRepository.get(),
    ]);
    setMessages(msgs);
    setSettings(s ? { aiProvider: s.aiProvider, aiModel: s.aiModel, aiApiKey: s.aiApiKey, aiBaseUrl: s.aiBaseUrl } : null);
    setLoading(false);
  }

  const hasProvider = settings?.aiProvider && settings?.aiApiKey;

  async function sendMessage() {
    if (!input.trim()) return;
    setError('');
    const userMsg = await chatRepository.create({ role: 'user', content: input.trim(), toolCalls: [] });
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    const userInput = input.trim();
    setInput('');

    if (!hasProvider) {
      // Fallback ohne Provider
      setStreaming(true);
      const controller = new AbortController();
      setAbortController(controller);
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        if (controller.signal.aborted) return;
        const response = '⚠️ Kein KI-Provider konfiguriert.\n\nGehe zu den **Einstellungen**, um einen Provider wie Groq, OpenAI oder Ollama einzurichten. Ohne Provider kann ich nur begrenzt antworten.\n\nTipp: Groq ist kostenlos und sehr schnell – Base URL: `https://api.groq.com/openai/v1`';
        const aiMsg = await chatRepository.create({ role: 'assistant', content: response, toolCalls: [] });
        setMessages(prev => [...prev, aiMsg]);
      } finally {
        setStreaming(false);
        setAbortController(null);
      }
      return;
    }

    // Echter API-Call
    setStreaming(true);
    setStreamText('');
    const controller = new AbortController();
    setAbortController(controller);

    const conversationHistory = updatedMessages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-10)
      .map(m => ({ role: m.role, content: m.content }));

    await streamAIResponse(
      conversationHistory,
      {
        onToken: (token) => {
          setStreamText(prev => prev + token);
        },
        onDone: async (fullText) => {
          if (fullText) {
            const aiMsg = await chatRepository.create({
              role: 'assistant',
              content: fullText,
              toolCalls: [],
              provider: settings?.aiProvider,
              model: settings?.aiModel,
            });
            setMessages(prev => [...prev, aiMsg]);
          }
          setStreamText('');
          setStreaming(false);
          setAbortController(null);
        },
        onError: (err) => {
          setError(err);
          setStreamText('');
          setStreaming(false);
          setAbortController(null);
        },
      },
      controller.signal
    );
  }

  function stopStreaming() {
    abortController?.abort();
    setStreaming(false);
    setAbortController(null);
    setStreamText('');
  }

  async function clearChat() {
    await chatRepository.clear();
    setMessages([]);
  }

  const quickPrompts = [
    'Was steht heute an?',
    'Zeige meine offenen Aufgaben',
    'Erstelle eine neue Aufgabe',
    'Wochenrückblick',
  ];

  return (
    <div className="max-w-3xl mx-auto h-[calc(100vh-8rem)] flex flex-col pb-20 md:pb-0">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">KI-Chat</h1>
          <p className="text-xs text-gray-400">
            {hasProvider
              ? `Verbunden mit ${settings?.aiProvider} (${settings?.aiModel || 'Standard'})`
              : 'Kein Provider – Einstellungen öffnen zum Aktivieren'}
          </p>
        </div>
        <button onClick={clearChat} className="p-2 text-gray-400 hover:text-red-500 rounded-lg">
          <Trash2 size={18} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.length === 0 && !loading && !streamText && (
          <div className="text-center py-12">
            <Sparkles size={48} className="mx-auto mb-3 text-indigo-300" />
            <p className="text-gray-400 mb-4">Starte eine Konversation mit deinem KI-Assistenten</p>
            {!hasProvider && (
              <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-700 dark:text-yellow-300">
                <p className="font-medium mb-1">⚠️ Kein KI-Provider aktiv</p>
                <p className="text-xs">Konfiguriere einen Provider in den Einstellungen, um echte KI-Antworten zu erhalten.</p>
              </div>
            )}
            <div className="flex flex-wrap gap-2 justify-center">
              {quickPrompts.map(p => (
                <button key={p} onClick={() => setInput(p)} className="px-3 py-1.5 text-xs rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50">
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
              msg.role === 'user'
                ? 'bg-indigo-600 text-white rounded-br-md'
                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-bl-md'
            }`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {streamText && (
          <div className="flex justify-start">
            <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-bl-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm">
              <p className="whitespace-pre-wrap">{streamText}</p>
            </div>
          </div>
        )}
        {isStreaming && !streamText && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-2.5 rounded-2xl rounded-bl-md">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-2 flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <div>
            <p>{error}</p>
            <button onClick={() => setError('')} className="text-xs underline mt-1">Schließen</button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && !isStreaming && sendMessage()}
          placeholder="Nachricht eingeben..."
          className="flex-1 px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
          disabled={isStreaming}
        />
        {isStreaming ? (
          <button onClick={stopStreaming} className="px-4 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600">
            <StopCircle size={20} />
          </button>
        ) : (
          <button onClick={sendMessage} disabled={!input.trim()} className="px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50">
            <Send size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
