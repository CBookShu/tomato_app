import { useEffect, useState, type ReactNode } from 'react';
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
import { readSetting, type CanonicalSettingKey } from '@/lib/settings-keys.js';

function SettingRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <Label className="min-w-0 text-sm leading-snug text-gray-700 dark:text-gray-200 sm:whitespace-nowrap">
        {label}
      </Label>
      <div className="justify-self-start sm:justify-self-end">{children}</div>
    </div>
  );
}

export function SettingsPage() {
  const { invoke } = useIpc();
  const { settings, setAll, set } = useSettingsStore();
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
      if (all) setAll(all);
      setLoaded(true);
    }
    load();
  }, [invoke, setAll]);

  if (!loaded) return <div className="text-center text-gray-400 py-8">加载中...</div>;

  const updateKey = async (key: CanonicalSettingKey, value: string) => {
    set(key, value);
    await invoke(IPC.SETTINGS_SET, { key, value });
  };

  const updateNumericKey = async (
    key: 'pomodoroDuration' | 'shortBreakDuration' | 'longBreakDuration' | 'longBreakInterval',
    value: string,
  ) => {
    if (value.trim() === '') return;
    await updateKey(key, value);
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
        <div className="grid gap-4">
          <Card>
            <CardHeader className="px-4 pt-4 pb-3">
              <CardTitle className="text-sm font-medium">计时设置</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 px-4 pb-4 pt-0">
              <SettingRow label="番茄时长 (分钟)">
                <Input
                  type="number" min={1} max={120}
                  value={readSetting(settings, 'pomodoroDuration', '25')}
                  onChange={(e) => updateNumericKey('pomodoroDuration', e.target.value)}
                  className="w-24"
                />
              </SettingRow>
              <SettingRow label="短休息 (分钟)">
                <Input
                  type="number" min={1} max={30}
                  value={readSetting(settings, 'shortBreakDuration', '5')}
                  onChange={(e) => updateNumericKey('shortBreakDuration', e.target.value)}
                  className="w-24"
                />
              </SettingRow>
              <SettingRow label="长休息 (分钟)">
                <Input
                  type="number" min={1} max={60}
                  value={readSetting(settings, 'longBreakDuration', '15')}
                  onChange={(e) => updateNumericKey('longBreakDuration', e.target.value)}
                  className="w-24"
                />
              </SettingRow>
              <SettingRow label="长休息间隔 (番茄数)">
                <Input
                  type="number" min={1} max={10}
                  value={readSetting(settings, 'longBreakInterval', '4')}
                  onChange={(e) => updateNumericKey('longBreakInterval', e.target.value)}
                  className="w-24"
                />
              </SettingRow>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="px-4 pt-4 pb-3">
              <CardTitle className="text-sm font-medium">通知设置</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 px-4 pb-4 pt-0">
              <SettingRow label="声音提醒">
                <Checkbox
                  checked={readSetting(settings, 'soundEnabled', 'true') === 'true'}
                  onCheckedChange={(v) => updateKey('soundEnabled', v ? 'true' : 'false')}
                />
              </SettingRow>
              <SettingRow label="系统通知">
                <Checkbox
                  checked={readSetting(settings, 'notificationEnabled', 'true') === 'true'}
                  onCheckedChange={(v) => updateKey('notificationEnabled', v ? 'true' : 'false')}
                />
              </SettingRow>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="px-4 pt-4 pb-3">
              <CardTitle className="text-sm font-medium">数据管理</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 px-4 pb-4 pt-0">
              <div className="grid grid-cols-2 gap-3">
                <Button onClick={handleExport} variant="outline" className="w-full">
                  导出数据
                </Button>
                <Button onClick={handleImport} variant="outline" className="w-full">
                  导入数据
                </Button>
              </div>
              <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                导出为 JSON 格式，可用于备份或迁移数据。导入时选择"替换"将清空现有数据，"合并"将保留现有数据。
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4">
          <Card className="border-blue-200/70 dark:border-blue-900/50">
            <CardHeader className="px-4 pt-4 pb-3">
              <CardTitle className="text-sm font-medium">数据同步</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <SyncSettings />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="px-4 pt-4 pb-3">
              <CardTitle className="text-sm font-medium">外观</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 px-4 pb-4 pt-0">
              <SettingRow label="暗色模式">
                <Checkbox
                  checked={readSetting(settings, 'darkMode', 'false') === 'true'}
                  onCheckedChange={(v) => updateKey('darkMode', v ? 'true' : 'false')}
                />
              </SettingRow>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="px-4 pt-4 pb-3">
              <CardTitle className="text-sm font-medium">高级</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 px-4 pb-4 pt-0">
              <SettingRow label="开机自启动">
                <Checkbox
                  checked={readSetting(settings, 'autoStart', 'false') === 'true'}
                  onCheckedChange={(v) => updateKey('autoStart', v ? 'true' : 'false')}
                />
              </SettingRow>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
