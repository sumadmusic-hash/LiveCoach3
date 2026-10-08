import { db } from '../dexie';
import { HabitSchema, HabitLogSchema, type Habit, type HabitLog } from '../../schemas';
import { generateId } from '../../utils/id';

export const habitRepository = {
  async getAll(): Promise<Habit[]> {
    return db.habits.filter(h => !h.archived).toArray();
  },
  async getById(id: string): Promise<Habit | undefined> {
    return db.habits.get(id);
  },
  async create(data: Omit<Habit, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>): Promise<Habit> {
    const now = new Date().toISOString();
    const habit = HabitSchema.parse({
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    });
    await db.habits.add(habit);
    return habit;
  },
  async update(id: string, data: Partial<Habit>): Promise<Habit | undefined> {
    const existing = await db.habits.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    await db.habits.put(updated);
    return updated;
  },
  async delete(id: string): Promise<void> {
    await db.habits.delete(id);
  },
  async getLogs(habitId: string): Promise<HabitLog[]> {
    return db.habitLogs.where('habitId').equals(habitId).toArray();
  },
  async logHabit(habitId: string, date: string, mood?: number, note?: string): Promise<HabitLog> {
    const now = new Date().toISOString();
    const log = HabitLogSchema.parse({
      id: generateId(),
      habitId,
      date,
      completed: true,
      mood,
      note,
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    });
    await db.habitLogs.add(log);
    return log;
  },
  async unlogHabit(habitId: string, date: string): Promise<void> {
    const logs = await db.habitLogs.where('habitId').equals(habitId).and(l => l.date === date).toArray();
    for (const log of logs) {
      await db.habitLogs.delete(log.id);
    }
  },
  async getLogsForDate(date: string): Promise<HabitLog[]> {
    return db.habitLogs.where('date').equals(date).toArray();
  },
};
