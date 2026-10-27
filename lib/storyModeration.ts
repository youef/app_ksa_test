type StoryText = { content?: unknown; poll_question?: unknown; question_prompt?: unknown; poll_options?: unknown };

export function normalizeStoryText(value: string): string {
  return value.toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي');
}

/** Matches complete prohibited words/phrases, including punctuation or hidden-letter obfuscation. */
export function findProhibitedStoryWord(story: StoryText, words: string[]): string | null {
  const fields = [story.content, story.poll_question, story.question_prompt,
    ...(Array.isArray(story.poll_options) ? story.poll_options : [])];
  const text = normalizeStoryText(fields.filter((v): v is string => typeof v === 'string').join(' '));
  for (const word of words) {
    const letters = Array.from(normalizeStoryText(word).replace(/[^\p{L}\p{N}]/gu, ''));
    if (letters.length < 2) continue;
    const pattern = `(^|[^\\p{L}\\p{N}])${letters.join('[^\\p{L}\\p{N}]*')}([^\\p{L}\\p{N}]|$)`;
    if (new RegExp(pattern, 'u').test(text)) return word;
  }
  return null;
}
