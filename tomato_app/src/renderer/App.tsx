import { useState } from 'react';
import { AppShell } from '@/components/Layout/AppShell.js';
import { TimerDisplay } from '@/components/Timer/TimerDisplay.js';
import { TimerControls } from '@/components/Timer/TimerControls.js';
import { TaskGroupList } from '@/components/TaskList/TaskGroupList.js';

export default function App() {
  const [activeTab, setActiveTab] = useState<'timer' | 'tasks' | 'stats' | 'settings'>('timer');

  return (
    <AppShell activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'timer' && (
        <div className="flex flex-col items-center justify-center h-full gap-8">
          <TimerDisplay />
          <TimerControls />
        </div>
      )}
      {activeTab === 'tasks' && <TaskGroupList />}
      {activeTab === 'stats' && (
        <div className="flex items-center justify-center h-full text-gray-400">
          Stats coming in Task 8
        </div>
      )}
      {activeTab === 'settings' && (
        <div className="flex items-center justify-center h-full text-gray-400">
          Settings coming in Task 9
        </div>
      )}
    </AppShell>
  );
}
