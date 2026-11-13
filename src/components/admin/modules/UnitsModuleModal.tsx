import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  BarChart3,
  Plus,
  Trash2,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Save,
  Calculator,
  Ban,
} from 'lucide-react';
import {
  TelecomNetwork,
  TELECOM_NETWORKS,
  NetworkBalanceInput,
  NetworkMovementInput,
} from '../../../types/financial';
import {
  calculateTelecomModule,
  formatFC,
  parseFC,
} from '../../../services/financialCalculations';
import {
  clearModuleDraft,
  getModuleDraft,
  saveModuleDraft,
} from '../../../services/draftService';

interface TelecomDraft {
  balances: Record<TelecomNetwork, NetworkBalanceInput>;
  noActivity: boolean;
}

interface UnitsModuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  establishmentId?: string;
  reportDate: string;
  initialBalances: Record<TelecomNetwork, NetworkBalanceInput>;
  initialNoActivity?: boolean;
  onSave: (
    balances: Record<TelecomNetwork, NetworkBalanceInput>,
    noActivity: boolean
  ) => Promise<void>;
  isLocked?: boolean;
}

export const UnitsModuleModal: React.FC<UnitsModuleModalProps> = ({
  isOpen,
  onClose,
  establishmentId,
  reportDate,
  initialBalances,
  initialNoActivity = false,
  onSave,
  isLocked = false,
}) => {
  const [selectedNetwork, setSelectedNetwork] = useState<TelecomNetwork>('orange');
  const [balances, setBalances] =
    useState<Record<TelecomNetwork, NetworkBalanceInput>>(initialBalances);
  const [noActivity, setNoActivity] = useState(initialNoActivity);
  const [supplyInput, setSupplyInput] = useState('');
  const [hasDraftNotice, setHasDraftNotice] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastInitKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      lastInitKeyRef.current = null;
      return;
    }

    const initKey = `${establishmentId || ''}:${reportDate}:${isLocked ? '1' : '0'}`;
    if (lastInitKeyRef.current === initKey) {
      return;
    }
    lastInitKeyRef.current = initKey;

    setError(null);
    setIsSubmitting(false);
    setSupplyInput('');

    const draft = !isLocked
      ? getModuleDraft<TelecomDraft>(establishmentId, reportDate, 'units')
      : null;

    if (draft?.balances) {
      setBalances(draft.balances);
      setNoActivity(Boolean(draft.noActivity));
      setHasDraftNotice(true);
    } else {
      setBalances(initialBalances);
      setNoActivity(Boolean(initialNoActivity));
      setHasDraftNotice(false);
    }
  }, [isOpen, establishmentId, reportDate, isLocked, initialBalances, initialNoActivity]);

  if (!isOpen) return null;

  const current = balances[selectedNetwork];
  const telecomSummary = calculateTelecomModule(balances);
  const currentResult = telecomSummary.networks[selectedNetwork];

  const persistDraft = (nextBalances: Record<TelecomNetwork, NetworkBalanceInput>, nextNoActivity: boolean) => {
    if (isLocked) return;
    saveModuleDraft<TelecomDraft>(establishmentId, reportDate, 'units', {
      balances: nextBalances,
      noActivity: nextNoActivity,
    });
  };

  const resetToServerValues = () => {
    clearModuleDraft(establishmentId, reportDate, 'units');
    setBalances(initialBalances);
    setNoActivity(Boolean(initialNoActivity));
    setHasDraftNotice(false);
    setError(null);
  };

  const updateNetworkField = (field: keyof NetworkBalanceInput, val: unknown) => {
    const nextBalances: Record<TelecomNetwork, NetworkBalanceInput> = {
      ...balances,
      [selectedNetwork]: {
        ...balances[selectedNetwork],
        [field]: val,
        // Effacer les totaux figés serveur afin de prévisualiser les modifications en cours
        serverTotals: undefined,
      },
    };
    setBalances(nextBalances);
    persistDraft(nextBalances, noActivity);
  };

  const handleAddSupply = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked || noActivity || isSubmitting) return;
    const amount = parseFC(supplyInput);
    if (amount <= 0) return;

    const newSupply: NetworkMovementInput = {
      amount,
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      isPersisted: false,
    };

    updateNetworkField('supplies', [...(current.supplies || []), newSupply]);
    setSupplyInput('');
  };

  const handleRemoveSupply = (index: number) => {
    if (isLocked || noActivity || isSubmitting) return;
    const updated = [...(current.supplies || [])];
    updated.splice(index, 1);
    updateNetworkField('supplies', updated);
  };

  const handleSaveAll = async () => {
    if (isLocked || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);

    try {
      await onSave(balances, noActivity);
      clearModuleDraft(establishmentId, reportDate, 'units');
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Erreur lors de l’enregistrement. Vos saisies restent en brouillon local.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in duration-150">
      <div className="bg-[#121324] border border-white/10 w-full max-w-sm rounded-3xl p-5 shadow-2xl text-white relative overflow-hidden flex flex-col max-h-[92vh]">
        {/* Glow */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-600/20 rounded-full blur-2xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#10B981] to-[#059669] flex items-center justify-center text-white">
              <BarChart3 className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Unités Téléphoniques</h2>
              <p className="text-[10px] text-slate-400">Orange • Airtel • Africell • Vodacom</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {hasDraftNotice && (
          <div className="mt-2.5 bg-amber-950/60 border border-amber-500/40 rounded-xl px-3 py-2 text-[11px] text-amber-200 flex items-center justify-between gap-2">
            <span>Brouillon local non confirmé restauré.</span>
            <button
              type="button"
              onClick={resetToServerValues}
              className="underline font-bold text-amber-300 shrink-0"
            >
              Réinitialiser
            </button>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mt-2.5 bg-red-950/70 border border-red-500/40 rounded-xl p-2.5 text-xs text-red-200 flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Option Aucune activité */}
        {!isLocked && (
          <label className="mt-2.5 flex items-center justify-between bg-[#0e0f1d] border border-white/10 rounded-xl px-3 py-2 cursor-pointer">
            <div className="flex items-center gap-2 text-xs text-slate-200 font-medium">
              <Ban className="w-4 h-4 text-slate-400" />
              <span>Aucune opération Unités aujourd'hui</span>
            </div>
            <input
              type="checkbox"
              checked={noActivity}
              onChange={(e) => {
                const next = e.target.checked;
                setNoActivity(next);
                persistDraft(balances, next);
              }}
              className="accent-emerald-600 w-4 h-4"
            />
          </label>
        )}

        {/* 4 Network Tabs */}
        <div
          className={`grid grid-cols-4 gap-1.5 p-1 bg-[#0a0a14] rounded-2xl my-3 border border-white/5 ${
            noActivity ? 'opacity-40 pointer-events-none' : ''
          }`}
        >
          {TELECOM_NETWORKS.map((net) => {
            const netRes = telecomSummary.networks[net.id];
            const hasNegative = netRes.hasNegativeSoldUnits;
            const hasAlert = netRes.hasDiscrepancy;
            const isSelected = selectedNetwork === net.id;
            return (
              <button
                key={net.id}
                type="button"
                onClick={() => setSelectedNetwork(net.id)}
                className={`py-2 px-1.5 rounded-xl text-[11px] font-bold flex flex-col items-center justify-center transition relative ${
                  isSelected
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>{net.name}</span>
                {hasNegative ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 absolute top-1 right-1" />
                ) : hasAlert ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 absolute top-1 right-1" />
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Active Network Form */}
        <div
          className={`space-y-3.5 flex-1 overflow-y-auto pr-1 ${
            noActivity ? 'opacity-40 pointer-events-none' : ''
          }`}
        >
          {/* Solde Initial */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-200 mb-1">
              Solde initial (Ouverture)
            </label>
            <input
              type="text"
              disabled={isLocked || noActivity || isSubmitting}
              value={current.initialBalance.toString()}
              onChange={(e) => updateNetworkField('initialBalance', parseFC(e.target.value))}
              placeholder="Ex: 50 000"
              className="w-full bg-[#0a0a14] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-bold tabular-nums"
            />
          </div>

          {/* Approvisionnements en cours de journée */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-slate-200">
                Approvisionnements du jour
              </label>
              <span className="text-[10px] font-bold text-purple-400 tabular-nums">
                Total : {formatFC(currentResult.totalSupplies)}
              </span>
            </div>

            {(current.supplies || []).length > 0 && (
              <div className="space-y-1.5 mb-2 max-h-24 overflow-y-auto pr-1">
                {current.supplies.map((sup, idx) => (
                  <div
                    key={sup.id || idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-[#0e0f1d] border border-white/5 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 font-mono">
                        {sup.time || '10:00'}
                      </span>
                      <span className="font-bold text-slate-200 tabular-nums">
                        +{formatFC(sup.amount)}
                      </span>
                    </div>
                    {!isLocked && !noActivity && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSupply(idx)}
                        className="text-slate-500 hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!isLocked && !noActivity && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={supplyInput}
                  onChange={(e) => setSupplyInput(e.target.value)}
                  placeholder="Montant approv. (FC)"
                  className="flex-1 bg-[#0a0a14] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 tabular-nums font-medium"
                />
                <button
                  type="button"
                  onClick={handleAddSupply}
                  className="px-3 py-2 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter</span>
                </button>
              </div>
            )}
          </div>

          {/* Solde Final */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-200 mb-1">
              Solde final (Clôture)
            </label>
            <input
              type="text"
              disabled={isLocked || noActivity || isSubmitting}
              value={current.finalBalance.toString()}
              onChange={(e) => updateNetworkField('finalBalance', parseFC(e.target.value))}
              placeholder="Ex: 20 000"
              className="w-full bg-[#0a0a14] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-bold tabular-nums"
            />
          </div>

          {/* Unités vendues calculées */}
          <div
            className={`bg-[#0b0c18] rounded-2xl p-3 space-y-1.5 text-xs border ${
              currentResult.hasNegativeSoldUnits ? 'border-red-500/50' : 'border-white/5'
            }`}
          >
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1">
                <Calculator className="w-3.5 h-3.5 text-purple-400" />
                Unités vendues calculées :
              </span>
              <span
                className={`font-extrabold tabular-nums text-sm ${
                  currentResult.hasNegativeSoldUnits ? 'text-red-400' : 'text-[#10B981]'
                }`}
              >
                {formatFC(currentResult.soldUnits)}
              </span>
            </div>
            <p className="text-[10px] text-slate-500">
              Formule : Solde initial ({formatFC(currentResult.initialBalance)}) + Approv. (
              {formatFC(currentResult.totalSupplies)}) - Solde final (
              {formatFC(currentResult.finalBalance)})
            </p>
          </div>

          {/* Alerte anomalie sold_units négatif (jamais masquée à 0) */}
          {currentResult.hasNegativeSoldUnits && (
            <div
              role="alert"
              className="bg-red-950/70 border border-red-500/50 p-2.5 rounded-xl flex items-start gap-2 text-xs text-red-200"
            >
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>
                <strong>Anomalie détectée :</strong> Les unités vendues sont négatives (
                {formatFC(currentResult.soldUnits)}). Vérifiez le solde final ou un approvisionnement
                manquant.
              </span>
            </div>
          )}

          {/* Encaissement réel */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-200 mb-1">
              Montant réellement encaissé en caisse (FC)
            </label>
            <input
              type="text"
              disabled={isLocked || noActivity || isSubmitting}
              value={current.cashCollected.toString()}
              onChange={(e) => updateNetworkField('cashCollected', parseFC(e.target.value))}
              placeholder="Ex: 40 000"
              className="w-full bg-[#0a0a14] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-bold tabular-nums"
            />
          </div>

          {/* Écart de caisse */}
          {currentResult.discrepancy !== 0 ? (
            <div className="bg-amber-950/60 border border-amber-500/40 p-2.5 rounded-xl flex items-center justify-between text-xs text-amber-200">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="font-semibold">
                  {currentResult.discrepancy < 0 ? 'Déficit de caisse :' : 'Surplus constaté :'}
                </span>
              </div>
              <span className="font-extrabold tabular-nums">
                {currentResult.discrepancy < 0 ? '-' : '+'}
                {formatFC(Math.abs(currentResult.discrepancy))}
              </span>
            </div>
          ) : !currentResult.hasNegativeSoldUnits ? (
            <div className="bg-emerald-950/40 border border-emerald-500/30 p-2 rounded-xl flex items-center gap-1.5 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
              <span>Caisse et unités parfaitement équilibrées</span>
            </div>
          ) : null}
        </div>

        {/* Global Summary & Save */}
        <div className="pt-3 border-t border-white/10 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span>Total vendu (4 réseaux) :</span>
            <span
              className={`font-extrabold tabular-nums ${
                telecomSummary.hasNegativeSoldUnits ? 'text-red-400' : 'text-white'
              }`}
            >
              {formatFC(noActivity ? 0 : telecomSummary.totalSoldUnits)}
            </span>
          </div>

          <button
            type="button"
            disabled={isLocked || isSubmitting}
            onClick={handleSaveAll}
            className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-98 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>
              {isSubmitting ? 'Enregistrement serveur...' : 'Valider les unités vendues'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
