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
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="remote-url">远程地址</Label>
        <Input
          id="remote-url"
          value={remoteUrl}
          onChange={(event) => onRemoteUrlChange(event.target.value)}
          placeholder="https://example.com/team/tomato.git"
          disabled={disabled}
          autoCapitalize="off"
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="remote-branch">目标分支</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="remote-branch"
            value={remoteBranch}
            onChange={(event) => onRemoteBranchChange(event.target.value)}
            placeholder="main"
            disabled={disabled}
            autoCapitalize="off"
            autoComplete="off"
            spellCheck={false}
            className="flex-1"
          />
          <Button type="submit" disabled={disabled}>
            绑定远程
          </Button>
        </div>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        请输入一个本机可以访问的 Git 远程地址和要同步的分支。绑定后，应用会先以本地数据为准，再与远程进行同步。
      </p>
    </form>
  );
}
