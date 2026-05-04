import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card.js';
import { Label } from '@/components/ui/label.js';
import { Input } from '@/components/ui/input.js';
import { Checkbox } from '@/components/ui/checkbox.js';

export function SettingsPage() {
  const [pomodoroDuration, setPomodoroDuration] = useState('25');
  const [shortBreak, setShortBreak] = useState('5');
  const [longBreak, setLongBreak] = useState('15');
  const [longBreakInterval, setLongBreakInterval] = useState('4');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [autoStart, setAutoStart] = useState(false);

  return (
    <div className="flex flex-col gap-4 max-w-md mx-auto w-full pt-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">计时设置</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Label>番茄时长 (分钟)</Label>
            <Input
              type="number"
              min={1}
              max={120}
              value={pomodoroDuration}
              onChange={(e) => setPomodoroDuration(e.target.value)}
              className="w-20"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>短休息 (分钟)</Label>
            <Input
              type="number"
              min={1}
              max={30}
              value={shortBreak}
              onChange={(e) => setShortBreak(e.target.value)}
              className="w-20"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>长休息 (分钟)</Label>
            <Input
              type="number"
              min={1}
              max={60}
              value={longBreak}
              onChange={(e) => setLongBreak(e.target.value)}
              className="w-20"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>长休息间隔 (番茄数)</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={longBreakInterval}
              onChange={(e) => setLongBreakInterval(e.target.value)}
              className="w-20"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">通知设置</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Label>声音提醒</Label>
            <Checkbox checked={soundEnabled} onCheckedChange={setSoundEnabled} />
          </div>
          <div className="flex items-center justify-between">
            <Label>系统通知</Label>
            <Checkbox checked={notificationEnabled} onCheckedChange={setNotificationEnabled} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">外观</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label>暗色模式</Label>
            <Checkbox checked={darkMode} onCheckedChange={setDarkMode} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">高级</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label>开机自启动</Label>
            <Checkbox checked={autoStart} onCheckedChange={setAutoStart} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
