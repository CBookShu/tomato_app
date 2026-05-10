export type TaskStatus = 'todo' | 'in-progress' | 'completed';

export interface Task {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly completedPomodoros: number;
  readonly status: TaskStatus;
  readonly groupId?: string;
  readonly lastPomodoroTime?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly completedAt?: string;
}

export interface NewTask {
  readonly title: string;
  readonly description?: string;
  readonly groupId?: string;
}

export interface TaskGroup {
  readonly id: string;
  readonly name: string;
  readonly color?: string;
  readonly taskOrder: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface NewTaskGroup {
  readonly name: string;
  readonly color?: string;
}

export const DEFAULT_GROUP_ID = 'default';
