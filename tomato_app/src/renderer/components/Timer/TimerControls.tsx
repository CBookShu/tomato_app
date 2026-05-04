import { Button } from '@/components/ui/button.js';
import { Play, Pause, RotateCcw, SkipForward } from 'lucide-react';
import { useTimer } from '@/hooks/useTimer.js';

export function TimerControls() {
  const { status, start, pause, resume, stop, skip } = useTimer();

  return (
    <div className="flex items-center gap-3">
      {status === 'idle' && (
        <Button size="lg" onClick={() => start()}>
          <Play className="h-5 w-5" />
          开始专注
        </Button>
      )}
      {status === 'working' && (
        <>
          <Button size="lg" variant="secondary" onClick={pause}>
            <Pause className="h-5 w-5" />
            暂停
          </Button>
          <Button size="icon" variant="ghost" onClick={skip}>
            <SkipForward className="h-5 w-5" />
          </Button>
          <Button size="icon" variant="ghost" onClick={stop}>
            <RotateCcw className="h-5 w-5" />
          </Button>
        </>
      )}
      {status === 'paused' && (
        <>
          <Button size="lg" onClick={resume}>
            <Play className="h-5 w-5" />
            继续
          </Button>
          <Button size="icon" variant="ghost" onClick={stop}>
            <RotateCcw className="h-5 w-5" />
          </Button>
        </>
      )}
      {(status === 'breaking' || status === 'long-break') && (
        <Button size="lg" variant="secondary" onClick={skip}>
          <SkipForward className="h-5 w-5" />
          跳过休息
        </Button>
      )}
    </div>
  );
}
