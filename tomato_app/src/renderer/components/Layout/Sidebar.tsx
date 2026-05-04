import React from 'react';
import { Timer, ListTodo, BarChart3, Settings } from 'lucide-react';
import { cn } from '@/lib/utils.js';

export type TabId = 'timer' | 'tasks' | 'stats' | 'settings';

interface SidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const tabs: { id: TabId; icon: React.ReactNode; label: string }[] = [
  { id: 'timer', icon: <Timer className="h-5 w-5" />, label: '计时' },
  { id: 'tasks', icon: <ListTodo className="h-5 w-5" />, label: '任务' },
  { id: 'stats', icon: <BarChart3 className="h-5 w-5" />, label: '统计' },
  { id: 'settings', icon: <Settings className="h-5 w-5" />, label: '设置' },
];

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <div className="w-[60px] bg-gray-50 dark:bg-gray-900 flex flex-col items-center py-4 gap-2 border-r border-gray-200 dark:border-gray-700">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
            activeTab === tab.id
              ? 'bg-tomato text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          )}
          title={tab.label}
        >
          {tab.icon}
        </button>
      ))}
    </div>
  );
}
