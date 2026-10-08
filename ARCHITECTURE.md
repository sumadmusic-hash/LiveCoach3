# LifeOS – Architektur

## Überblick

LifeOS folgt dem Local-first-Prinzip mit modularer Architektur. Alle Daten werden im Browser gespeichert, KI-Integration ist optional.

## Datenfluss

```
UI Component → Repository → Dexie (IndexedDB)
                ↓
           Zod Schema (Validation)
                ↓
           Zustand (UI State)
```

### Regeln
1. UI-Komponenten greifen NIE direkt auf Dexie zu
2. Alle Schreiboperationen laufen über Repositories
3. Zustand hält nur UI-/Session-State
4. Zod validiert alle Daten an der Grenze

## Module Registry

Die Registry (`src/core/modules/ModuleRegistry.ts`) ist Single Source of Truth für:
- Modul-IDs und Routen
- Anzeigenamen und Icons
- Navigation (Sidebar, Mobile Nav, Command Palette)
- Berechtigungen

Validierung stellt sicher:
- Eindeutige IDs und Routen
- Gültige Icon-Komponenten
- Keine verwaisten Navigationsziele

## State Management

### Zustand Stores
- `useUiStore`: Theme, Sidebar, Command Palette
- `useUndoStore`: Undo-Stack für kritische Aktionen
- `useAiSessionStore`: KI-Streaming-Status

### Persistenz
- Dexie (IndexedDB) für alle Entitäten
- Repositories kapseln CRUD-Operationen
- Automatische `updatedAt`-Verwaltung

## KI-System

### Architektur
```
User Input → LocalCommandParser → (erfolgreich?) → Direkt ausführen
                                    ↓ (nein)
                              AIService → Provider Adapter → Streaming
                                    ↓
                              Tool Registry → Repositories
                                    ↓
                              Audit Log + Undo Entry
```

### Provider Adapter
Jeder Provider implementiert:
- `stream()` für Token-für-Token-Antworten
- `healthcheck()` für Verbindungsprüfung
- `listModels()` für verfügbare Modelle

### Tools
KI-Tools sind Zod-validierte Funktionen:
- `navigate_to`: Navigation zu Modulen
- `create_task`, `complete_task`: Aufgaben-Management
- `create_goal`, `update_goal_progress`: Ziele
- `log_habit`: Gewohnheiten
- `create_journal_entry`: Journal
- `update_user_profile`: Profil-Aktualisierung

### Sicherheit
- API-Keys werden nie exportiert
- Keine sensiblen Daten in Prompts
- Rate-Limiting konfigurierbar
- AbortController für Streaming-Abbruch

## Ordnerstruktur

```
src/
├── app/          App-Shell, Layout, Router
├── core/
│   ├── config/   Konstanten, Environment
│   ├── db/       Dexie, Repositories
│   ├── schemas/  Zod-Schemas (Single Source)
│   ├── modules/  Module Registry
│   ├── state/    Zustand Stores
│   └── utils/    Hilfsfunktionen
├── modules/      Feature-Module (13)
│   ├── today/
│   ├── tasks/
│   ├── goals/
│   ├── habits/
│   ├── journal/
│   ├── chat/
│   ├── statistics/
│   ├── calendar/
│   ├── focus/
│   ├── jobs/
│   ├── offers/
│   ├── profile/
│   └── settings/
└── components/   Shared UI-Komponenten
```

## Entscheidungsgründe

### Warum Dexie statt localStorage?
- Strukturierte Daten mit Indizes
- Transaktionen für Konsistenz
- Bessere Performance bei großen Datenmengen
- Migration-Support

### Warum Zustand statt Context?
- Keine Re-Render-Kaskaden
- Selektive Subscriptions
- Einfachere Testbarkeit
- DevTools-Integration

### Warum Zod?
- Runtime-Validierung
- TypeScript-Typ-Ableitung
- Single Source für Schemas
- Komposition und Transformation

### Warum Module Registry?
- Single Source of Truth für Navigation
- Validierung zur Build-Zeit
- Einfache Erweiterbarkeit
- Konsistente UI überall

## Sicherheit

1. **XSS**: Kein dangerouslySetInnerHTML, Markdown-Lite-Renderer
2. **Datenleck**: Export ohne API-Keys
3. **Prompt Injection**: Externe Inhalte als unsicher markiert
4. **Rate Limiting**: Konfigurierbare Limits pro Tab
5. **Abort**: Jeder Request abortbar

## Performance

- Lazy Loading aller Module
- Virtualisierte Listen für große Datenmengen
- Memoization für Aggregationen
- Selektive Zustand-Subscriptions
- Keine DB-Reads im Render
