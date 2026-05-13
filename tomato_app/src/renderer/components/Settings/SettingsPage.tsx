import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card.js';
import { Label } from '@/components/ui/label.js';
import { Input } from '@/components/ui/input.js';
import { Checkbox } from '@/components/ui/checkbox.js';
import { Button } from '@/components/ui/button.js';
import { useSettingsStore } from '@/stores/settings-store.js';
import { useIpc } from '@/hooks/useIpc.js';
import { IPC } from '@shared/ipc-channels.js';
import type { ExportData } from '@shared/ipc-channels.js';
import { SyncSettings } from '@/components/Sync/SyncSettings.js';
import { LEGACY_SETTINGS_MAP, getLegacySettingKey, normalizeSettings, readSetting } from '@/lib/settings-keys.js';

export function SettingsPage() {
  const { invoke } = useIpc();
  const { settings, setAll, set, remove } = useSettingsStore();
  const [loaded, setLoaded] = useState(false);

  // 数据导出
  const handleExport = async () => {
    try {
      const data = await invoke(IPC.DATA_EXPORT);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tomato-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('导出失败:', error);
      alert('导出失败，请查看控制台获取详细信息');
    }
  };

  // 数据导入
  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text) as ExportData;

        // 验证数据结构
        if (!data.version || !data.data) {
          alert('无效的备份文件：缺少版本或数据字段');
          return;
        }

        if (!Array.isArray(data.data.tasks) || !Array.isArray(data.data.groups)) {
          alert('无效的备份文件：数据格式错误');
          return;
        }

        // 确认对话框
        const useReplaceMode = confirm(
          '选择导入模式：\n\n确定 = 替换模式（清空现有数据）\n取消 = 合并模式（保留现有数据）',
        );
        const mode = useReplaceMode ? 'replace' : 'merge';

        const result = await invoke(IPC.DATA_IMPORT, { data, mode });
        if (result.success) {
          alert('导入成功！应用将重新加载以应用新数据。');
          // 刷新页面以重新加载数据
          setTimeout(() => {
            window.location.reload();
          }, 500);
        } else {
          alert(`导入失败：${result.message}`);
        }
      } catch (error) {
        console.error('导入失败:', error);
        alert('导入失败，请确保文件格式正确');
      }
    };
    input.click();
  };

  // Apply dark mode on mount and when settings change
  useEffect(() => {
    const isDark = readSetting(settings, 'darkMode', 'false') === 'true';
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings]);

  useEffect(() => {
    async function load() {
      const all = await invoke(IPC.SETTINGS_GET_ALL);
      if (all) setAll(normalizeSettings(all));
      setLoaded(true);
    }
    load();
  }, [invoke, setAll]);

  if (!loaded) return <div className="text-center text-gray-400 py-8">加载中...</div>;

  const updateKey = async (key: keyof typeof LEGACY_SETTINGS_MAP, value: string) => {
    const legacyKey = getLegacySettingKey(key);
    set(key, value);
    remove(legacyKey);
    await invoke(IPC.SETTINGS_SET, { key, value });
    await invoke(IPC.SETTINGS_DELETE, { key: legacyKey });
  };

  const updateNumericKey = async (
    key: 'pomodoroDuration' | 'shortBreakDuration' | 'longBreakDuration' | 'longBreakInterval',
    value: string,
  ) => {
    if (value.trim() === '') return;
    await updateKey(key, value);
  };

  return (
    <div className="flex flex-col gap-4 max-w-md mx-auto w-full py-4 px-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">计时设置</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Label>番茄时长 (分钟)</Label>
            <Input
              type="number" min={1} max={120}
              value={readSetting(settings, 'pomodoroDuration', '25')}
              onChange={(e) => updateNumericKey('pomodoroDuration', e.target.value)}
              className="w-20"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>短休息 (分钟)</Label>
            <Input
              type="number" min={1} max={30}
              value={readSetting(settings, 'shortBreakDuration', '5')}
              onChange={(e) => updateNumericKey('shortBreakDuration', e.target.value)}
              className="w-20"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>长休息 (分钟)</Label>
            <Input
              type="number" min={1} max={60}
              value={readSetting(settings, 'longBreakDuration', '15')}
              onChange={(e) => updateNumericKey('longBreakDuration', e.target.value)}
              className="w-20"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>长休息间隔 (番茄数)</Label>
            <Input
              type="number" min={1} max={10}
              value={readSetting(settings, 'longBreakInterval', '4')}
              onChange={(e) => updateNumericKey('longBreakInterval', e.target.value)}
              className="w-20"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-blue-200/70 dark:border-blue-900/50">
        <CardHeader>
          <CardTitle className="text-sm font-medium">数据同步</CardTitle>
        </CardHeader>
        <CardContent>
          <SyncSettings />
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
              checked={readSetting(settings, 'soundEnabled', 'true') === 'true'}
              onCheckedChange={(v) => updateKey('soundEnabled', v ? 'true' : 'false')}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>系统通知</Label>
            <Checkbox
              checked={readSetting(settings, 'notificationEnabled', 'true') === 'true'}
              onCheckedChange={(v) => updateKey('notificationEnabled', v ? 'true' : 'false')}
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
              checked={readSetting(settings, 'darkMode', 'false') === 'true'}
              onCheckedChange={(v) => updateKey('darkMode', v ? 'true' : 'false')}
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
              checked={readSetting(settings, 'autoStart', 'false') === 'true'}
              onCheckedChange={(v) => updateKey('autoStart', v ? 'true' : 'false')}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">数据管理</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex gap-3">
            <Button onClick={handleExport} variant="outline" className="flex-1">
              导出数据
            </Button>
            <Button onClick={handleImport} variant="outline" className="flex-1">
              导入数据
            </Button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            导出为 JSON 格式，可用于备份或迁移数据。导入时选择"替换"将清空现有数据，"合并"将保留现有数据。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
