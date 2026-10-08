import { db } from '../dexie';
import { CalendarEventSchema, FocusSessionSchema, JobApplicationSchema, OfferSchema, ChatMessageSchema, AiActionLogSchema, UserProfileSchema, SettingsSchema, type CalendarEvent, type FocusSession, type JobApplication, type Offer, type ChatMessage, type AiActionLog, type UserProfile, type Settings } from '../../schemas';
import { generateId } from '../../utils/id';

export const calendarRepository = {
  async getAll(): Promise<CalendarEvent[]> { return db.calendarEvents.toArray(); },
  async create(data: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>): Promise<CalendarEvent> {
    const now = new Date().toISOString();
    const event = CalendarEventSchema.parse({ ...data, id: generateId(), createdAt: now, updatedAt: now, schemaVersion: 1 });
    await db.calendarEvents.add(event);
    return event;
  },
  async update(id: string, data: Partial<CalendarEvent>): Promise<void> {
    const existing = await db.calendarEvents.get(id);
    if (existing) await db.calendarEvents.put({ ...existing, ...data, updatedAt: new Date().toISOString() });
  },
  async delete(id: string): Promise<void> { await db.calendarEvents.delete(id); },
};

export const focusRepository = {
  async getAll(): Promise<FocusSession[]> { return db.focusSessions.toArray(); },
  async create(data: Omit<FocusSession, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>): Promise<FocusSession> {
    const now = new Date().toISOString();
    const session = FocusSessionSchema.parse({ ...data, id: generateId(), createdAt: now, updatedAt: now, schemaVersion: 1 });
    await db.focusSessions.add(session);
    return session;
  },
};

export const jobRepository = {
  async getAll(): Promise<JobApplication[]> { return db.jobApplications.toArray(); },
  async getById(id: string): Promise<JobApplication | undefined> { return db.jobApplications.get(id); },
  async create(data: Omit<JobApplication, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>): Promise<JobApplication> {
    const now = new Date().toISOString();
    const job = JobApplicationSchema.parse({ ...data, id: generateId(), createdAt: now, updatedAt: now, schemaVersion: 1 });
    await db.jobApplications.add(job);
    return job;
  },
  async update(id: string, data: Partial<JobApplication>): Promise<JobApplication | undefined> {
    const existing = await db.jobApplications.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    if (data.phase && data.phase !== existing.phase) {
      updated.history = [...(existing.history || []), { from: existing.phase, to: data.phase, at: new Date().toISOString() }];
    }
    await db.jobApplications.put(updated);
    return updated;
  },
  async delete(id: string): Promise<void> { await db.jobApplications.delete(id); },
};

export const offerRepository = {
  async getAll(): Promise<Offer[]> { return db.offers.toArray(); },
  async create(data: Omit<Offer, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>): Promise<Offer> {
    const now = new Date().toISOString();
    const offer = OfferSchema.parse({ ...data, id: generateId(), createdAt: now, updatedAt: now, schemaVersion: 1 });
    await db.offers.add(offer);
    return offer;
  },
  async delete(id: string): Promise<void> { await db.offers.delete(id); },
};

export const chatRepository = {
  async getAll(): Promise<ChatMessage[]> { return db.chatMessages.toArray(); },
  async create(data: Omit<ChatMessage, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>): Promise<ChatMessage> {
    const now = new Date().toISOString();
    const msg = ChatMessageSchema.parse({ ...data, id: generateId(), createdAt: now, updatedAt: now, schemaVersion: 1 });
    await db.chatMessages.add(msg);
    return msg;
  },
  async clear(): Promise<void> { await db.chatMessages.clear(); },
};

export const aiLogRepository = {
  async getAll(): Promise<AiActionLog[]> { return db.aiActionLogs.toArray(); },
  async create(data: Omit<AiActionLog, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>): Promise<AiActionLog> {
    const now = new Date().toISOString();
    const log = AiActionLogSchema.parse({ ...data, id: generateId(), createdAt: now, updatedAt: now, schemaVersion: 1 });
    await db.aiActionLogs.add(log);
    return log;
  },
};

export const profileRepository = {
  async get(): Promise<UserProfile | undefined> {
    return db.userProfile.get('default');
  },
  async save(data: Partial<UserProfile>): Promise<UserProfile> {
    const existing = await db.userProfile.get('default');
    const now = new Date().toISOString();
    if (existing) {
      const updated = { ...existing, ...data, updatedAt: now };
      await db.userProfile.put(updated);
      return updated;
    }
    const profile = UserProfileSchema.parse({ ...data, id: 'default', createdAt: now, updatedAt: now, schemaVersion: 1 });
    await db.userProfile.add(profile);
    return profile;
  },
};

export const settingsRepository = {
  async get(): Promise<Settings | undefined> {
    return db.settings.get('default');
  },
  async save(data: Partial<Settings>): Promise<Settings> {
    const existing = await db.settings.get('default');
    if (existing) {
      const updated = { ...existing, ...data };
      await db.settings.put(updated);
      return updated;
    }
    const settings = SettingsSchema.parse(data);
    const withId = { ...settings, id: 'default' } as Settings & { id: string };
    await db.settings.put(withId);
    return withId;
  },
};
