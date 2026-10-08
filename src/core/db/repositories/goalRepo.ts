import { db } from '../dexie';
import { GoalSchema, type Goal } from '../../schemas';
import { generateId } from '../../utils/id';

export const goalRepository = {
  async getAll(): Promise<Goal[]> {
    return db.goals.toArray();
  },
  async getById(id: string): Promise<Goal | undefined> {
    return db.goals.get(id);
  },
  async create(data: Omit<Goal, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>): Promise<Goal> {
    const now = new Date().toISOString();
    const goal = GoalSchema.parse({
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    });
    await db.goals.add(goal);
    return goal;
  },
  async update(id: string, data: Partial<Goal>): Promise<Goal | undefined> {
    const existing = await db.goals.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    await db.goals.put(updated);
    return updated;
  },
  async delete(id: string): Promise<void> {
    await db.goals.delete(id);
  },
};
