import React from 'react';
import { Timer, ListTodo, BarChart3, Settings } from 'lucide-react';
import { useTimerStore } from '@/stores/timer-store.js';

type Tab = 'timer' | 'tasks' | 'stats' | 'settings';

interface AppShellProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  children: React.ReactNode;
}

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'timer', label: '计时', icon: <Timer className="h-5 w-5" /> },
  { id: 'tasks', label: '任务', icon: <ListTodo className="h-5 w-5" /> },
  { id: 'stats', label: '统计', icon: <BarChart3 className="h-5 w-5" /> },
  { id: 'settings', label: '设置', icon: <Settings className="h-5 w-5" /> },
];

export function AppShell({ activeTab, onTabChange, children }: AppShellProps) {
  const status = useTimerStore((s) => s.status);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex-none drag h-10" />

      <main className="flex-1 overflow-auto p-4">{children}</main>

      <footer className="flex-none border-t border-gray-200 dark:border-gray-700 px-4 py-1 flex items-center justify-between text-xs text-gray-500">
        <span>
          {status === 'working' ? '工作中' : status === 'breaking' ? '休息中' : status === 'paused' ? '已暂停' : '就绪'}
        </span>
      </footer>

      <nav className="flex-none border-t border-gray-200 dark:border-gray-700 flex">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors ${
              activeTab === tab.id
                ? 'text-tomato'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
