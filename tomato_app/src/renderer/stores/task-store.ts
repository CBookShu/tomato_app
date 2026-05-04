import { create } from 'zustand';
import type { Task, TaskGroup, TaskStatus } from '@pomodoro/core';

interface TaskStoreState {
  tasks: Task[];
  groups: TaskGroup[];
  loading: boolean;

  setTasks: (tasks: Task[]) => void;
  setGroups: (groups: TaskGroup[]) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  removeTask: (id: string) => void;
  addGroup: (group: TaskGroup) => void;
  updateGroup: (id: string, updates: Partial<TaskGroup>) => void;
  removeGroup: (id: string) => void;
  getTasksByGroup: (groupId: string) => Task[];
  getTasksByStatus: (status: TaskStatus) => Task[];
  setLoading: (loading: boolean) => void;
}

export const useTaskStore = create<TaskStoreState>((set, get) => ({
  tasks: [],
  groups: [],
  loading: false,

  setTasks: (tasks) => set({ tasks }),
  setGroups: (groups) => set({ groups }),

  addTask: (task) => set((s) => ({ tasks: [...s.tasks, task] })),
  updateTask: (id, updates) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),
  removeTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

  addGroup: (group) => set((s) => ({ groups: [...s.groups, group] })),
  updateGroup: (id, updates) =>
    set((s) => ({
      groups: s.groups.map((g) => (g.id === id ? { ...g, ...updates } : g)),
    })),
  removeGroup: (id) => set((s) => ({ groups: s.groups.filter((g) => g.id !== id) })),

  getTasksByGroup: (groupId) => get().tasks.filter((t) => t.groupId === groupId),
  getTasksByStatus: (status) => get().tasks.filter((t) => t.status === status),

  setLoading: (loading) => set({ loading }),
}));
