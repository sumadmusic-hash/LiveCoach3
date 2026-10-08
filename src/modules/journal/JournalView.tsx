import { useState, useEffect } from 'react';
import { journalRepository } from '../../core/db/repositories/journalRepo';
import type { JournalEntry } from '../../core/schemas';
import { Plus, BookOpen, Search } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function JournalView() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<number | undefined>(undefined);
  const [tags, setTags] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const e = await journalRepository.getAll();
    setEntries(e);
    setLoading(false);
  }

  async function createEntry() {
    if (!content.trim()) return;
    await journalRepository.create({
      date: format(new Date(), 'yyyy-MM-dd'),
      content: content.trim(),
      mood,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    });
    setContent(''); setMood(undefined); setTags(''); setShowForm(false);
    load();
    toast.success('Eintrag gespeichert');
  }

  async function deleteEntry(id: string) {
    await journalRepository.delete(id);
    load();
  }

  const filtered = entries.filter(e => !search || e.content.toLowerCase().includes(search.toLowerCase()) || e.tags.some(t => t.toLowerCase().includes(search.toLowerCase())));

  const moodEmojis = ['', '😞', '😕', '😐', '😊', '😄'];

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-32 bg-gray-200 dark:bg-gray-700 rounded" /></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Journal</h1>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
          <Plus size={16} /> Neuer Eintrag
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
          <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Was beschäftigt dich heute?" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-sm resize-none h-32" />
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">Stimmung:</span>
            {[1, 2, 3, 4, 5].map(m => (
              <button key={m} onClick={() => setMood(mood === m ? undefined : m)} className={`text-xl ${mood === m ? 'scale-125' : 'opacity-50'} transition-transform`}>
                {moodEmojis[m]}
              </button>
            ))}
          </div>
          <input value={tags} onChange={e => setTags(e.target.value)} placeholder="Tags (Komma)" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-sm" />
          <button onClick={createEntry} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">Speichern</button>
        </div>
      )}

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Einträge durchsuchen..." className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm" />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <BookOpen size={48} className="mx-auto mb-3 opacity-50" />
          <p>Noch keine Einträge</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(entry => (
            <div key={entry.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">{new Date(entry.date).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                <div className="flex items-center gap-2">
                  {entry.mood && <span className="text-lg">{moodEmojis[entry.mood]}</span>}
                  <button onClick={() => deleteEntry(entry.id)} className="text-xs text-red-400 hover:text-red-600">Löschen</button>
                </div>
              </div>
              <p className="text-sm whitespace-pre-wrap">{entry.content}</p>
              {entry.tags.length > 0 && (
                <div className="flex gap-1 mt-2">
                  {entry.tags.map(tag => <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500">{tag}</span>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
