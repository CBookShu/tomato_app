import { useEffect, useState } from 'react';
import { AppShell } from '@/components/Layout/AppShell.js';
import { TimerDisplay } from '@/components/Timer/TimerDisplay.js';
import { TimerControls } from '@/components/Timer/TimerControls.js';
import { TaskGroupList } from '@/components/TaskList/TaskGroupList.js';
import { DailyStatsCard } from '@/components/Stats/DailyStatsCard.js';
import { WeeklyTrend } from '@/components/Stats/WeeklyTrend.js';
import { SettingsPage } from '@/components/Settings/SettingsPage.js';
import { useIpc } from '@/hooks/useIpc.js';
import { IPC } from '@shared/ipc-channels.js';
import { useTaskStore } from '@/stores/task-store.js';
import { useStatsStore } from '@/stores/stats-store.js';
import { useSettingsStore } from '@/stores/settings-store.js';
import { getToday } from '@pomodoro/core/dist/utils/date-utils.js';

export default function App() {
  const [activeTab, setActiveTab] = useState<'timer' | 'tasks' | 'stats' | 'settings'>('timer');

  const { invoke } = useIpc();
  const taskStore = useTaskStore();
  const statsStore = useStatsStore();
  const settingsStore = useSettingsStore();

  useEffect(() => {
    async function loadData() {
      taskStore.setLoading(true);
      try {
        const [tasks = [], groups = []] = await Promise.all([
          invoke(IPC.TASK_GET_ALL),
          invoke(IPC.GROUP_GET_ALL),
        ]);
        taskStore.setTasks(tasks);
        taskStore.setGroups(groups);
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
        <div className="flex flex-col gap-4 max-w-md mx-auto w-full pt-8">
          <DailyStatsCard />
          <WeeklyTrend />
        </div>
      )}
      {activeTab === 'settings' && (
        <SettingsPage />
      )}
    </AppShell>
  );
}
