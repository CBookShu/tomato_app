import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { tasks } from './schema.js';
import { Task } from '../types/task.js';

function rowToTask(row: typeof tasks.$inferSelect): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    completedPomodoros: row.completedPomodoros,
    status: row.status as Task['status'],
    groupId: row.groupId ?? undefined,
    lastPomodoroTime: row.lastPomodoroTime ?? undefined,
    tags: row.tags ? JSON.parse(row.tags) : undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    completedAt: row.completedAt ?? undefined,
  };
}

export class TaskRepository {
  constructor(private db: BetterSQLite3Database) {}

  async findAll(): Promise<Task[]> {
    const rows = await this.db.select().from(tasks).all();
    return rows.map(rowToTask);
  }

  async findById(id: string): Promise<Task | null> {
    const rows = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.id, id))
      .all();
    return rows.length > 0 ? rowToTask(rows[0]) : null;
  }

  async findByGroup(groupId: string): Promise<Task[]> {
    const rows = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.groupId, groupId))
      .all();
    return rows.map(rowToTask);
  }

  async create(task: Task): Promise<Task> {
    await this.db.insert(tasks).values({
      id: task.id,
      title: task.title,
      description: task.description ?? null,
      completedPomodoros: task.completedPomodoros,
      status: task.status,
      groupId: task.groupId ?? null,
      lastPomodoroTime: task.lastPomodoroTime ?? null,
      tags: task.tags ? JSON.stringify(task.tags) : null,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      completedAt: task.completedAt ?? null,
    });
    return task;
  }

  async update(id: string, updates: Partial<Task>): Promise<Task> {
    const existing = await this.findById(id);
    if (!existing) throw new Error(`Task ${id} not found`);

    const values: Record<string, unknown> = {};
    if (updates.title !== undefined) values.title = updates.title;
    if (updates.description !== undefined) values.description = updates.description;
    if (updates.completedPomodoros !== undefined) values.completedPomodoros = updates.completedPomodoros;
    if (updates.status !== undefined) values.status = updates.status;
    if (updates.groupId !== undefined) values.groupId = updates.groupId;
    if (updates.lastPomodoroTime !== undefined) values.lastPomodoroTime = updates.lastPomodoroTime;
    if (updates.tags !== undefined) values.tags = JSON.stringify(updates.tags);
    if (updates.completedAt !== undefined) values.completedAt = updates.completedAt;
    values.updatedAt = new Date().toISOString();

    await this.db.update(tasks).set(values).where(eq(tasks.id, id));

    return (await this.findById(id))!;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(tasks).where(eq(tasks.id, id));
  }
}
