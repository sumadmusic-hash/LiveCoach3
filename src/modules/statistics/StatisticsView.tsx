import { useState, useEffect } from 'react';
import { taskRepository } from '../../core/db/repositories/taskRepo';
import { habitRepository } from '../../core/db/repositories/habitRepo';
import { journalRepository } from '../../core/db/repositories/journalRepo';
import { focusRepository } from '../../core/db/repositories';
import type { Task, HabitLog, JournalEntry, FocusSession } from '../../core/schemas';
import { BarChart3 } from 'lucide-react';
import { format, subDays, eachDayOfInterval } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function StatisticsView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<7 | 14 | 30>(7);

  useEffect(() => { load(); }, [period]);

  async function load() {
    setLoading(true);
    const [t, h, j, s] = await Promise.all([
      taskRepository.getAll(),
      habitRepository.getAll().then(async () => {
        const allLogs: HabitLog[] = [];
        const days = eachDayOfInterval({ start: subDays(new Date(), period), end: new Date() });
        for (const day of days) {
          const logs = await habitRepository.getLogsForDate(format(day, 'yyyy-MM-dd'));
          allLogs.push(...logs);
        }
        return allLogs;
      }),
      journalRepository.getAll(),
      focusRepository.getAll(),
    ]);
    setTasks(t);
    setHabitLogs(h);
    setJournal(j);
    setSessions(s);
    setLoading(false);
  }

  const days = eachDayOfInterval({ start: subDays(new Date(), period - 1), end: new Date() });
  const taskData = days.map(day => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const completed = tasks.filter(t => t.completed && t.updatedAt.startsWith(dateStr)).length;
    return { date: format(day, 'dd.MM'), abgeschlossen: completed };
  });

  const habitData = days.map(day => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const count = habitLogs.filter(l => l.date === dateStr).length;
    return { date: format(day, 'dd.MM'), erledigt: count };
  });

  const moodData = journal
    .filter(e => e.mood)
    .slice(-period)
    .map(e => ({ date: format(new Date(e.date), 'dd.MM'), stimmung: e.mood }));

  const totalFocus = sessions.reduce((sum, s) => sum + s.duration, 0);
  const completedTasks = tasks.filter(t => t.completed).length;

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Statistiken</h1>
        <div className="flex gap-1">
          {([7, 14, 30] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1 rounded-lg text-sm ${period === p ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
              {p}T
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-2xl font-bold text-green-600">{completedTasks}</p>
          <p className="text-xs text-gray-500">Aufgaben erledigt</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-2xl font-bold text-blue-600">{habitLogs.length}</p>
          <p className="text-xs text-gray-500">Habit-Logs</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-2xl font-bold text-purple-600">{totalFocus}</p>
          <p className="text-xs text-gray-500">Fokus-Minuten</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-2xl font-bold text-orange-600">{journal.length}</p>
          <p className="text-xs text-gray-500">Journal-Einträge</p>
        </div>
      </div>

      {/* Charts */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="font-semibold mb-3">Aufgaben-Abschlüsse</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={taskData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="abgeschlossen" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="font-semibold mb-3">Gewohnheiten pro Tag</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={habitData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="erledigt" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {moodData.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="font-semibold mb-3">Stimmungsverlauf</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={moodData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis domain={[1, 5]} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="stimmung" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {tasks.length === 0 && habitLogs.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <BarChart3 size={48} className="mx-auto mb-3 opacity-50" />
          <p>Noch keine Daten für Statistiken vorhanden</p>
        </div>
      )}
    </div>
  );
}
