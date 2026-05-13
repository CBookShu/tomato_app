import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';

interface RepositoryFieldProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export function RepositoryField({ value, onChange, onSubmit, disabled }: RepositoryFieldProps) {
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Label htmlFor="github-repository-url">GitHub 仓库地址</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="github-repository-url"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="https://github.com/owner/repo"
          disabled={disabled}
          autoCapitalize="off"
          autoComplete="off"
          spellCheck={false}
          className="flex-1"
        />
        <Button type="submit" disabled={disabled}>
          验证并连接
        </Button>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        支持直接粘贴完整的 `https://github.com/owner/repo` 地址，空仓库也可以直接绑定。
      </p>
    </form>
  );
}
