import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const taskGroups = sqliteTable('task_groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color'),
  taskOrder: text('task_order').notNull().default('[]'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  completedPomodoros: integer('completed_pomodoros').notNull().default(0),
  status: text('status').notNull().default('todo'),
  groupId: text('group_id').references(() => taskGroups.id),
  lastPomodoroTime: text('last_pomodoro_time'),
  tags: text('tags').default('[]'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  completedAt: text('completed_at'),
});

export const dailyStats = sqliteTable('daily_stats', {
  date: text('date').primaryKey(),
  totalPomodoros: integer('total_pomodoros').notNull().default(0),
  completedTasks: integer('completed_tasks').notNull().default(0),
  tasks: text('tasks').notNull().default('[]'),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
