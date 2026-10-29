export const ADMIN_PERMISSION_KEYS = ['users','reports','content','market','events','broadcast','alerts','support','analytics','roles','config','verifications','search','logs','security'] as const;
export type AdminPermission = typeof ADMIN_PERMISSION_KEYS[number];
export type AdminPermissions = Record<AdminPermission, boolean>;
export function parseAdminPermissions(value: unknown): AdminPermissions {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return Object.fromEntries(ADMIN_PERMISSION_KEYS.map(key => [key, row[key] === true])) as AdminPermissions;
}
export const ADMIN_TAB_PERMISSION: Record<string, AdminPermission | AdminPermission[]> = {
  overview: 'analytics', tasks: ['reports','verifications','alerts'], search: 'search', users: 'users',
  verifications: 'verifications', support: 'support', reports: 'reports', content: 'content', platform: 'market',
  broadcast: 'broadcast', locations: 'config', branding: 'config', backgrounds: 'config', analytics: 'analytics',
  weekly: 'analytics', badges: 'users', config: 'config', roles: 'roles', security: 'security', logs: 'logs',
};
export function canOpenAdminTab(permissions: AdminPermissions, tab: string): boolean {
  const required = ADMIN_TAB_PERMISSION[tab];
  return Array.isArray(required) ? required.every(key => permissions[key]) : Boolean(required && permissions[required]);
}
