import * as React from 'react';
import { cn } from '@/lib/utils.js';
import { Check } from 'lucide-react';

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onCheckedChange?: (checked: boolean) => void;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, onCheckedChange, onChange, ...props }, ref) => (
    <label className={cn('relative flex items-center', className)}>
      <input
        ref={ref}
        type="checkbox"
        className="peer sr-only"
        onChange={(e) => {
          onChange?.(e);
          onCheckedChange?.(e.target.checked);
        }}
        {...props}
      />
      <div className="h-4 w-4 rounded border border-gray-300 dark:border-gray-600 flex items-center justify-center peer-checked:bg-tomato peer-checked:border-tomato transition-colors">
        <Check className="h-3 w-3 text-white opacity-0 peer-checked:opacity-100" />
      </div>
    </label>
  ),
);
Checkbox.displayName = 'Checkbox';
