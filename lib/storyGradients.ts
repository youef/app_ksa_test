import type { StoryGradient } from './storyTypes';

export const BG_GRADIENTS: StoryGradient[] = [
  { id: 1, colors: ['#065f46', '#059669'], name: 'أخضر ملكي' },
  { id: 2, colors: ['#7c3aed', '#4f46e5'], name: 'بنفسجي' },
  { id: 3, colors: ['#dc2626', '#ea580c'], name: 'غروب' },
  { id: 4, colors: ['#059669', '#10b981'], name: 'طبيعة' },
  { id: 5, colors: ['#d97706', '#dc2626'], name: 'ذهبي' },
  { id: 6, colors: ['#1e293b', '#334155'], name: 'ليلي' },
  { id: 7, colors: ['#be185d', '#7c3aed'], name: 'وردي' },
  { id: 8, colors: ['#064e3b', '#047857'], name: 'أخضر داكن' },
];

export const DEFAULT_GRADIENT = BG_GRADIENTS[0];

export function getGradient(id: number): StoryGradient {
  return BG_GRADIENTS.find((g) => g.id === id) ?? DEFAULT_GRADIENT;
}

export function nextGradientId(currentCount: number): number {
  return (currentCount % BG_GRADIENTS.length) + 1;
}
