# LifeOS – Personal Life Assistant

Eine lokale, datensouveräne Personal-Life-Assistant-App für Desktop und Mobile.

## Features

- **13 Module**: Heute, Aufgaben, Ziele, Gewohnheiten, Journal, KI-Chat, Statistiken, Kalender, Fokus, JobBoard, Angebote, Profil, Einstellungen
- **Local-first**: Alle Daten werden im Browser (IndexedDB via Dexie) gespeichert
- **KI-Integration**: Konfigurierbare Provider (Ollama, OpenAI, Anthropic, Groq, Gemini, OpenRouter)
- **Undo-System**: Kritische Aktionen können rückgängig gemacht werden
- **Command Palette**: ⌘/Strg+K für schnelle Navigation
- **Dark Mode**: Hell/Dunkel/System-Theme
- **PWA-Ready**: Installierbar als App
- **Responsives Design**: Desktop + Mobile mit Bottom-Navigation

## Setup

```bash
npm install
npm run dev
```

## Scripts

| Befehl | Beschreibung |
|--------|-------------|
| `npm run dev` | Development-Server starten |
| `npm run build` | Production-Build erstellen |
| `npm run typecheck` | TypeScript-Prüfung |

## KI-Provider konfigurieren

1. Öffne die Einstellungen (⚙️)
2. Wähle einen Provider aus
3. Gib die API-URL und den API-Key ein
4. Optional: Modell angeben

Unterstützte Provider:
- **Ollama** (lokal): `http://localhost:11434`
- **OpenAI**: `https://api.openai.com/v1`
- **Anthropic**: `https://api.anthropic.com`
- **Groq**: `https://api.groq.com/openai/v1`
- **Google Gemini**: `https://generativelanguage.googleapis.com`
- **OpenRouter**: `https://openrouter.ai/api/v1`

## Tastenkürzel

| Kürzel | Aktion |
|--------|--------|
| `⌘/Strg + K` | Command Palette öffnen |
| `⌘/Strg + B` | Sidebar ein/ausblenden |
| `⌘/Strg + Shift + D` | Theme wechseln |
| `1-9` | Zu Modul navigieren |

## Troubleshooting

### KI-Chat funktioniert nicht
- Prüfe, ob ein Provider konfiguriert ist
- Ohne Provider funktioniert die App im Offline-Modus vollständig

### Daten verloren?
- Alle Daten sind in IndexedDB gespeichert
- Nutze Export in den Einstellungen für Backups
- Browser-Daten löschen entfernt alle Daten

### Preisvergleich-API nicht erreichbar
- Die Supermarket-Price-API ist ein externer Dienst
- Bei Fehlern wird eine klare Offline-Meldung angezeigt
- Der Scanner funktioniert lokal ohne Internet

## Tech-Stack

- React 18, TypeScript, Vite
- Tailwind CSS 4
- Zustand (State), Dexie (IndexedDB), Zod (Validation)
- React Router v6, Recharts, date-fns
- @dnd-kit (Drag & Drop), cmdk (Command Palette)
- lucide-react (Icons), framer-motion (Animationen)
- canvas-confetti (Celebrations), react-hot-toast
