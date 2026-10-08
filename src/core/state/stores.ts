import { create } from 'zustand';
import type { ModuleId } from '../modules/ModuleRegistry';

interface UiState {
  sidebarOpen: boolean;
  theme: 'light' | 'dark' | 'system';
  commandPaletteOpen: boolean;
  activeModule: ModuleId;
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setActiveModule: (id: ModuleId) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  theme: 'system',
  commandPaletteOpen: false,
  activeModule: 'today',
  toggleSidebar: () => set(s => ({ sidebarOpen: !s.sidebarOpen })),
  setTheme: (theme) => set({ theme }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setActiveModule: (id) => set({ activeModule: id }),
}));

interface UndoEntry {
  id: string;
  action: string;
  undo: () => Promise<void>;
  timestamp: number;
}

interface UndoState {
  stack: UndoEntry[];
  pushUndo: (entry: Omit<UndoEntry, 'id' | 'timestamp'>) => void;
  popUndo: () => UndoEntry | undefined;
  clear: () => void;
}

export const useUndoStore = create<UndoState>((set, get) => ({
  stack: [],
  pushUndo: (entry) => set(s => ({
    stack: [...s.stack, { ...entry, id: crypto.randomUUID(), timestamp: Date.now() }]
  })),
  popUndo: () => {
    const stack = get().stack;
    if (stack.length === 0) return undefined;
    const entry = stack[stack.length - 1];
    set({ stack: stack.slice(0, -1) });
    return entry;
  },
  clear: () => set({ stack: [] }),
}));

interface AiSessionState {
  isStreaming: boolean;
  abortController: AbortController | null;
  setStreaming: (v: boolean) => void;
  setAbortController: (c: AbortController | null) => void;
}

export const useAiSessionStore = create<AiSessionState>((set) => ({
  isStreaming: false,
  abortController: null,
  setStreaming: (v) => set({ isStreaming: v }),
  setAbortController: (c) => set({ abortController: c }),
}));
