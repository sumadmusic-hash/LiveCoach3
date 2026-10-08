import { useState, useEffect } from 'react';
import { taskRepository } from '../../core/db/repositories/taskRepo';
import { habitRepository } from '../../core/db/repositories/habitRepo';
import { goalRepository } from '../../core/db/repositories/goalRepo';
import type { Task, Habit, Goal } from '../../core/schemas';
import { CheckCircle2, Circle, Flame, Target, ListTodo, Sparkles } from 'lucide-react';
import { format, isToday, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

export default function TodayView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [t, h, g] = await Promise.all([
      taskRepository.getActive(),
      habitRepository.getAll(),
      goalRepository.getAll(),
    ]);
    setTasks(t);
    setHabits(h);
    setGoals(g);
    setLoading(false);
  }

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const dueTasks = tasks.filter(t => t.dueAt && isToday(parseISO(t.dueAt)));
  const pendingTasks = tasks.filter(t => !t.completed).slice(0, 5);
  const activeGoals = goals.filter(g => g.status === 'active').slice(0, 3);

  async function toggleTask(id: string, completed: boolean) {
    if (completed) {
      await taskRepository.uncomplete(id);
    } else {
      await taskRepository.complete(id);
    }
    loadData();
  }

  async function toggleHabit(habitId: string) {
    const logs = await habitRepository.getLogsForDate(todayStr);
    const logged = logs.find(l => l.habitId === habitId);
    if (logged) {
      await habitRepository.unlogHabit(habitId, todayStr);
    } else {
      await habitRepository.logHabit(habitId, todayStr);
    }
    loadData();
  }

  if (loading) {
    return <div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48" /><div className="h-32 bg-gray-200 dark:bg-gray-700 rounded" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 md:pb-0">
      <div>
        <h1 className="text-2xl font-bold">Guten Tag! 👋</h1>
        <p className="text-gray-500 dark:text-gray-400">{format(new Date(), "EEEE, d. MMMM yyyy", { locale: de })}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <ListTodo size={20} className="text-blue-500 mb-2" />
          <p className="text-2xl font-bold">{pendingTasks.length}</p>
          <p className="text-xs text-gray-500">Offene Aufgaben</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <Flame size={20} className="text-orange-500 mb-2" />
          <p className="text-2xl font-bold">{habits.length}</p>
          <p className="text-xs text-gray-500">Gewohnheiten</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <Target size={20} className="text-green-500 mb-2" />
          <p className="text-2xl font-bold">{activeGoals.length}</p>
          <p className="text-xs text-gray-500">Aktive Ziele</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <Sparkles size={20} className="text-purple-500 mb-2" />
          <p className="text-2xl font-bold">{dueTasks.length}</p>
          <p className="text-xs text-gray-500">Heute fällig</p>
        </div>
      </div>

      {/* Due Today */}
      {dueTasks.length > 0 && (
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            Heute fällig
          </h2>
          <div className="space-y-2">
            {dueTasks.map(task => (
              <div key={task.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <button onClick={() => toggleTask(task.id, task.completed)}>
                  {task.completed ? <CheckCircle2 className="text-green-500" size={20} /> : <Circle size={20} className="text-gray-300" />}
                </button>
                <span className={task.completed ? 'line-through text-gray-400' : ''}>{task.title}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Habits Today */}
      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="font-semibold mb-3">Heutige Gewohnheiten</h2>
        {habits.length === 0 ? (
          <p className="text-sm text-gray-400">Noch keine Gewohnheiten angelegt.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {habits.map(habit => (
              <button
                key={habit.id}
                onClick={() => toggleHabit(habit.id)}
                className="px-3 py-2 rounded-full text-sm font-medium border transition-all"
                style={{
                  backgroundColor: habit.color + '20',
                  borderColor: habit.color,
                  color: habit.color,
                }}
              >
                {habit.name}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Active Goals */}
      {activeGoals.length > 0 && (
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="font-semibold mb-3">Aktive Ziele</h2>
          <div className="space-y-3">
            {activeGoals.map(goal => (
              <div key={goal.id}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{goal.title}</span>
                  <span className="text-gray-400">{goal.progress}%</span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${goal.progress}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* AI Suggestion Placeholder */}
      <section className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={16} className="text-indigo-500" />
          <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">KI-Vorschlag</span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Konfiguriere einen KI-Provider in den Einstellungen, um personalisierte Vorschläge zu erhalten.
        </p>
      </section>
    </div>
  );
}
