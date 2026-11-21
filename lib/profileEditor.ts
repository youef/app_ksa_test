export type ProfileDraft = { displayName: string; username: string; bio: string };

export function getProfileBioProgress(bio: string, max = 160) {
  const safeMax = Math.max(1, Math.floor(max));
  const count = [...bio].length;
  const percent = Math.min(100, Math.round((count / safeMax) * 100));
  const remaining = Math.max(0, safeMax - count);
  return { count, percent, remaining, nearLimit: count >= Math.ceil(safeMax * 0.9) };
}
export function validateProfileDraft(draft: ProfileDraft) {
  const errors: Partial<Record<keyof ProfileDraft, string>> = {};
  if (!draft.displayName.trim()) errors.displayName = 'اكتب الاسم الظاهر.';
  else if ([...draft.displayName.trim()].length > 50) errors.displayName = 'الاسم الظاهر لا يتجاوز 50 حرفًا.';
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(draft.username.trim())) errors.username = 'استخدم 3–30 حرفًا إنجليزيًا أو رقمًا أو شرطة سفلية.';
  if ([...draft.bio.trim()].length > 160) errors.bio = 'النبذة لا تتجاوز 160 حرفًا.';
  return errors;
}
