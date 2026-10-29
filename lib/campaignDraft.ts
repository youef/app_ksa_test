export type CampaignDraft = { version: 1; title: string; description: string; serviceId: string; packageSlug: string; updatedAt: number };
export function readCampaignDraft(raw: string | null, services: string[], packages: string[]): CampaignDraft | null {
  if (!raw || raw.length > 6000) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || value.version !== 1 || typeof value.title !== 'string' || value.title.length > 100 || typeof value.description !== 'string' || value.description.length > 1000 || !Number.isFinite(value.updatedAt)) return null;
    return { version: 1, title: value.title, description: value.description, serviceId: services.includes(value.serviceId) ? value.serviceId : '', packageSlug: packages.includes(value.packageSlug) ? value.packageSlug : '', updatedAt: value.updatedAt };
  } catch { return null; }
}
