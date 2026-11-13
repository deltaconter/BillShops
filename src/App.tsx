import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, WifiOff, X } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ScreenPublic } from './components/ScreenPublic';
import { ScreenAdmin } from './components/ScreenAdmin';
import { ScreenVisitor } from './components/ScreenVisitor';
import { SecretAccessModal } from './components/SecretAccessModal';
import { useSupabaseStatus } from './utils/supabaseStatus';

function AppContent() {
  const { isAuthenticated, isAdmin, isVisitor, isLoading, accessError, clearAccessError, logout } =
    useAuth();
  const { isUnreachable, message: connectivityMessage } = useSupabaseStatus();

  // Détermination de la vue courante (toujours 'public' par défaut)
  const [currentView, setCurrentView] = useState<'public' | 'admin' | 'visitor'>('public');
  const [isSecretModalOpen, setIsSecretModalOpen] = useState(false);

  // Redirection silencieuse sans message ni indice
  const handleSilentRedirect = useCallback(() => {
    if (window.location.hash.includes('admin') || window.location.hash.includes('visiteur')) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    setCurrentView('public');
  }, []);

  // Synchronisation avec l'URL (si l'utilisateur tape /admin ou /visiteur ou hash à la main)
  useEffect(() => {
    const handleUrlChange = () => {
      if (isLoading) return;

      const hash = window.location.hash.toLowerCase();
      const path = window.location.pathname.toLowerCase();

      const wantsAdmin = hash.includes('admin') || path.endsWith('/admin');
      const wantsVisitor = hash.includes('visiteur') || path.endsWith('/visiteur');

      if (wantsAdmin) {
        if (isAdmin) {
          setCurrentView('admin');
        } else {
          // Non autorisé : redirection silencieuse immédiate
          handleSilentRedirect();
        }
      } else if (wantsVisitor) {
        if (isVisitor) {
          setCurrentView('visitor');
        } else {
          // Non autorisé : redirection silencieuse immédiate
          handleSilentRedirect();
        }
      }
    };

    handleUrlChange();
    window.addEventListener('hashchange', handleUrlChange);
    window.addEventListener('popstate', handleUrlChange);

    return () => {
      window.removeEventListener('hashchange', handleUrlChange);
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, [isLoading, isAdmin, isVisitor, handleSilentRedirect]);

  // Si la session expire ou l'utilisateur se déconnecte, retour immédiat sur public
  useEffect(() => {
    if (!isLoading && !isAuthenticated && currentView !== 'public') {
      handleSilentRedirect();
    }
  }, [isLoading, isAuthenticated, currentView, handleSilentRedirect]);

  // Déclencheur du geste caché (5 taps sur le logo public)
  const handleSecretAccessTrigger = () => {
    clearAccessError();
    setIsSecretModalOpen(true);
  };

  // Succès de l'authentification dans la modale secrète
  const handleAuthSuccess = (role: 'admin' | 'visitor') => {
    if (role === 'admin') {
      window.history.replaceState(null, '', '#admin');
      setCurrentView('admin');
    } else {
      window.history.replaceState(null, '', '#visiteur');
      setCurrentView('visitor');
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0B14] text-slate-100 flex flex-col items-center justify-start font-sans">
      {/* Conteneur Mobile First (largeur max ~430px, 100% sur mobile) */}
      <div className="w-full max-w-[430px] min-h-screen bg-[#0B0B14] shadow-2xl relative">
        {/* Bannière globale hors-ligne / serveur Supabase injoignable */}
        {isUnreachable && (
          <div
            role="alert"
            data-testid="supabase-unreachable-banner"
            className="sticky top-0 z-50 w-full bg-red-950/95 border-b border-red-500/40 text-red-100 px-3.5 py-2.5 text-[11px] font-semibold flex items-start gap-2 shadow-lg backdrop-blur-md"
          >
            <WifiOff className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>
              {connectivityMessage ||
                'Serveur Supabase injoignable. Aucune opération financière n’est enregistrée sans confirmation du serveur.'}
            </span>
          </div>
        )}

        {/* VUE 1 : Page Publique (par défaut, s'ouvre toujours en premier) */}
        {currentView === 'public' && (
          <ScreenPublic onSecretAccessTrigger={handleSecretAccessTrigger} />
        )}

        {/* VUE 2 : Tableau de bord Admin (protégé par Route Guard) */}
        {currentView === 'admin' && (
          <ProtectedRoute requiredRole="admin" onUnauthorized={handleSilentRedirect}>
            <ScreenAdmin
              onNavigateToVisitor={() => {
                window.history.replaceState(null, '', '#visiteur');
                setCurrentView('visitor');
              }}
            />
          </ProtectedRoute>
        )}

        {/* VUE 3 : Accès Visiteur Spécial (protégé par Route Guard) */}
        {currentView === 'visitor' && (
          <ProtectedRoute requiredRole="visitor" onUnauthorized={handleSilentRedirect}>
            <ScreenVisitor
              onBackToAdmin={() => {
                if (isAdmin) {
                  window.history.replaceState(null, '', '#admin');
                  setCurrentView('admin');
                } else {
                  logout();
                  handleSilentRedirect();
                }
              }}
            />
          </ProtectedRoute>
        )}
      </div>

      {/* Fenêtre Modale d'Accès Réservé (ouverte uniquement via le geste secret des 5 taps) */}
      <SecretAccessModal
        isOpen={isSecretModalOpen}
        onClose={() => setIsSecretModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />

      {/* Message d'erreur générique sur la vitrine après refus d'accès RPC */}
      {accessError && currentView === 'public' && (
        <div
          role="alert"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-[398px] bg-red-950/95 border border-red-500/40 text-red-200 px-3.5 py-2.5 rounded-xl text-xs font-medium shadow-2xl backdrop-blur-md flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{accessError}</span>
          </div>
          <button
            type="button"
            onClick={clearAccessError}
            className="text-red-300 hover:text-white p-0.5 rounded"
            aria-label="Fermer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
