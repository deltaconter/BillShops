import { AUTH_CONFIG } from '../config/authConfig';

export interface SupabaseErrorLike {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
  status?: number;
}

export class RpcAccessError extends Error {
  constructor(message: string = AUTH_CONFIG.MESSAGES.INVALID_CREDENTIALS) {
    super(message);
    this.name = 'RpcAccessError';
  }
}

const RPC_ACCESS_CODES = new Set([
  '42501', // PostgreSQL insufficient_privilege
  '28000', // invalid_authorization_specification
  '28P01', // invalid_password
  'PGRST301', // PostgREST JWT invalid
  'PGRST302', // PostgREST JWT missing/expired
  'PGRST303', // PostgREST JWT claim error
]);

const RPC_ACCESS_MESSAGE_REGEX =
  /access|accès|acces|denied|refus|unauthori|autoris|forbidden|interdit|permission|privilege|inactif|inactive|not active|pas actif|désactiv|desactiv|disabled|bloqué|bloque|blocked|suspend|revok|révoqu|revoqu|droits? insuffisant|jwt|authentif|rôle invalide|role invalide|(?:profil|profile|visiteur|visitor|compte|account).*(?:introuvable|not found|inactif|inactive|désactiv|desactiv|disabled|bloqu|blocked)/i;

export function isRpcAccessError(
  error: SupabaseErrorLike | null | undefined,
  httpStatus?: number
): boolean {
  if (!error && httpStatus !== 401 && httpStatus !== 403) {
    return false;
  }

  const effectiveStatus = httpStatus ?? error?.status;
  if (effectiveStatus === 401 || effectiveStatus === 403) {
    return true;
  }

  const code = (error?.code || '').trim().toUpperCase();
  if (RPC_ACCESS_CODES.has(code)) {
    return true;
  }

  const combinedText = [error?.message, error?.details, error?.hint]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' ');

  if (!combinedText) {
    return false;
  }

  if (/failed to fetch|networkerror|load failed/i.test(combinedText) && !code) {
    return false;
  }

  return RPC_ACCESS_MESSAGE_REGEX.test(combinedText);
}

type AccessDeniedListener = () => void;
const accessDeniedListeners = new Set<AccessDeniedListener>();

export function registerRpcAccessDeniedHandler(listener: AccessDeniedListener): () => void {
  accessDeniedListeners.add(listener);
  return () => {
    accessDeniedListeners.delete(listener);
  };
}

export function notifyRpcAccessDenied(): void {
  accessDeniedListeners.forEach((listener) => {
    listener();
  });
}
