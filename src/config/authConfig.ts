/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CONFIGURATION D'AUTHENTIFICATION BILLSHOPS
 */

export const AUTH_CONFIG = {
  // Durées d'inactivité avant déconnexion automatique
  SESSION_TIMEOUTS: {
    ADMIN_MS: 30 * 60 * 1000,   // 30 minutes d'inactivité pour l'Administrateur
    VISITOR_MS: 15 * 60 * 1000, // 15 minutes d'inactivité pour le Visiteur Spécial
  },

  // Domaine interne utilisé pour l'authentification Supabase des visiteurs spéciaux
  VISITOR_EMAIL_DOMAIN: 'billshops.invalid',

  // Messages d'erreur génériques imposés (aucune fuite d'information)
  MESSAGES: {
    INVALID_CREDENTIALS: 'Identifiants incorrects',
    SESSION_EXPIRED: 'Session expirée',
  },
} as const;

export function buildVisitorAuthEmail(identifier: string): string {
  const cleanIdentifier = identifier.trim().toLowerCase();
  return `${cleanIdentifier}@${AUTH_CONFIG.VISITOR_EMAIL_DOMAIN}`;
}
