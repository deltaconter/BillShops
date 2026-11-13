import React, { useState, useEffect, useCallback } from 'react';
import { Save, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { DbEstablishmentSettings } from '../../types/database';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/supabaseService';

interface SettingsViewProps {
  onBack: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onBack }) => {
  const { session } = useAuth();
  const establishmentId = session?.establishmentId;

  const [settings, setSettings] = useState<DbEstablishmentSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    if (!establishmentId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await dataService.getSettings(establishmentId);
      if (data) {
        setSettings(data);
      } else {
        setSettings({
          id: '',
          establishment_id: establishmentId,
          name: 'BillShops',
          legal_name: null,
          currency: 'FC',
          phone: null,
          whatsapp_number: null,
          email: null,
          address: null,
          city: null,
          mpesa_enabled: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger les paramètres.');
    } finally {
      setIsLoading(false);
    }
  }, [establishmentId]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings || !establishmentId || isSaving) return;

    setError(null);
    setNotice(null);
    setIsSaving(true);
    try {
      const confirmed = await dataService.updateSettings(settings, establishmentId);
      setSettings(confirmed);
      setNotice('Paramètres enregistrés avec succès !');
      setTimeout(() => setNotice(null), 3500);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erreur lors de la sauvegarde des paramètres.'
      );
    } finally {
      setIsSaving(false);
    }
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
          <h2 className="text-base font-bold text-white">Paramètres Agence</h2>
          <p className="text-[10px] text-slate-400">Coordonnées et services</p>
        </div>
        <div className="w-9" />
      </div>

      {notice && (
        <div className="bg-emerald-950/80 border border-emerald-500/40 px-3.5 py-2 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="bg-red-950/70 border border-red-500/40 px-3.5 py-2.5 rounded-xl text-xs text-red-200 flex items-start justify-between gap-2"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
          {!settings && (
            <button
              type="button"
              onClick={() => void loadSettings()}
              className="underline font-bold text-red-300 shrink-0"
            >
              Réessayer
            </button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-10 text-xs text-slate-400">
          Chargement des paramètres depuis Supabase...
        </div>
      ) : settings ? (
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="bg-[#131424] border border-white/5 rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider">
              Informations de l'établissement
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1">
                Nom commercial
              </label>
              <input
                type="text"
                required
                disabled={isSaving}
                value={settings.name}
                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                className="w-full bg-[#0a0a14] border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1">
                Raison sociale
              </label>
              <input
                type="text"
                disabled={isSaving}
                value={settings.legal_name ?? ''}
                onChange={(e) => setSettings({ ...settings, legal_name: e.target.value || null })}
                className="w-full bg-[#0a0a14] border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1">
                Téléphone d'accueil
              </label>
              <input
                type="text"
                disabled={isSaving}
                value={settings.phone ?? ''}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value || null })}
                className="w-full bg-[#0a0a14] border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1">
                Numéro WhatsApp (avec indicatif pays, ex: +243971234567)
              </label>
              <input
                type="text"
                disabled={isSaving}
                value={settings.whatsapp_number ?? ''}
                onChange={(e) =>
                  setSettings({ ...settings, whatsapp_number: e.target.value || null })
                }
                className="w-full bg-[#0a0a14] border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1">
                Adresse physique & Ville
              </label>
              <input
                type="text"
                disabled={isSaving}
                value={settings.address ?? ''}
                onChange={(e) => setSettings({ ...settings, address: e.target.value || null })}
                className="w-full bg-[#0a0a14] border border-white/10 rounded-xl px-3 py-2 text-xs text-white mb-2"
                placeholder="Adresse"
              />
              <input
                type="text"
                disabled={isSaving}
                value={settings.city ?? ''}
                onChange={(e) => setSettings({ ...settings, city: e.target.value || null })}
                className="w-full bg-[#0a0a14] border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                placeholder="Ville"
              />
            </div>
          </div>

          {/* Configuration des services */}
          <div className="bg-[#131424] border border-white/5 rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wider">
              Configuration des services
            </h3>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-white">Service M-Pesa</p>
                <p className="text-[10px] text-slate-400">
                  {settings.mpesa_enabled
                    ? 'Service opérationnel'
                    : 'Affiché comme "Bientôt disponible"'}
                </p>
              </div>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setSettings({ ...settings, mpesa_enabled: !settings.mpesa_enabled })}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                  settings.mpesa_enabled
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {settings.mpesa_enabled ? 'Activé' : 'Bientôt disponible'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 text-white text-xs font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>
              {isSaving ? 'Enregistrement serveur...' : 'Enregistrer les paramètres'}
            </span>
          </button>
        </form>
      ) : null}
    </div>
  );
};
