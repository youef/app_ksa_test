export type ProfileDraft = { displayName: string; username: string; bio: string };
export function validateProfileDraft(draft: ProfileDraft) {
  const errors: Partial<Record<keyof ProfileDraft, string>> = {};
  if (!draft.displayName.trim()) errors.displayName = 'اكتب الاسم الظاهر.';
  else if ([...draft.displayName.trim()].length > 50) errors.displayName = 'الاسم الظاهر لا يتجاوز 50 حرفًا.';
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(draft.username.trim())) errors.username = 'استخدم 3–30 حرفًا إنجليزيًا أو رقمًا أو شرطة سفلية.';
  if ([...draft.bio.trim()].length > 160) errors.bio = 'النبذة لا تتجاوز 160 حرفًا.';
  return errors;
}
