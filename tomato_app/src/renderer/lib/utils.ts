import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function formatMinutes(hours: number): string {
  const h = Math.floor(hours / 60);
  const m = hours % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
