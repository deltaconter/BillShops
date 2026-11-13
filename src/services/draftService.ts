/**
 * Gestion stricte des brouillons de formulaires non envoyés.
 * Ces brouillons ne sont JAMAIS utilisés comme source de données confirmée ni affichés comme enregistrés.
 */

export type ModuleDraftKey = 'office' | 'units' | 'fridge' | 'money';

const DRAFT_PREFIX = 'billshops_unsent_draft_v1';

function buildKey(establishmentId: string, reportDate: string, moduleKey: ModuleDraftKey): string {
  return `${DRAFT_PREFIX}:${establishmentId}:${reportDate}:${moduleKey}`;
}

export function getModuleDraft<T>(
  establishmentId: string | undefined,
  reportDate: string,
  moduleKey: ModuleDraftKey
): T | null {
  if (!establishmentId) return null;
  try {
    const raw = localStorage.getItem(buildKey(establishmentId, reportDate, moduleKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { payload: T };
    return parsed?.payload ?? null;
  } catch {
    return null;
  }
}

export function saveModuleDraft<T>(
  establishmentId: string | undefined,
  reportDate: string,
  moduleKey: ModuleDraftKey,
  payload: T
): void {
  if (!establishmentId) return;
  try {
    localStorage.setItem(
      buildKey(establishmentId, reportDate, moduleKey),
      JSON.stringify({
        savedAt: new Date().toISOString(),
        payload,
      })
    );
  } catch {
    // Ignorer les quotas de stockage
  }
}

export function clearModuleDraft(
  establishmentId: string | undefined,
  reportDate: string,
  moduleKey: ModuleDraftKey
): void {
  if (!establishmentId) return;
  try {
    localStorage.removeItem(buildKey(establishmentId, reportDate, moduleKey));
  } catch {
    // Ignorer
  }
}
