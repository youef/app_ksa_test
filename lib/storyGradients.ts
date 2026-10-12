import type { StoryGradient } from './storyTypes';

export const BG_GRADIENTS: StoryGradient[] = [
  { id: 1, colors: ['#065f46', '#059669'], name: 'أخضر ملكي' },
  { id: 2, colors: ['#0f172a', '#1e293b'], name: 'ليل نجد' },
  { id: 3, colors: ['#0284c7', '#0369a1'], name: 'أزرق الخليج' },
  { id: 4, colors: ['#7c3aed', '#6366f1'], name: 'خزامى نجد' },
  { id: 5, colors: ['#ea580c', '#c2410c'], name: 'غروب العلا' },
  { id: 6, colors: ['#d97706', '#b45309'], name: 'ذهب الصحراء' },
  { id: 7, colors: ['#db2777', '#be185d'], name: 'ورد الطائف' },
  { id: 8, colors: ['#0891b2', '#0e7490'], name: 'سماء الرياض' },
  { id: 9, colors: ['#047857', '#10b981'], name: 'زمرد اليمامة' },
  { id: 10, colors: ['#334155', '#475569'], name: 'لؤلؤ شرقي' },
  { id: 11, colors: ['#7f1d1d', '#991b1b'], name: 'كستنائي الدرعية' },
  { id: 12, colors: ['#09090b', '#18181b'], name: 'أسود فخم' },
];

export const DEFAULT_GRADIENT = BG_GRADIENTS[0];

export function getGradient(id: number): StoryGradient {
  return BG_GRADIENTS.find((g) => g.id === id) ?? DEFAULT_GRADIENT;
}

export function nextGradientId(currentCount: number): number {
  return (currentCount % BG_GRADIENTS.length) + 1;
}
