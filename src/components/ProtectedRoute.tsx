import React, { useEffect } from 'react';
import { useAuth, UserRole } from '../context/AuthContext';

interface ProtectedRouteProps {
  requiredRole: UserRole;
  children: React.ReactNode;
  onUnauthorized: () => void;
}

/**
 * Route Guard silencieux
 * Redirige instantanément sans afficher d'indice ni de message d'erreur.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  requiredRole,
  children,
  onUnauthorized,
}) => {
  const { session, isLoading, isAuthenticated, isAdmin } = useAuth();

  const isAuthorized = React.useMemo(() => {
    if (!isAuthenticated || !session) return false;
    // L'administrateur a accès à tout (admin et visiteur)
    if (isAdmin) return true;
    // Le visiteur a accès uniquement à l'interface visiteur
    if (requiredRole === 'visitor' && session.role === 'visitor') return true;
    return false;
  }, [isAuthenticated, session, isAdmin, requiredRole]);

  useEffect(() => {
    if (!isLoading && !isAuthorized) {
      // Redirection silencieuse : pas d'alerte, pas de message d'erreur
      onUnauthorized();
    }
  }, [isLoading, isAuthorized, onUnauthorized]);

  if (isLoading || !isAuthorized) {
    return null;
  }

  return <>{children}</>;
};
