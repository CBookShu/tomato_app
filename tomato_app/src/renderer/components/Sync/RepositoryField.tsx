import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';

interface RepositoryFieldProps {
  remoteUrl: string;
  remoteBranch: string;
  onRemoteUrlChange: (value: string) => void;
  onRemoteBranchChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export function RepositoryField({
  remoteUrl,
  remoteBranch,
  onRemoteUrlChange,
  onRemoteBranchChange,
  onSubmit,
  disabled,
}: RepositoryFieldProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="remote-url" className="text-sm text-gray-700 dark:text-gray-200">
          远程地址
        </Label>
        <Input
          id="remote-url"
          value={remoteUrl}
          onChange={(event) => onRemoteUrlChange(event.target.value)}
          placeholder="https://github.com/<owner>/<repo>.git"
          disabled={disabled}
          autoCapitalize="off"
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="remote-branch" className="text-sm text-gray-700 dark:text-gray-200">
          目标分支
        </Label>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <Input
            id="remote-branch"
            value={remoteBranch}
            onChange={(event) => onRemoteBranchChange(event.target.value)}
            placeholder="main"
            disabled={disabled}
            autoCapitalize="off"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0"
          />
          <Button type="submit" disabled={disabled}>
            绑定远程
          </Button>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
        请输入一个本机可以访问的 Git 远程地址和要同步的分支。绑定后，应用会先以本地数据为准，再与远程进行同步。
      </p>
    </form>
  );
}
