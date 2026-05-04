import { useState } from 'react';
import { Input } from '@/components/ui/input.js';
import { Button } from '@/components/ui/button.js';

interface TaskFormProps {
  onSubmit: (title: string) => void;
  onCancel: () => void;
}

export function TaskForm({ onSubmit, onCancel }: TaskFormProps) {
  const [title, setTitle] = useState('');

  const handleSubmit = () => {
    if (title.trim()) {
      onSubmit(title.trim());
      setTitle('');
    }
  };

  return (
    <div className="flex items-center gap-2 px-2 py-1">
      <Input
        autoFocus
        placeholder="输入任务标题..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
          if (e.key === 'Escape') onCancel();
        }}
        className="h-8 text-sm"
      />
      <Button size="sm" onClick={handleSubmit}>
        添加
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel}>
        取消
      </Button>
    </div>
  );
}
