import React, { Suspense, lazy, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useUiStore } from './core/state/stores';
import { Layout } from './app/Layout';
import { CommandPalette } from './components/CommandPalette';
import { Toaster } from 'react-hot-toast';

const TodayView = lazy(() => import('./modules/today/TodayView'));
const TasksView = lazy(() => import('./modules/tasks/TasksView'));
const GoalsView = lazy(() => import('./modules/goals/GoalsView'));
const HabitsView = lazy(() => import('./modules/habits/HabitsView'));
const JournalView = lazy(() => import('./modules/journal/JournalView'));
const ChatView = lazy(() => import('./modules/chat/ChatView'));
const StatisticsView = lazy(() => import('./modules/statistics/StatisticsView'));
const CalendarView = lazy(() => import('./modules/calendar/CalendarView'));
const FocusView = lazy(() => import('./modules/focus/FocusView'));
const JobsView = lazy(() => import('./modules/jobs/JobsView'));
const OffersView = lazy(() => import('./modules/offers/OffersView'));
const ProfileView = lazy(() => import('./modules/profile/ProfileView'));
const SettingsView = lazy(() => import('./modules/settings/SettingsView'));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>
  );
}

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/" element={<Navigate to="/today" replace />} />
        <Route path="/today" element={<TodayView />} />
        <Route path="/tasks" element={<TasksView />} />
        <Route path="/goals" element={<GoalsView />} />
        <Route path="/goals/:goalId" element={<GoalsView />} />
        <Route path="/habits" element={<HabitsView />} />
        <Route path="/journal" element={<JournalView />} />
        <Route path="/chat" element={<ChatView />} />
        <Route path="/statistics" element={<StatisticsView />} />
        <Route path="/calendar" element={<CalendarView />} />
        <Route path="/focus" element={<FocusView />} />
        <Route path="/jobs" element={<JobsView />} />
        <Route path="/offers" element={<OffersView />} />
        <Route path="/profile" element={<ProfileView />} />
        <Route path="/settings" element={<SettingsView />} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Routes>
    </Suspense>
  );
}

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useUiStore(s => s.theme);
  const [resolved, setResolved] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      setResolved(mq.matches ? 'dark' : 'light');
      const handler = (e: MediaQueryListEvent) => setResolved(e.matches ? 'dark' : 'light');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
    setResolved(theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark');
  }, [resolved]);

  return <>{children}</>;
}

function KeyboardShortcuts() {
  const { toggleSidebar, setCommandPaletteOpen } = useUiStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        const current = useUiStore.getState().theme;
        useUiStore.getState().setTheme(current === 'dark' ? 'light' : 'dark');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleSidebar, setCommandPaletteOpen]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <Layout>
          <AppRoutes />
        </Layout>
        <CommandPalette />
        <KeyboardShortcuts />
        <Toaster position="bottom-right" toastOptions={{
          className: 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-lg rounded-lg',
        }} />
      </ThemeProvider>
    </BrowserRouter>
  );
}
