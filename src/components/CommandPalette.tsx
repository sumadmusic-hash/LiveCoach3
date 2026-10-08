import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import { useUiStore } from '../core/state/stores';
import { moduleRegistry } from '../core/modules/ModuleRegistry';
import { Search } from 'lucide-react';

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen, setTheme } = useUiStore();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (commandPaletteOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [commandPaletteOpen]);

  const handleSelect = (value: string) => {
    setCommandPaletteOpen(false);
    if (value.startsWith('nav:')) {
      const route = value.replace('nav:', '');
      navigate(route);
    } else if (value === 'theme:dark') {
      setTheme('dark');
    } else if (value === 'theme:light') {
      setTheme('light');
    } else if (value === 'theme:system') {
      setTheme('system');
    }
  };

  return (
    <Command.Dialog
      open={commandPaletteOpen}
      onOpenChange={setCommandPaletteOpen}
      label="Befehlspalette"
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]"
    >
      <div className="fixed inset-0 bg-black/50" onClick={() => setCommandPaletteOpen(false)} />
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <Command.Input
          ref={inputRef}
          placeholder="Befehl suchen..."
          className="w-full px-4 py-3 bg-transparent border-b border-gray-200 dark:border-gray-700 outline-none text-gray-900 dark:text-white placeholder-gray-400"
        />
        <Command.List className="max-h-80 overflow-y-auto p-2">
          <Command.Empty className="p-4 text-center text-gray-400 text-sm">Keine Ergebnisse</Command.Empty>
          
          <Command.Group heading="Navigation" className="p-2">
            {moduleRegistry.filter(m => m.enabled).map(mod => {
              const Icon = mod.icon;
              return (
                <Command.Item
                  key={mod.id}
                  value={`nav:${mod.route}`}
                  onSelect={handleSelect}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
                >
                  <Icon size={16} className="text-indigo-500" />
                  <span>{mod.name}</span>
                  <span className="text-xs text-gray-400 ml-auto">{mod.description}</span>
                </Command.Item>
              );
            })}
          </Command.Group>

          <Command.Group heading="Theme" className="p-2">
            {(['light', 'dark', 'system'] as const).map(t => (
              <Command.Item
                key={t}
                value={`theme:${t}`}
                onSelect={handleSelect}
                className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 text-sm capitalize"
              >
                <Search size={16} className="text-gray-400" />
                {t === 'light' ? 'Hell' : t === 'dark' ? 'Dunkel' : 'System'}
              </Command.Item>
            ))}
          </Command.Group>
        </Command.List>
      </div>
    </Command.Dialog>
  );
}
