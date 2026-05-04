import { useTimerStore } from '@/stores/timer-store.js';

export function TimerDisplay() {
  const status = useTimerStore((s) => s.status);
  const formattedTime = useTimerStore((s) => s.formattedTime());

  const statusLabels: Record<string, string> = {
    idle: '准备开始',
    working: '专注中',
    paused: '已暂停',
    breaking: '短休息',
    'long-break': '长休息',
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-sm font-medium text-gray-500">{statusLabels[status]}</div>
      <div className="font-mono text-8xl font-bold tabular-nums text-tomato">
        {formattedTime}
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-400">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className={`h-2 w-2 rounded-full ${
              i < useTimerStore.getState().currentCycle ? 'bg-tomato' : 'bg-gray-200 dark:bg-gray-700'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
