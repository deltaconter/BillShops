import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Plus,
  Shield,
  KeyRound,
  CheckCircle2,
  XCircle,
  X,
  Save,
  Trash2,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';
import { SpecialVisitorAccount } from '../../types/auth';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/supabaseService';

interface UsersManagementViewProps {
  onBack: () => void;
}

export const UsersManagementView: React.FC<UsersManagementViewProps> = ({ onBack }) => {
  const { session } = useAuth();
  const establishmentId = session?.establishmentId;

  const [visitors, setVisitors] = useState<SpecialVisitorAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadVisitors = useCallback(async () => {
    if (!establishmentId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const list = await dataService.getSpecialVisitors(establishmentId);
      setVisitors(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger les visiteurs spéciaux.');
    } finally {
      setIsLoading(false);
    }
  }, [establishmentId]);

  useEffect(() => {
    void loadVisitors();
  }, [loadVisitors]);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    showNotice(
      'La création de comptes Auth Visiteurs Spéciaux côté serveur sera activée au Lot 3 (Sécurité & Administration Auth).'
    );
  };

  const handleToggleActive = () => {
    showNotice(
      'L’activation/désactivation de comptes Auth Visiteurs Spéciaux relève du Lot 3 (Sécurité serveur).'
    );
  };

  const handleDelete = () => {
    showNotice(
      'La révocation de comptes Auth Visiteurs Spéciaux relève du Lot 3 (Sécurité serveur).'
    );
  };

  return (
    <div className="space-y-4 pb-20 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <h2 className="text-base font-bold text-white">Gestion des Visiteurs Spéciaux</h2>
          <p className="text-[10px] text-slate-400">Accès restreint en lecture seule</p>
        </div>
        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="w-9 h-9 rounded-xl bg-purple-600 hover:bg-purple-700 flex items-center justify-center text-white shadow-md shadow-purple-900/40"
          title="Ajouter un visiteur"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {notice && (
        <div className="bg-purple-950/80 border border-purple-500/40 px-3.5 py-2 rounded-xl text-xs text-purple-200">
          {notice}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="bg-red-950/70 border border-red-500/40 px-3.5 py-2 rounded-xl text-xs text-red-200 flex items-start justify-between gap-2"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadVisitors()}
            className="underline font-bold text-red-300 shrink-0"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Info Card */}
      <div className="bg-[#131424] border border-white/5 p-3.5 rounded-2xl flex items-start gap-3">
        <Shield className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-300 leading-relaxed">
          Chaque visiteur spécial dispose d’un accès isolé en <strong>lecture seule</strong>{' '}
          (résumés et totaux consolidés) via identifiant et mot de passe. Aucun détail d’opération
          ni de dépenses internes ne lui est accessible.
        </p>
      </div>

      {/* Visitors List */}
      <div className="space-y-2.5">
        {isLoading ? (
          <div className="text-center py-10 text-slate-400 text-xs">
            Chargement depuis Supabase...
          </div>
        ) : visitors.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-xs">
            Aucun compte visiteur trouvé dans la base pour cet établissement.
          </div>
        ) : (
          visitors.map((v) => (
            <div
              key={v.id}
              className="bg-[#131424] border border-white/5 rounded-2xl p-3.5 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    v.isActive ? 'bg-purple-500/15 text-purple-400' : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">{v.username}</h4>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                    <span className="flex items-center gap-1 font-mono">
                      <KeyRound className="w-3 h-3 text-slate-500" />
                      Identifiant + mot de passe
                    </span>
                    <span>•</span>
                    <span className={v.isActive ? 'text-emerald-400' : 'text-slate-500'}>
                      {v.isActive ? 'Actif' : 'Désactivé'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleToggleActive}
                  className={`p-1.5 rounded-lg text-xs font-semibold ${
                    v.isActive
                      ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                  title={v.isActive ? 'Désactiver le compte' : 'Activer le compte'}
                >
                  {v.isActive ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Visitor Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-[#121324] border border-white/10 w-full max-w-sm rounded-3xl p-5 shadow-2xl text-white relative">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-bold text-white">Nouveau compte Visiteur Spécial</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3.5 pt-3">
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  Identifiant du visiteur
                </label>
                <input
                  type="text"
                  required
                  autoCapitalize="none"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Ex: audit.direction"
                  className="w-full bg-[#0a0a14] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  Mot de passe d’accès
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 caractères"
                  className="w-full bg-[#0a0a14] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Provisionnement Auth serveur prévu au Lot 3.
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-98 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-900/40 flex items-center justify-center gap-2 transition mt-2"
              >
                <Save className="w-4 h-4" />
                <span>Créer le compte Visiteur</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
