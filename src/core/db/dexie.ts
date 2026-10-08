import Dexie, { type Table } from 'dexie';
import type { Task, Goal, Habit, HabitLog, JournalEntry, CalendarEvent, FocusSession, JobApplication, Offer, ChatMessage, AiActionLog, UserProfile, Settings } from '../schemas';

export class LifeOSDB extends Dexie {
  tasks!: Table<Task, string>;
  goals!: Table<Goal, string>;
  habits!: Table<Habit, string>;
  habitLogs!: Table<HabitLog, string>;
  journalEntries!: Table<JournalEntry, string>;
  calendarEvents!: Table<CalendarEvent, string>;
  focusSessions!: Table<FocusSession, string>;
  jobApplications!: Table<JobApplication, string>;
  offers!: Table<Offer, string>;
  chatMessages!: Table<ChatMessage, string>;
  aiActionLogs!: Table<AiActionLog, string>;
  userProfile!: Table<UserProfile, string>;
  settings!: Table<Settings & { id: string }, string>;

  constructor() {
    super('LifeOSDB');
    this.version(1).stores({
      tasks: 'id, priority, completed, dueAt, projectId, deletedAt',
      goals: 'id, status, dueAt',
      habits: 'id, frequency, archived',
      habitLogs: 'id, habitId, date',
      journalEntries: 'id, date, mood',
      calendarEvents: 'id, startAt',
      focusSessions: 'id, startedAt, completed',
      jobApplications: 'id, phase, dueAt',
      offers: 'id, store, category, expiry',
      chatMessages: 'id, role',
      aiActionLogs: 'id, action, entity',
      userProfile: 'id',
      settings: 'id',
    });
  }
}

export const db = new LifeOSDB();
