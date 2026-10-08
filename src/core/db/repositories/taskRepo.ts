import { db } from '../dexie';
import { TaskSchema, type Task } from '../../schemas';
import { generateId } from '../../utils/id';

export const taskRepository = {
  async getAll(): Promise<Task[]> {
    return db.tasks.filter(t => !t.deletedAt).toArray();
  },
  async getActive(): Promise<Task[]> {
    return db.tasks.filter(t => !t.deletedAt).toArray();
  },
  async getById(id: string): Promise<Task | undefined> {
    return db.tasks.get(id);
  },
  async create(data: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>): Promise<Task> {
    const now = new Date().toISOString();
    const task = TaskSchema.parse({
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    });
    await db.tasks.add(task);
    return task;
  },
  async update(id: string, data: Partial<Task>): Promise<Task | undefined> {
    const existing = await db.tasks.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    await db.tasks.put(updated);
    return updated;
  },
  async softDelete(id: string): Promise<void> {
    await db.tasks.update(id, { deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  },
  async restore(id: string): Promise<void> {
    await db.tasks.update(id, { deletedAt: undefined, updatedAt: new Date().toISOString() });
  },
  async complete(id: string): Promise<Task | undefined> {
    return this.update(id, { completed: true });
  },
  async uncomplete(id: string): Promise<Task | undefined> {
    return this.update(id, { completed: false });
  },
};
