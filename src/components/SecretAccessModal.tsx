import React, { useState, useEffect } from 'react';
import { X, Lock, Eye, EyeOff, Shield, ShieldAlert, AlertCircle } from 'lucide-react';
import { AUTH_CONFIG } from '../config/authConfig';
import { useAuth } from '../context/AuthContext';

interface SecretAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (role: 'admin' | 'visitor') => void;
}

export const SecretAccessModal: React.FC<SecretAccessModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { loginAdmin, loginVisitor } = useAuth();

  const [activeTab, setActiveTab] = useState<'admin' | 'visitor'>('admin');

  // Champs Administrateur (email + mot de passe)
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  // Champs Visiteur Spécial (identifiant + mot de passe)
  const [visitorIdentifier, setVisitorIdentifier] = useState('');
  const [visitorPassword, setVisitorPassword] = useState('');
  const [showVisitorPassword, setShowVisitorPassword] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Réinitialiser les champs à l'ouverture ou lors du changement d'onglet
  useEffect(() => {
    if (isOpen) {
      setAdminEmail('');
      setAdminPassword('');
      setShowAdminPassword(false);
      setVisitorIdentifier('');
      setVisitorPassword('');
      setShowVisitorPassword(false);
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!adminEmail.trim() || !adminPassword) {
      setErrorMessage(AUTH_CONFIG.MESSAGES.INVALID_CREDENTIALS);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await loginAdmin(adminEmail, adminPassword);
      if (res.success) {
        onSuccess('admin');
        onClose();
      } else {
        setErrorMessage(res.error || AUTH_CONFIG.MESSAGES.INVALID_CREDENTIALS);
        setAdminPassword('');
      }
    } catch {
      setErrorMessage(AUTH_CONFIG.MESSAGES.INVALID_CREDENTIALS);
      setAdminPassword('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVisitorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!visitorIdentifier.trim() || !visitorPassword) {
      setErrorMessage(AUTH_CONFIG.MESSAGES.INVALID_CREDENTIALS);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await loginVisitor(visitorIdentifier, visitorPassword);
      if (res.success) {
        onSuccess('visitor');
        onClose();
      } else {
        setErrorMessage(res.error || AUTH_CONFIG.MESSAGES.INVALID_CREDENTIALS);
        setVisitorPassword('');
      }
    } catch {
      setErrorMessage(AUTH_CONFIG.MESSAGES.INVALID_CREDENTIALS);
      setVisitorPassword('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#121324] border border-white/10 w-full max-w-sm rounded-3xl p-5 shadow-2xl text-white relative overflow-hidden">
        {/* Glow discret */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-purple-600/15 rounded-full blur-2xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 relative z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Accès réservé</h2>
              <p className="text-[10px] text-slate-400">Authentification sécurisée</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message d'erreur générique */}
        {errorMessage && (
          <div
            role="alert"
            className="mt-3 bg-red-950/50 border border-red-500/30 p-2.5 rounded-xl flex items-center gap-2 text-red-300 text-xs animate-shake"
          >
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Tabs Switcher: Administrateur / Visiteur spécial */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#0a0a14] rounded-2xl my-4 border border-white/5">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => {
              setActiveTab('admin');
              setErrorMessage(null);
            }}
            className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
              activeTab === 'admin'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Administrateur</span>
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => {
              setActiveTab('visitor');
              setErrorMessage(null);
            }}
            className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
              activeTab === 'visitor'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Visiteur spécial</span>
          </button>
        </div>

        {/* Tab 1: Formulaire Administrateur (email + mot de passe) */}
        {activeTab === 'admin' && (
          <form onSubmit={handleAdminSubmit} className="space-y-3.5">
            <div>
              <label
                htmlFor="admin-email"
                className="block text-[11px] font-medium text-slate-300 mb-1"
              >
                Adresse e-mail
              </label>
              <input
                id="admin-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                disabled={isSubmitting}
                value={adminEmail}
                onChange={(e) => {
                  setAdminEmail(e.target.value);
                  setErrorMessage(null);
                }}
                placeholder="admin@etablissement.com"
                className="w-full bg-[#0B0B14] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition disabled:opacity-50"
              />
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="block text-[11px] font-medium text-slate-300 mb-1"
              >
                Mot de passe
              </label>
              <div className="relative">
                <input
                  id="admin-password"
                  type={showAdminPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  disabled={isSubmitting}
                  value={adminPassword}
                  onChange={(e) => {
                    setAdminPassword(e.target.value);
                    setErrorMessage(null);
                  }}
                  placeholder="••••••••••••"
                  className="w-full bg-[#0B0B14] border border-white/10 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowAdminPassword(!showAdminPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  aria-label={
                    showAdminPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'
                  }
                >
                  {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-98 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-900/30 transition disabled:opacity-50 mt-1"
            >
              {isSubmitting ? 'Vérification...' : 'Se connecter'}
            </button>
          </form>
        )}

        {/* Tab 2: Formulaire Visiteur Spécial (identifiant + mot de passe) */}
        {activeTab === 'visitor' && (
          <form onSubmit={handleVisitorSubmit} className="space-y-3.5">
            <div>
              <label
                htmlFor="visitor-identifier"
                className="block text-[11px] font-medium text-slate-300 mb-1"
              >
                Identifiant
              </label>
              <input
                id="visitor-identifier"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                disabled={isSubmitting}
                value={visitorIdentifier}
                onChange={(e) => {
                  setVisitorIdentifier(e.target.value);
                  setErrorMessage(null);
                }}
                placeholder="Ex. audit.direction"
                className="w-full bg-[#0B0B14] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition disabled:opacity-50"
              />
            </div>

            <div>
              <label
                htmlFor="visitor-password"
                className="block text-[11px] font-medium text-slate-300 mb-1"
              >
                Mot de passe
              </label>
              <div className="relative">
                <input
                  id="visitor-password"
                  type={showVisitorPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  disabled={isSubmitting}
                  value={visitorPassword}
                  onChange={(e) => {
                    setVisitorPassword(e.target.value);
                    setErrorMessage(null);
                  }}
                  placeholder="••••••••••••"
                  className="w-full bg-[#0B0B14] border border-white/10 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowVisitorPassword(!showVisitorPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  aria-label={
                    showVisitorPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'
                  }
                >
                  {showVisitorPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-98 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-900/30 transition disabled:opacity-50 mt-1"
            >
              {isSubmitting ? 'Vérification...' : 'Se connecter'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
