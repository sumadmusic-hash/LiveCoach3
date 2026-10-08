import { useState, useEffect } from 'react';
import { settingsRepository, aiLogRepository } from '../../core/db/repositories';
import type { Settings, AiActionLog } from '../../core/schemas';
import { useUiStore } from '../../core/state/stores';
import { Settings as SettingsIcon, Save, Download, Upload, Shield, Key } from 'lucide-react';
import toast from 'react-hot-toast';

function getDefaultUrl(provider: string): string {
  switch (provider) {
    case 'groq': return 'https://api.groq.com/openai/v1';
    case 'openai': return 'https://api.openai.com/v1';
    case 'anthropic': return 'https://api.anthropic.com/v1';
    case 'ollama': return 'http://localhost:11434/v1';
    case 'gemini': return 'https://generativelanguage.googleapis.com/v1beta/openai';
    case 'openrouter': return 'https://openrouter.ai/api/v1';
    default: return '';
  }
}

function getDefaultModel(provider: string): string {
  switch (provider) {
    case 'groq': return 'llama-3.3-70b-versatile';
    case 'openai': return 'gpt-4o-mini';
    case 'anthropic': return 'claude-3-5-sonnet-20241022';
    case 'ollama': return 'llama3.2';
    case 'gemini': return 'gemini-2.0-flash';
    case 'openrouter': return 'meta-llama/llama-3.3-70b-instruct';
    default: return '';
  }
}

export default function SettingsView() {
  const { theme, setTheme } = useUiStore();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [logs, setLogs] = useState<AiActionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [s, l] = await Promise.all([settingsRepository.get(), aiLogRepository.getAll()]);
    if (s) {
      setSettings(s);
      setProvider(s.aiProvider || '');
      setModel(s.aiModel || '');
      setApiKey(s.aiApiKey || '');
      setBaseUrl(s.aiBaseUrl || '');
    }
    setLogs(l);
    setLoading(false);
  }

  async function save() {
    await settingsRepository.save({
      theme: theme as 'light' | 'dark' | 'system',
      aiProvider: provider || undefined,
      aiModel: model || undefined,
      aiApiKey: apiKey || undefined,
      aiBaseUrl: baseUrl || undefined,
    });
    toast.success('Einstellungen gespeichert');
  }

  function exportData() {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: { ...settings, aiApiKey: undefined },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lifeos-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Export erstellt (ohne API-Keys)');
  }

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" /></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20 md:pb-0">
      <h1 className="text-2xl font-bold">Einstellungen</h1>

      {/* Theme */}
      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><SettingsIcon size={18} /> Darstellung</h3>
        <div className="flex gap-2">
          {(['light', 'dark', 'system'] as const).map(t => (
            <button key={t} onClick={() => setTheme(t)} className={`px-4 py-2 rounded-lg text-sm ${theme === t ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}>
              {t === 'light' ? '☀️ Hell' : t === 'dark' ? '🌙 Dunkel' : '💻 System'}
            </button>
          ))}
        </div>
      </section>

      {/* AI Provider */}
      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><Key size={18} /> KI-Provider</h3>
        <div className="space-y-2">
          <select value={provider} onChange={e => setProvider(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-sm">
            <option value="">Kein Provider (Offline-Modus)</option>
            <option value="ollama">Ollama (Lokal)</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="groq">Groq</option>
            <option value="gemini">Google Gemini</option>
            <option value="openrouter">OpenRouter</option>
          </select>
          {provider && (
            <>
              <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder={getDefaultUrl(provider)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-sm" />
              <input value={model} onChange={e => setModel(e.target.value)} placeholder={getDefaultModel(provider)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-sm" />
              <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="API-Key" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-sm" />
              <p className="text-xs text-gray-400 flex items-center gap-1"><Shield size={12} /> Key wird nur lokal gespeichert und nicht exportiert.</p>
              <p className="text-xs text-indigo-500">💡 Standard: {getDefaultUrl(provider)} / {getDefaultModel(provider)}</p>
            </>
          )}
        </div>
      </section>

      {/* Data */}
      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><Download size={18} /> Daten</h3>
        <div className="flex gap-2">
          <button onClick={exportData} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
            <Download size={16} /> Exportieren
          </button>
          <button onClick={() => toast.success('Import-Funktion kommt bald')} className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-600">
            <Upload size={16} /> Importieren
          </button>
        </div>
      </section>

      {/* Audit Log */}
      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <button onClick={() => setShowLogs(!showLogs)} className="font-semibold flex items-center gap-2 w-full text-left">
          <Shield size={18} /> KI-Aktionsprotokoll ({logs.length})
        </button>
        {showLogs && (
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-sm text-gray-400">Noch keine Aktionen protokolliert</p>
            ) : (
              logs.slice(-20).reverse().map(log => (
                <div key={log.id} className="text-xs p-2 rounded bg-gray-50 dark:bg-gray-700/50 flex justify-between">
                  <span>{log.action} → {log.entity}</span>
                  <span className="text-gray-400">{new Date(log.createdAt).toLocaleString('de-DE')}</span>
                </div>
              ))
            )}
          </div>
        )}
      </section>

      <button onClick={save} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
        <Save size={16} /> Speichern
      </button>
    </div>
  );
}
