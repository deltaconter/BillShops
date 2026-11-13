import { useState, useEffect } from 'react';
import { SupabaseErrorLike } from './rpcAccessError';

export class SupabaseUnavailableError extends Error {
  constructor(
    message = 'Serveur Supabase injoignable. Vérifiez votre connexion — aucune opération n’est enregistrée sans confirmation du serveur.'
  ) {
    super(message);
    this.name = 'SupabaseUnavailableError';
  }
}

interface SupabaseConnectivityState {
  isUnreachable: boolean;
  message: string | null;
}

let state: SupabaseConnectivityState = {
  isUnreachable: false,
  message: null,
};

const listeners = new Set<(next: SupabaseConnectivityState) => void>();

function emit(): void {
  listeners.forEach((listener) => listener(state));
}

export function notifySupabaseUnreachable(unreachable: boolean, customMessage?: string): void {
  const nextMessage = unreachable
    ? customMessage ||
      'Serveur Supabase injoignable. Vérifiez votre connexion — aucune donnée n’est enregistrée sans confirmation du serveur.'
    : null;

  if (state.isUnreachable === unreachable && state.message === nextMessage) {
    return;
  }

  state = {
    isUnreachable: unreachable,
    message: nextMessage,
  };
  emit();
}

export function getSupabaseConnectivityState(): SupabaseConnectivityState {
  return state;
}

export function useSupabaseStatus(): SupabaseConnectivityState {
  const [status, setStatus] = useState<SupabaseConnectivityState>(state);

  useEffect(() => {
    setStatus(state);
    listeners.add(setStatus);
    return () => {
      listeners.delete(setStatus);
    };
  }, []);

  return status;
}

export function isNetworkOrServerUnreachableError(
  error: (SupabaseErrorLike & { name?: string }) | unknown,
  httpStatus?: number
): boolean {
  if (typeof httpStatus === 'number' && (httpStatus === 0 || httpStatus >= 500)) {
    return true;
  }

  if (!error) return false;

  if (error instanceof SupabaseUnavailableError) {
    return true;
  }

  const errObj = error as SupabaseErrorLike & { name?: string };
  if (typeof errObj.status === 'number' && (errObj.status === 0 || errObj.status >= 500)) {
    return true;
  }

  const code = (errObj.code || '').trim();
  const message = [errObj.message, errObj.details]
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .join(' ');

  if (
    !code &&
    /failed to fetch|networkerror|load failed|fetch failed|network request failed|econnrefused|timeout|timed out|enotfound|offline/i.test(
      message
    )
  ) {
    return true;
  }

  return false;
}
