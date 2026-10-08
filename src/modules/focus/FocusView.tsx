import { useState, useEffect, useRef } from 'react';
import { focusRepository } from '../../core/db/repositories';
import type { FocusSession } from '../../core/schemas';
import { Timer, Play, Pause, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function FocusView() {
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [workDuration, setWorkDuration] = useState(25);
  const [breakDuration, setBreakDuration] = useState(5);
  const [isBreak, setIsBreak] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { loadSessions(); }, []);

  async function loadSessions() {
    const s = await focusRepository.getAll();
    setSessions(s);
  }

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(t => t - 1);
      }, 1000);
    } else if (timeLeft === 0 && isRunning) {
      handleComplete();
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, timeLeft]);

  async function handleComplete() {
    setIsRunning(false);
    if (!isBreak) {
      await focusRepository.create({
        duration: workDuration,
        completed: true,
        startedAt: new Date(Date.now() - workDuration * 60000).toISOString(),
        endedAt: new Date().toISOString(),
        taskIds: [],
      });
      toast.success('🎉 Fokus-Session abgeschlossen!');
      setIsBreak(true);
      setTimeLeft(breakDuration * 60);
      loadSessions();
    } else {
      toast.success('Pause beendet – bereit für die nächste Runde?');
      setIsBreak(false);
      setTimeLeft(workDuration * 60);
    }
  }

  function start() { setIsRunning(true); }
  function pause() { setIsRunning(false); }
  function reset() {
    setIsRunning(false);
    setIsBreak(false);
    setTimeLeft(workDuration * 60);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const progress = isBreak
    ? ((breakDuration * 60 - timeLeft) / (breakDuration * 60)) * 100
    : ((workDuration * 60 - timeLeft) / (workDuration * 60)) * 100;

  const totalMinutes = sessions.reduce((s, sess) => s + sess.duration, 0);

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20 md:pb-0">
      <h1 className="text-2xl font-bold">Fokus</h1>

      {/* Timer */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 text-center">
        <div className="relative w-48 h-48 mx-auto mb-6">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="4" className="text-gray-200 dark:text-gray-700" />
            <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray={`${2 * Math.PI * 45}`} strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`} className={`${isBreak ? 'text-green-500' : 'text-indigo-500'} transition-all duration-1000`} strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-mono font-bold">{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</span>
            <span className="text-xs text-gray-400 mt-1">{isBreak ? 'Pause' : 'Fokus'}</span>
          </div>
        </div>

        <div className="flex justify-center gap-3 mb-6">
          {!isRunning ? (
            <button onClick={start} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">
              <Play size={20} /> Start
            </button>
          ) : (
            <button onClick={pause} className="flex items-center gap-2 px-6 py-3 bg-yellow-500 text-white rounded-xl hover:bg-yellow-600">
              <Pause size={20} /> Pause
            </button>
          )}
          <button onClick={reset} className="flex items-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600">
            <RotateCcw size={20} />
          </button>
        </div>

        <div className="flex justify-center gap-4 text-sm">
          <div>
            <label className="text-gray-400 text-xs">Fokus (Min)</label>
            <input type="number" value={workDuration} onChange={e => { setWorkDuration(Number(e.target.value)); if (!isRunning && !isBreak) setTimeLeft(Number(e.target.value) * 60); }} className="w-16 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-transparent text-center" min={1} max={90} />
          </div>
          <div>
            <label className="text-gray-400 text-xs">Pause (Min)</label>
            <input type="number" value={breakDuration} onChange={e => setBreakDuration(Number(e.target.value))} className="w-16 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-transparent text-center" min={1} max={30} />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
          <Timer size={20} className="mx-auto text-indigo-500 mb-1" />
          <p className="text-2xl font-bold">{sessions.length}</p>
          <p className="text-xs text-gray-500">Sessions</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
          <Timer size={20} className="mx-auto text-green-500 mb-1" />
          <p className="text-2xl font-bold">{totalMinutes}</p>
          <p className="text-xs text-gray-500">Minuten gesamt</p>
        </div>
      </div>
    </div>
  );
}
