import { create } from 'zustand';
import type { Task, TaskGroup, TaskStatus } from '@pomodoro/core';

interface TaskStoreState {
  tasks: Task[];
  groups: TaskGroup[];
  loading: boolean;
  selectedTaskId: string | null;
  collapsedGroups: Set<string>;

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
  selectTask: (id: string | null) => void;
  toggleGroupCollapse: (groupId: string) => void;
  getSelectedTask: () => Task | null;
}

export const useTaskStore = create<TaskStoreState>((set, get) => ({
  tasks: [],
  groups: [],
  loading: false,
  selectedTaskId: null,
  collapsedGroups: new Set<string>(),

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

  selectTask: (id) => set({ selectedTaskId: id }),

  toggleGroupCollapse: (groupId) =>
    set((s) => {
      const next = new Set(s.collapsedGroups);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return { collapsedGroups: next };
    }),

  getSelectedTask: () => {
    const { tasks, selectedTaskId } = get();
    return tasks.find((t) => t.id === selectedTaskId) ?? null;
  },
}));
