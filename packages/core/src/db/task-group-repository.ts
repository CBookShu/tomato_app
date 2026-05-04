import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { taskGroups } from './schema.js';
import { TaskGroup } from '../types/task.js';

function rowToGroup(row: typeof taskGroups.$inferSelect): TaskGroup {
  return {
    id: row.id,
    name: row.name,
    color: row.color ?? undefined,
    taskOrder: JSON.parse(row.taskOrder),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class TaskGroupRepository {
  constructor(private db: BetterSQLite3Database) {}

  async findAll(): Promise<TaskGroup[]> {
    const rows = await this.db.select().from(taskGroups).all();
    return rows.map(rowToGroup);
  }

  async findById(id: string): Promise<TaskGroup | null> {
    const rows = await this.db
      .select()
      .from(taskGroups)
      .where(eq(taskGroups.id, id))
      .all();
    return rows.length > 0 ? rowToGroup(rows[0]) : null;
  }

  async create(group: TaskGroup): Promise<TaskGroup> {
    await this.db.insert(taskGroups).values({
      id: group.id,
      name: group.name,
      color: group.color ?? null,
      taskOrder: JSON.stringify(group.taskOrder),
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    });
    return group;
  }

  async update(id: string, updates: Partial<TaskGroup>): Promise<TaskGroup> {
    const existing = await this.findById(id);
    if (!existing) throw new Error(`TaskGroup ${id} not found`);

    const values: Record<string, unknown> = {};
    if (updates.name !== undefined) values.name = updates.name;
    if (updates.color !== undefined) values.color = updates.color;
    if (updates.taskOrder !== undefined) values.taskOrder = JSON.stringify(updates.taskOrder);
    values.updatedAt = new Date().toISOString();

    await this.db.update(taskGroups).set(values).where(eq(taskGroups.id, id));

    return (await this.findById(id))!;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(taskGroups).where(eq(taskGroups.id, id));
  }
}
