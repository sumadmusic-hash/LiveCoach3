import { useState, useEffect } from 'react';
import { calendarRepository } from '../../core/db/repositories';
import { taskRepository } from '../../core/db/repositories/taskRepo';
import type { CalendarEvent, Task } from '../../core/schemas';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import toast from 'react-hot-toast';

export default function CalendarView() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [e, t] = await Promise.all([calendarRepository.getAll(), taskRepository.getActive()]);
    setEvents(e);
    setTasks(t);
    setLoading(false);
  }

  async function createEvent() {
    if (!title.trim()) return;
    await calendarRepository.create({
      title: title.trim(),
      startAt: new Date(date).toISOString(),
      allDay: true,
      recurrence: 'none',
      color: '#3b82f6',
    });
    setTitle(''); setShowForm(false);
    load();
    toast.success('Termin erstellt');
  }

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });
  const weekDays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  const getEventsForDay = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const calEvents = events.filter(e => format(new Date(e.startAt), 'yyyy-MM-dd') === dateStr);
    const taskDeadlines = tasks.filter(t => t.dueAt && format(new Date(t.dueAt), 'yyyy-MM-dd') === dateStr && !t.completed);
    return { calEvents, taskDeadlines };
  };

  if (loading) return <div className="animate-pulse h-96 bg-gray-200 dark:bg-gray-700 rounded" />;

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Kalender</h1>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
          <Plus size={16} /> Termin
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titel..." className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-sm" />
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-sm" />
          <button onClick={createEvent} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">Erstellen</button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
          <ChevronLeft size={20} />
        </button>
        <h2 className="font-semibold text-lg">{format(currentMonth, 'MMMM yyyy')}</h2>
        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
          {weekDays.map(d => <div key={d} className="p-2 text-center text-xs font-medium text-gray-500">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {days.map(day => {
            const { calEvents, taskDeadlines } = getEventsForDay(day);
            const inMonth = isSameMonth(day, currentMonth);
            const today = isToday(day);
            return (
              <div key={day.toISOString()} className={`min-h-[80px] p-1 border-b border-r border-gray-100 dark:border-gray-700 ${!inMonth ? 'bg-gray-50 dark:bg-gray-800/50' : ''}`}>
                <span className={`text-xs inline-flex items-center justify-center w-6 h-6 rounded-full ${today ? 'bg-indigo-600 text-white' : ''}`}>
                  {format(day, 'd')}
                </span>
                {calEvents.map(e => (
                  <div key={e.id} className="text-[10px] px-1 py-0.5 mt-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 truncate">{e.title}</div>
                ))}
                {taskDeadlines.map(t => (
                  <div key={t.id} className="text-[10px] px-1 py-0.5 mt-0.5 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 truncate">{t.title}</div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
