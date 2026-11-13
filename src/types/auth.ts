/**
 * Types d'authentification et de contrôle d'accès (RBAC) pour BillShops
 */

export type UserRole = 'admin' | 'visitor';

export interface UserProfile {
  id: string;
  role: UserRole;
  fullName: string;
  email?: string;
  establishmentId: string;
}

export interface SpecialVisitorAccount {
  id: string;
  username: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface AuthSession {
  role: UserRole;
  userId: string;
  username: string;
  email: string;
  token: string;
  establishmentId: string;
}

export interface AuthState {
  session: AuthSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isVisitor: boolean;
}
