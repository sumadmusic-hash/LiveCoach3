import { useState, useEffect } from 'react';
import { habitRepository } from '../../core/db/repositories/habitRepo';
import type { Habit, HabitLog } from '../../core/schemas';
import { Plus, Flame, Check } from 'lucide-react';
import { format, subDays } from 'date-fns';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

export default function HabitsView() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366f1');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [h, l] = await Promise.all([habitRepository.getAll(), habitRepository.getLogsForDate(format(new Date(), 'yyyy-MM-dd'))]);
    setHabits(h);
    setLogs(l);
    setLoading(false);
  }

  async function createHabit() {
    if (!name.trim()) return;
    await habitRepository.create({ name: name.trim(), color, frequency: 'daily', archived: false, targetPerWeek: 7 });
    setName(''); setShowForm(false);
    load();
    toast.success('Gewohnheit erstellt');
  }

  async function toggleToday(habit: Habit) {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const logged = logs.find(l => l.habitId === habit.id);
    if (logged) {
      await habitRepository.unlogHabit(habit.id, todayStr);
    } else {
      await habitRepository.logHabit(habit.id, todayStr);
      const allLogs = await habitRepository.getLogs(habit.id);
      if (allLogs.length > 0 && allLogs.length % 7 === 0) {
        confetti({ particleCount: 50, spread: 60 });
        toast.success('🔥 7-Tage Streak!');
      }
    }
    load();
  }

  async function deleteHabit(id: string) {
    await habitRepository.delete(id);
    load();
  }

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const last7Days = Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), 6 - i), 'yyyy-MM-dd'));

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-32 bg-gray-200 dark:bg-gray-700 rounded" /></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gewohnheiten</h1>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
          <Plus size={16} /> Neue
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Name..." className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-sm" onKeyDown={e => e.key === 'Enter' && createHabit()} />
          <div className="flex gap-2 items-center">
            <span className="text-sm text-gray-500">Farbe:</span>
            {['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6'].map(c => (
              <button key={c} onClick={() => setColor(c)} className={`w-6 h-6 rounded-full ${color === c ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`} style={{ backgroundColor: c }} />
            ))}
          </div>
          <button onClick={createHabit} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">Erstellen</button>
        </div>
      )}

      {/* Week overview */}
      <div className="flex gap-1 justify-end mb-2">
        {last7Days.map(d => (
          <div key={d} className="text-center">
            <div className="text-[10px] text-gray-400">{format(new Date(d), 'EE', { locale: undefined })[0]}</div>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${d === todayStr ? 'ring-2 ring-indigo-500' : ''}`}>
              <span className="text-xs">{format(new Date(d), 'd')}</span>
            </div>
          </div>
        ))}
      </div>

      {habits.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Flame size={48} className="mx-auto mb-3 opacity-50" />
          <p>Noch keine Gewohnheiten</p>
        </div>
      ) : (
        <div className="space-y-2">
          {habits.map(habit => {
            const todayLogged = logs.some(l => l.habitId === habit.id);
            return (
              <div key={habit.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-4">
                <button onClick={() => toggleToday(habit)} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${todayLogged ? 'text-white scale-110' : 'border-2 border-gray-300 dark:border-gray-600 hover:border-indigo-500'}`} style={todayLogged ? { backgroundColor: habit.color } : {}}>
                  {todayLogged && <Check size={20} />}
                </button>
                <div className="flex-1">
                  <p className="font-medium">{habit.name}</p>
                  <p className="text-xs text-gray-400">{habit.frequency === 'daily' ? 'Täglich' : 'Wöchentlich'}</p>
                </div>
                <button onClick={() => deleteHabit(habit.id)} className="text-xs text-red-400 hover:text-red-600">Löschen</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
