import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card.js';
import { useStatsStore } from '@/stores/stats-store.js';

export function WeeklyTrend() {
  const weekly = useStatsStore((s) => s.weekly);
  const maxPomodoros = Math.max(...weekly.map((d) => d.totalPomodoros), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">本周趋势</CardTitle>
      </CardHeader>
      <CardContent>
        {weekly.length > 0 ? (
          <div className="flex items-end gap-2 h-32">
            {weekly.map((day) => (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-mono tabular-nums">{day.totalPomodoros}</span>
                <div
                  className="w-full rounded-t-sm bg-tomato transition-all"
                  style={{ height: `${(day.totalPomodoros / maxPomodoros) * 80}%` }}
                />
                <span className="text-xs text-gray-400">{day.date.slice(5)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-400 py-8">暂无本周数据</div>
        )}
      </CardContent>
    </Card>
  );
}
