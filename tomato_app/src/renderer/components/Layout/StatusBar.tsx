import { useTimerStore } from '@/stores/timer-store.js';
import { useStatsStore } from '@/stores/stats-store.js';
import { useTaskStore } from '@/stores/task-store.js';
import { useMemo } from 'react';

type TimerStatus = 'idle' | 'working' | 'paused' | 'breaking' | 'long-break';

interface StatusConfig {
  color: string;
  label: string;
}

const STATUS_CONFIG: Record<TimerStatus, StatusConfig> = {
  idle: { color: 'bg-gray-400', label: '就绪' },
  working: { color: 'bg-red-500', label: '专注中' },
  paused: { color: 'bg-orange-400', label: '已暂停' },
  breaking: { color: 'bg-green-500', label: '休息中' },
  'long-break': { color: 'bg-green-500', label: '长休息' },
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

interface StatusBarProps {
  onNavigateToTasks?: () => void;
}

export function StatusBar({ onNavigateToTasks }: StatusBarProps) {
  const status = useTimerStore((s) => s.status);
  const remainingTime = useTimerStore((s) => s.remainingTime);
  const currentTaskId = useTimerStore((s) => s.currentTaskId);
  const todayStats = useStatsStore((s) => s.today);
  const selectTask = useTaskStore((s) => s.selectTask);
  const tasks = useTaskStore((s) => s.tasks);
  const currentTask = tasks.find(t => t.id === currentTaskId);

  const config = STATUS_CONFIG[status] || STATUS_CONFIG.idle;
  const showTime = status !== 'idle' && remainingTime > 0;

  // Use useMemo to format time safely
  const formattedTime = useMemo(() => formatTime(remainingTime), [remainingTime]);

  const handleTaskClick = () => {
    if (currentTask) {
      selectTask(currentTask.id);
      onNavigateToTasks?.();
    }
  };

  return (
    <div className="h-8 px-4 bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs">
      <span className="text-gray-500 dark:text-gray-400">Tomato v0.1.0</span>

      <div className="flex items-center gap-4">
        <span className="text-gray-500 dark:text-gray-400">
          <span aria-hidden="true">📊</span> 今日 {todayStats?.totalPomodoros ?? 0} 个番茄
        </span>

        <div
          className="flex items-center gap-2 bg-white dark:bg-gray-700 px-3 py-1 rounded-full"
          role="status"
          aria-label={`计时器状态: ${config.label}`}
        >
          <span className={`w-2 h-2 rounded-full ${config.color}`} />
          {showTime && (
            <span className="font-mono font-medium text-gray-700 dark:text-gray-200">
              {formattedTime}
            </span>
          )}
          <span className="text-gray-500 dark:text-gray-400">{config.label}</span>
          {currentTask && (
            <>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <button
                onClick={handleTaskClick}
                className="text-gray-500 dark:text-gray-400 hover:text-tomato transition-colors"
              >
                当前：{currentTask.title.length > 10 ? currentTask.title.slice(0, 10) + '...' : currentTask.title}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
