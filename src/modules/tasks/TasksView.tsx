import { useState, useEffect } from 'react';
import { taskRepository } from '../../core/db/repositories/taskRepo';
import { useUndoStore } from '../../core/state/stores';
import type { Task, Priority } from '../../core/schemas';
import { Plus, Search, Filter, CheckCircle2, Circle, Trash2, Undo2 } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function TasksView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState<Priority | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'done'>('all');
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('medium');
  const [newDue, setNewDue] = useState('');
  const [newTags, setNewTags] = useState('');
  const { pushUndo } = useUndoStore();

  useEffect(() => { loadTasks(); }, []);

  async function loadTasks() {
    setLoading(true);
    const all = await taskRepository.getActive();
    setTasks(all);
    setLoading(false);
  }

  async function createTask() {
    if (!newTitle.trim()) return;
    await taskRepository.create({
      title: newTitle.trim(),
      priority: newPriority,
      dueAt: newDue || undefined,
      tags: newTags.split(',').map(t => t.trim()).filter(Boolean),
      completed: false,
    });
    setNewTitle('');
    setNewDue('');
    setNewTags('');
    setShowForm(false);
    loadTasks();
    toast.success('Aufgabe erstellt');
  }

  async function toggleComplete(task: Task) {
    if (task.completed) {
      await taskRepository.uncomplete(task.id);
    } else {
      await taskRepository.complete(task.id);
    }
    loadTasks();
  }

  async function deleteTask(task: Task) {
    await taskRepository.softDelete(task.id);
    pushUndo({
      action: `Aufgabe "${task.title}" gelöscht`,
      undo: async () => { await taskRepository.restore(task.id); loadTasks(); },
    });
    toast.success('Aufgabe gelöscht', { icon: '🗑️' });
    loadTasks();
  }

  const filtered = tasks
    .filter(t => filterPriority === 'all' || t.priority === filterPriority)
    .filter(t => filterStatus === 'all' || (filterStatus === 'open' ? !t.completed : t.completed))
    .filter(t => !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase())))
    .sort((a, b) => {
      const prio = { urgent: 0, high: 1, medium: 2, low: 3 };
      return (prio[a.priority] ?? 2) - (prio[b.priority] ?? 2);
    });

  const priorityColors: Record<Priority, string> = {
    urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    low: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  };

  if (loading) return <div className="animate-pulse space-y-3"><div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" /><div className="h-32 bg-gray-200 dark:bg-gray-700 rounded" /></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Aufgaben</h1>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
          <Plus size={16} /> Neu
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
          <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Aufgabe..." className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-sm" onKeyDown={e => e.key === 'Enter' && createTask()} />
          <div className="flex gap-2 flex-wrap">
            <select value={newPriority} onChange={e => setNewPriority(e.target.value as Priority)} className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-sm">
              <option value="low">Niedrig</option>
              <option value="medium">Mittel</option>
              <option value="high">Hoch</option>
              <option value="urgent">Dringend</option>
            </select>
            <input type="date" value={newDue} onChange={e => setNewDue(e.target.value)} className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-sm" />
            <input value={newTags} onChange={e => setNewTags(e.target.value)} placeholder="Tags (Komma)" className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-sm flex-1" />
          </div>
          <button onClick={createTask} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">Erstellen</button>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Suchen..." className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm" />
        </div>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value as Priority | 'all')} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm">
          <option value="all">Alle Prioritäten</option>
          <option value="urgent">Dringend</option>
          <option value="high">Hoch</option>
          <option value="medium">Mittel</option>
          <option value="low">Niedrig</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as 'all' | 'open' | 'done')} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm">
          <option value="all">Alle</option>
          <option value="open">Offen</option>
          <option value="done">Erledigt</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <CheckCircle2 size={48} className="mx-auto mb-3 opacity-50" />
          <p>Keine Aufgaben gefunden</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(task => (
            <div key={task.id} className={`flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 group ${task.completed ? 'opacity-60' : ''}`}>
              <button onClick={() => toggleComplete(task)}>
                {task.completed ? <CheckCircle2 className="text-green-500" size={20} /> : <Circle size={20} className="text-gray-300 hover:text-indigo-500" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${task.completed ? 'line-through text-gray-400' : ''}`}>{task.title}</p>
                <div className="flex gap-2 mt-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${priorityColors[task.priority]}`}>{task.priority}</span>
                  {task.dueAt && <span className="text-[10px] text-gray-400">{format(new Date(task.dueAt), 'd.M.')}</span>}
                  {task.tags.map(tag => <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500">{tag}</span>)}
                </div>
              </div>
              <button onClick={() => deleteTask(task)} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-opacity">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
