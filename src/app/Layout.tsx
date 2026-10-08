import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { moduleRegistry, getModulesByGroup } from '../core/modules/ModuleRegistry';
import { useUiStore } from '../core/state/stores';
import { Menu, X, ChevronDown, Zap } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { sidebarOpen, toggleSidebar } = useUiStore();
  const [moreOpen, setMoreOpen] = useState(false);
  const primary = getModulesByGroup('primary');
  const more = getModulesByGroup('more');

  const currentModule = moduleRegistry.find(m => location.pathname.startsWith(m.route));

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-200 overflow-hidden bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-shrink-0`}>
        <div className="p-4 h-full flex flex-col">
          <div className="flex items-center gap-2 mb-6">
            <Zap className="text-indigo-600" size={24} />
            <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">LifeOS</h1>
          </div>
          <nav className="flex-1 space-y-1">
            {primary.map(mod => {
              const Icon = mod.icon;
              const active = location.pathname.startsWith(mod.route);
              return (
                <Link
                  key={mod.id}
                  to={mod.route}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon size={18} />
                  {mod.name}
                </Link>
              );
            })}
            <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setMoreOpen(!moreOpen)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 w-full"
              >
                <ChevronDown size={18} className={`transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
                Mehr
              </button>
              {moreOpen && (
                <div className="ml-2 mt-1 space-y-1">
                  {more.map(mod => {
                    const Icon = mod.icon;
                    const active = location.pathname.startsWith(mod.route);
                    return (
                      <Link
                        key={mod.id}
                        to={mod.route}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                          active ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        <Icon size={16} />
                        {mod.name}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </nav>
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400">
            ⌘K für Befehle
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center px-4 gap-3 flex-shrink-0">
          <button onClick={toggleSidebar} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          {currentModule && (
            <div className="flex items-center gap-2">
              <currentModule.icon size={20} className="text-indigo-600" />
              <h2 className="font-semibold">{currentModule.name}</h2>
            </div>
          )}
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-around py-2 z-50">
        {primary.slice(0, 5).map(mod => {
          const Icon = mod.icon;
          const active = location.pathname.startsWith(mod.route);
          return (
            <Link key={mod.id} to={mod.route} className={`flex flex-col items-center gap-0.5 p-1 ${active ? 'text-indigo-600' : 'text-gray-400'}`}>
              <Icon size={20} />
              <span className="text-[10px]">{mod.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
