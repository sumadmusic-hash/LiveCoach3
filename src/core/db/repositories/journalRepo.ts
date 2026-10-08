import { db } from '../dexie';
import { JournalEntrySchema, type JournalEntry } from '../../schemas';
import { generateId } from '../../utils/id';

export const journalRepository = {
  async getAll(): Promise<JournalEntry[]> {
    return db.journalEntries.orderBy('date').reverse().toArray();
  },
  async getById(id: string): Promise<JournalEntry | undefined> {
    return db.journalEntries.get(id);
  },
  async getByDate(date: string): Promise<JournalEntry | undefined> {
    return db.journalEntries.where('date').equals(date).first();
  },
  async create(data: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>): Promise<JournalEntry> {
    const now = new Date().toISOString();
    const entry = JournalEntrySchema.parse({
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    });
    await db.journalEntries.add(entry);
    return entry;
  },
  async update(id: string, data: Partial<JournalEntry>): Promise<JournalEntry | undefined> {
    const existing = await db.journalEntries.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    await db.journalEntries.put(updated);
    return updated;
  },
  async delete(id: string): Promise<void> {
    await db.journalEntries.delete(id);
  },
};
