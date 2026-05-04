import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card.js';
import { Label } from '@/components/ui/label.js';
import { Input } from '@/components/ui/input.js';
import { Checkbox } from '@/components/ui/checkbox.js';
import { useSettingsStore } from '@/stores/settings-store.js';
import { useIpc } from '@/hooks/useIpc.js';
import { IPC } from '@shared/ipc-channels.js';

export function SettingsPage() {
  const { invoke } = useIpc();
  const { settings, setAll, set } = useSettingsStore();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      const all = await invoke(IPC.SETTINGS_GET_ALL);
      if (all) setAll(all);
      setLoaded(true);
    }
    load();
  }, []);

  if (!loaded) return <div className="text-center text-gray-400 py-8">加载中...</div>;

  const getVal = (key: string, def: string) => settings[key] ?? def;
  const updateKey = async (key: string, value: string) => {
    set(key, value);
    await invoke(IPC.SETTINGS_SET, { key, value });
  };

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
              type="number" min={1} max={120}
              value={getVal('pomodoro_duration', '25')}
              onChange={(e) => updateKey('pomodoro_duration', e.target.value)}
              className="w-20"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>短休息 (分钟)</Label>
            <Input
              type="number" min={1} max={30}
              value={getVal('short_break', '5')}
              onChange={(e) => updateKey('short_break', e.target.value)}
              className="w-20"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>长休息 (分钟)</Label>
            <Input
              type="number" min={1} max={60}
              value={getVal('long_break', '15')}
              onChange={(e) => updateKey('long_break', e.target.value)}
              className="w-20"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>长休息间隔 (番茄数)</Label>
            <Input
              type="number" min={1} max={10}
              value={getVal('long_break_interval', '4')}
              onChange={(e) => updateKey('long_break_interval', e.target.value)}
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
            <Checkbox
              checked={getVal('sound_enabled', 'true') === 'true'}
              onCheckedChange={(v) => updateKey('sound_enabled', v ? 'true' : 'false')}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>系统通知</Label>
            <Checkbox
              checked={getVal('notification_enabled', 'true') === 'true'}
              onCheckedChange={(v) => updateKey('notification_enabled', v ? 'true' : 'false')}
            />
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
            <Checkbox
              checked={getVal('dark_mode', 'false') === 'true'}
              onCheckedChange={(v) => updateKey('dark_mode', v ? 'true' : 'false')}
            />
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
            <Checkbox
              checked={getVal('auto_start', 'false') === 'true'}
              onCheckedChange={(v) => updateKey('auto_start', v ? 'true' : 'false')}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
