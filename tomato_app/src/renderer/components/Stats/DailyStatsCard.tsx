import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card.js';
import { useStatsStore } from '@/stores/stats-store.js';
import { formatMinutes } from '@/lib/utils.js';
import { Timer, CheckCircle2, Clock } from 'lucide-react';

export function DailyStatsCard() {
  const today = useStatsStore((s) => s.today);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">今日统计</CardTitle>
      </CardHeader>
      <CardContent>
        {today ? (
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col items-center gap-1 p-3 rounded-lg bg-red-50 dark:bg-red-950">
              <Timer className="h-5 w-5 text-tomato" />
              <span data-testid="daily-stat-pomodoros" className="text-2xl font-bold tabular-nums">
                {today.totalPomodoros}
              </span>
              <span className="text-xs text-gray-500">番茄数</span>
            </div>
            <div className="flex flex-col items-center gap-1 p-3 rounded-lg bg-green-50 dark:bg-green-950">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span data-testid="daily-stat-completed-tasks" className="text-2xl font-bold tabular-nums">
                {today.completedTasks}
              </span>
              <span className="text-xs text-gray-500">完成任务</span>
            </div>
            <div className="flex flex-col items-center gap-1 p-3 rounded-lg bg-blue-50 dark:bg-blue-950">
              <Clock className="h-5 w-5 text-blue-600" />
              <span className="text-2xl font-bold tabular-nums">
                {formatMinutes(today.totalPomodoros * 25)}
              </span>
              <span className="text-xs text-gray-500">专注时长</span>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-400 py-8">暂无数据，开始你的第一个番茄吧</div>
        )}
      </CardContent>
    </Card>
  );
}
