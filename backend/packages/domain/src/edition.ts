export type AppEditionCode = 'glb' | 'irn';

export function allowedBillingProviders(edition: AppEditionCode): readonly string[] {
  return edition === 'glb' ? ['revenuecat', 'apple', 'google_play'] : ['cafebazaar', 'myket'];
}
