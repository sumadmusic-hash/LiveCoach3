import { useState, useEffect } from 'react';
import { goalRepository } from '../../core/db/repositories/goalRepo';
import type { Goal, GoalStatus } from '../../core/schemas';
import { Plus, Target, TrendingUp, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

export default function GoalsView() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueAt, setDueAt] = useState('');

  useEffect(() => { loadGoals(); }, []);

  async function loadGoals() {
    setLoading(true);
    const g = await goalRepository.getAll();
    setGoals(g);
    setLoading(false);
  }

  async function createGoal() {
    if (!title.trim()) return;
    await goalRepository.create({ title: title.trim(), description: description || undefined, dueAt: dueAt || undefined, progress: 0, status: 'active', milestones: [] });
    setTitle(''); setDescription(''); setDueAt(''); setShowForm(false);
    loadGoals();
    toast.success('Ziel erstellt');
  }

  async function updateProgress(goal: Goal, progress: number) {
    const clamped = Math.max(0, Math.min(100, progress));
    await goalRepository.update(goal.id, { progress: clamped, status: clamped >= 100 ? 'completed' : goal.status });
    if (clamped >= 100) {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      toast.success('🎉 Ziel erreicht!');
    }
    loadGoals();
  }

  async function deleteGoal(id: string) {
    await goalRepository.delete(id);
    loadGoals();
    toast.success('Ziel gelöscht');
  }

  const statusColors: Record<GoalStatus, string> = {
    active: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400',
    paused: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400',
    completed: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400',
    abandoned: 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-400',
  };

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-32 bg-gray-200 dark:bg-gray-700 rounded" /></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ziele</h1>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
          <Plus size={16} /> Neues Ziel
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ziel..." className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-sm" />
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Beschreibung..." className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-sm resize-none h-20" />
          <input type="date" value={dueAt} onChange={e => setDueAt(e.target.value)} className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-sm" />
          <button onClick={createGoal} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">Erstellen</button>
        </div>
      )}

      {goals.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Target size={48} className="mx-auto mb-3 opacity-50" />
          <p>Noch keine Ziele definiert</p>
          <p className="text-sm mt-1">Erstelle dein erstes Ziel, um loszulegen!</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {goals.map(goal => (
            <div key={goal.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold">{goal.title}</h3>
                  {goal.description && <p className="text-sm text-gray-500 mt-0.5">{goal.description}</p>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[goal.status]}`}>{goal.status}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500" style={{ width: `${goal.progress}%` }} />
                </div>
                <span className="text-sm font-medium w-12 text-right">{goal.progress}%</span>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => updateProgress(goal, goal.progress - 10)} className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600">-10%</button>
                <button onClick={() => updateProgress(goal, goal.progress + 10)} className="text-xs px-2 py-1 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200">+10%</button>
                {goal.dueAt && <span className="text-xs text-gray-400 ml-auto">Fällig: {new Date(goal.dueAt).toLocaleDateString('de-DE')}</span>}
                <button onClick={() => deleteGoal(goal.id)} className="text-xs text-red-400 hover:text-red-600 ml-2">Löschen</button>
              </div>
              {goal.milestones.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <p className="text-xs font-medium text-gray-500 mb-1">Meilensteine</p>
                  {goal.milestones.map(m => (
                    <div key={m.id} className="flex items-center gap-2 text-xs">
                      {m.completed ? <CheckCircle size={12} className="text-green-500" /> : <div className="w-3 h-3 rounded-full border border-gray-300" />}
                      <span className={m.completed ? 'line-through text-gray-400' : ''}>{m.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
