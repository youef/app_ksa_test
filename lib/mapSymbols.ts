// Outline SVG symbols matching the Lucide icon language. No font/emoji rendering.
const paths: Record<string,string> = {
  business: '<path d="M3 9 5 3h14l2 6M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M5 12v9h14v-9M9 21v-7h6v7"/>',
  question: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
  tool: '<path d="M14.7 6.3a5.5 5.5 0 0 0-7 7L2 19l3 3 5.7-5.7a5.5 5.5 0 0 0 7-7l-4 4-3-3z"/>',
  emergency: '<path d="m10.3 3.9-8.5 14.2A2 2 0 0 0 3.5 21h17a2 2 0 0 0 1.7-2.9L13.7 3.9a2 2 0 0 0-3.4 0M12 9v4M12 17h.01"/>',
  request: '<path d="M20 12v8H4v-8M2 8h20v4H2zM12 8v12M12 8H7.5A2.5 2.5 0 1 1 10 5.5L12 8Zm0 0h4.5A2.5 2.5 0 1 0 14 5.5L12 8Z"/>',
  carpool: '<path d="m5 8 2-5h10l2 5M5 8h14l2 4v7H3v-7zM5 19v2M19 19v2M7 13h.01M17 13h.01"/>',
  event: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
  marketplace: '<path d="M5 7h14l2 14H3zM9 7V5a3 3 0 0 1 6 0v2"/>',
  location: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
};
export function mapSymbolSvg(kind: string, color = '#0f766e') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[kind === 'alert' ? 'emergency' : kind] || paths.business}</svg>`;
}
