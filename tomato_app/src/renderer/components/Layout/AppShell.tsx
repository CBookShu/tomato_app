import React from 'react';
import { Sidebar, TabId } from './Sidebar.js';
import { StatusBar } from './StatusBar.js';

interface AppShellProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  children: React.ReactNode;
  showTaskTree?: boolean;
  taskDetail?: React.ReactNode;
  onNavigateToTasks?: () => void;
}

export function AppShell({
  activeTab,
  onTabChange,
  children,
  showTaskTree = false,
  taskDetail,
  onNavigateToTasks,
}: AppShellProps) {
  return (
    <div className="flex h-screen flex-col bg-white dark:bg-gray-900">
      {/* 标题栏拖拽区域 */}
      <header className="h-10 drag bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700" />

      {/* 主体区域 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧导航 */}
        <Sidebar activeTab={activeTab} onTabChange={onTabChange} />

        {/* 内容区域 */}
        <div className="flex-1 flex overflow-hidden">
          {children}
        </div>
      </div>

      {/* 底部状态栏 */}
      <StatusBar onNavigateToTasks={onNavigateToTasks} />
    </div>
  );
}
