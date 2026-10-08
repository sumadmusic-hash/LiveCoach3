import { useState, useEffect, useRef } from 'react';
import { chatRepository } from '../../core/db/repositories';
import type { ChatMessage } from '../../core/schemas';
import { Send, StopCircle, Trash2, Sparkles } from 'lucide-react';
import { useAiSessionStore } from '../../core/state/stores';

export default function ChatView() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const { isStreaming, setStreaming, abortController, setAbortController } = useAiSessionStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadMessages(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function loadMessages() {
    setLoading(true);
    const msgs = await chatRepository.getAll();
    setMessages(msgs);
    setLoading(false);
  }

  async function sendMessage() {
    if (!input.trim()) return;
    const userMsg = await chatRepository.create({ role: 'user', content: input.trim(), toolCalls: [] });
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    // Simulate AI response (no provider configured)
    setStreaming(true);
    const controller = new AbortController();
    setAbortController(controller);

    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      if (controller.signal.aborted) return;
      const response = `Ich bin der LifeOS-Assistent. Um mich mit einer echten KI zu verbinden, konfiguriere bitte einen Provider in den Einstellungen.\n\nDeine Nachricht: "${input.trim()}"\n\nIch kann dir bei Aufgaben, Zielen, Gewohnheiten und mehr helfen. Nutze ⌘K für schnelle Befehle!`;
      const aiMsg = await chatRepository.create({ role: 'assistant', content: response, toolCalls: [] });
      setMessages(prev => [...prev, aiMsg]);
    } finally {
      setStreaming(false);
      setAbortController(null);
    }
  }

  function stopStreaming() {
    abortController?.abort();
    setStreaming(false);
    setAbortController(null);
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
        <h1 className="text-2xl font-bold">KI-Chat</h1>
        <button onClick={clearChat} className="p-2 text-gray-400 hover:text-red-500 rounded-lg">
          <Trash2 size={18} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.length === 0 && !loading && (
          <div className="text-center py-12">
            <Sparkles size={48} className="mx-auto mb-3 text-indigo-300" />
            <p className="text-gray-400 mb-4">Starte eine Konversation mit deinem KI-Assistenten</p>
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
        {isStreaming && (
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
