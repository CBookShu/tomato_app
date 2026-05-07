import { useEffect, useState } from 'react';
import { AppShell } from '@/components/Layout/AppShell.js';
import type { TabId } from '@/components/Layout/Sidebar.js';
import { TimerDisplay } from '@/components/Timer/TimerDisplay.js';
import { TimerControls } from '@/components/Timer/TimerControls.js';
import { TaskTree } from '@/components/TaskList/TaskTree.js';
import { TaskDetail } from '@/components/TaskList/TaskDetail.js';
import { DailyStatsCard } from '@/components/Stats/DailyStatsCard.js';
import { WeeklyTrend } from '@/components/Stats/WeeklyTrend.js';
import { SettingsPage } from '@/components/Settings/SettingsPage.js';
import { useIpc } from '@/hooks/useIpc.js';
import { useSound } from '@/hooks/useSound.js';
import { IPC } from '@shared/ipc-channels.js';
import { useTaskStore } from '@/stores/task-store.js';
import { useStatsStore } from '@/stores/stats-store.js';
import { useSettingsStore } from '@/stores/settings-store.js';
import { getToday } from '@pomodoro/core/dist/utils/date-utils.js';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('timer');

  const { invoke } = useIpc();
  const taskStore = useTaskStore();
  const statsStore = useStatsStore();
  const settingsStore = useSettingsStore();

  useSound();

  useEffect(() => {
    async function loadData() {
      taskStore.setLoading(true);
      try {
        const [tasks = [], groups = [], allSettings = {}] = await Promise.all([
          invoke(IPC.TASK_GET_ALL),
          invoke(IPC.GROUP_GET_ALL),
          invoke(IPC.SETTINGS_GET_ALL),
        ]);
        taskStore.setTasks(tasks);
        taskStore.setGroups(groups);
        settingsStore.setAll(allSettings);
      } finally {
        taskStore.setLoading(false);
      }

      statsStore.setLoading(true);
      try {
        const [today, weekly = []] = await Promise.all([
          invoke(IPC.STATS_GET_DAILY, { date: getToday() }),
          invoke(IPC.STATS_GET_WEEKLY, { endDate: getToday() }),
        ]);
        statsStore.setToday(today);
        statsStore.setWeekly(weekly);
      } finally {
        statsStore.setLoading(false);
      }
    }
    loadData();
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'timer':
        return (
          <div className="flex-1 flex flex-col items-center justify-center gap-8">
            <TimerDisplay onNavigateToTasks={() => setActiveTab('tasks')} />
            <TimerControls />
          </div>
        );
      case 'tasks':
        return (
          <>
            <TaskTree />
            <TaskDetail />
          </>
        );
      case 'stats':
        return (
          <div className="flex-1 flex flex-col gap-4 max-w-md mx-auto w-full p-8">
            <DailyStatsCard />
            <WeeklyTrend />
          </div>
        );
      case 'settings':
        return (
          <div className="flex-1 flex justify-center">
            <SettingsPage />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <AppShell activeTab={activeTab} onTabChange={setActiveTab} onNavigateToTasks={() => setActiveTab('tasks')}>
      {renderContent()}
    </AppShell>
  );
}
