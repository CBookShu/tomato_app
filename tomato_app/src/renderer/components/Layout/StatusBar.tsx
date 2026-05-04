import { useTimerStore } from '@/stores/timer-store.js';
import { useStatsStore } from '@/stores/stats-store.js';

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

export function StatusBar() {
  const { status, remainingTime, formattedTime } = useTimerStore((s) => ({
    status: s.status,
    remainingTime: s.remainingTime,
    formattedTime: s.formattedTime(),
  }));
  const todayStats = useStatsStore((s) => s.today);

  const config = STATUS_CONFIG[status] || STATUS_CONFIG.idle;
  const showTime = status !== 'idle' && remainingTime > 0;

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
        </div>
      </div>
    </div>
  );
}
