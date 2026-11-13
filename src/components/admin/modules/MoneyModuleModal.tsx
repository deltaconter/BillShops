import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Smartphone,
  Save,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Coins,
  Plus,
  Trash2,
  Ban,
} from 'lucide-react';
import {
  MoneyAccountInput,
  MoneyMovementDirection,
  MoneyMovementInput,
  MoneyMovementType,
} from '../../../types/financial';
import {
  calculateMoneyModule,
  formatFC,
  parseFC,
} from '../../../services/financialCalculations';
import {
  clearModuleDraft,
  getModuleDraft,
  saveModuleDraft,
} from '../../../services/draftService';

interface MoneyDraft {
  accountList: MoneyAccountInput[];
  noActivity: boolean;
}

interface MoneyModuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  establishmentId?: string;
  reportDate: string;
  accounts: MoneyAccountInput[];
  initialNoActivity?: boolean;
  onSave: (accounts: MoneyAccountInput[], noActivity: boolean) => Promise<void>;
  isLocked?: boolean;
}

export const MoneyModuleModal: React.FC<MoneyModuleModalProps> = ({
  isOpen,
  onClose,
  establishmentId,
  reportDate,
  accounts,
  initialNoActivity = false,
  onSave,
  isLocked = false,
}) => {
  const [accountList, setAccountList] = useState<MoneyAccountInput[]>(accounts);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [noActivity, setNoActivity] = useState(initialNoActivity);
  const [hasDraftNotice, setHasDraftNotice] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastInitKeyRef = useRef<string | null>(null);

  // Saisie d'un mouvement exceptionnel ('other_electronic' | 'other_cash')
  const [movType, setMovType] = useState<MoneyMovementType>('other_cash');
  const [movDirection, setMovDirection] = useState<MoneyMovementDirection>('in');
  const [movAmountInput, setMovAmountInput] = useState('');
  const [movNotes, setMovNotes] = useState('');

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
    setSelectedIdx(0);
    setMovAmountInput('');
    setMovNotes('');

    const draft = !isLocked
      ? getModuleDraft<MoneyDraft>(establishmentId, reportDate, 'money')
      : null;

    if (draft && Array.isArray(draft.accountList) && draft.accountList.length > 0) {
      setAccountList(draft.accountList);
      setNoActivity(Boolean(draft.noActivity));
      setHasDraftNotice(true);
    } else {
      setAccountList(accounts);
      setNoActivity(Boolean(initialNoActivity));
      setHasDraftNotice(false);
    }
  }, [isOpen, establishmentId, reportDate, isLocked, accounts, initialNoActivity]);

  if (!isOpen) return null;

  const safeIdx = selectedIdx < accountList.length ? selectedIdx : 0;
  const current = accountList[safeIdx];
  const moneyModuleResult = calculateMoneyModule(accountList);
  const currentResult = moneyModuleResult.accounts[safeIdx];

  const persistDraft = (nextList: MoneyAccountInput[], nextNoActivity: boolean) => {
    if (isLocked) return;
    saveModuleDraft<MoneyDraft>(establishmentId, reportDate, 'money', {
      accountList: nextList,
      noActivity: nextNoActivity,
    });
  };

  const resetToServerValues = () => {
    clearModuleDraft(establishmentId, reportDate, 'money');
    setAccountList(accounts);
    setNoActivity(Boolean(initialNoActivity));
    setHasDraftNotice(false);
    setError(null);
  };

  const updateCurrentField = (field: keyof MoneyAccountInput, val: unknown) => {
    if (!current) return;
    const updated = [...accountList];
    updated[safeIdx] = {
      ...updated[safeIdx],
      [field]: val,
      // Effacer les valeurs figées serveur pour prévisualiser les saisies modifiées
      serverCalculated: undefined,
    };
    setAccountList(updated);
    persistDraft(updated, noActivity);
  };

  const handleAddMovement = () => {
    if (!current || isLocked || noActivity || isSubmitting) return;
    const amount = parseFC(movAmountInput);
    const trimmedNotes = movNotes.trim();
    if (amount <= 0) {
      setError('Veuillez saisir un montant valide supérieur à 0 pour le mouvement exceptionnel.');
      return;
    }
    if (!trimmedNotes) {
      setError('Un motif (notes) est obligatoire pour chaque mouvement exceptionnel.');
      return;
    }

    setError(null);
    const newMov: MoneyMovementInput = {
      movementType: movType,
      direction: movDirection,
      amount,
      notes: trimmedNotes,
      isPersisted: false,
    };
    updateCurrentField('movements', [...(current.movements || []), newMov]);
    setMovAmountInput('');
    setMovNotes('');
  };

  const handleRemoveMovement = (index: number) => {
    if (!current || isLocked || noActivity || isSubmitting) return;
    const updatedMovs = [...(current.movements || [])];
    updatedMovs.splice(index, 1);
    updateCurrentField('movements', updatedMovs);
  };

  const handleSave = async () => {
    if (isLocked || isSubmitting) return;
    if (!noActivity && accountList.length === 0) {
      setError(
        'Aucun compte Mobile Money actif configuré pour cet établissement. Cochez "Aucune opération aujourd\'hui" ou configurez un compte en base.'
      );
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await onSave(accountList, noActivity);
      clearModuleDraft(establishmentId, reportDate, 'money');
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
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-sky-600/20 rounded-full blur-2xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0284C7] to-[#2563EB] flex items-center justify-center text-white">
              <Smartphone className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Mobile Money</h2>
              <p className="text-[10px] text-slate-400">Cumuls journaliers et mouvements exceptionnels</p>
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
              <span>Aucune opération Mobile Money aujourd'hui</span>
            </div>
            <input
              type="checkbox"
              checked={noActivity}
              onChange={(e) => {
                const next = e.target.checked;
                setNoActivity(next);
                persistDraft(accountList, next);
              }}
              className="accent-sky-600 w-4 h-4"
            />
          </label>
        )}

        {/* Account Selector if multiple */}
        {accountList.length > 1 && (
          <div
            className={`flex gap-2 my-2 overflow-x-auto pb-1 ${
              noActivity ? 'opacity-40 pointer-events-none' : ''
            }`}
          >
            {accountList.map((acc, idx) => (
              <button
                key={acc.accountId}
                type="button"
                onClick={() => setSelectedIdx(idx)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  safeIdx === idx
                    ? 'bg-purple-600 text-white'
                    : 'bg-[#0a0a14] text-slate-400 border border-white/5'
                }`}
              >
                {acc.serviceName}
              </button>
            ))}
          </div>
        )}

        {/* Form Body */}
        <div
          className={`space-y-4 pt-2 flex-1 overflow-y-auto pr-1 ${
            noActivity ? 'opacity-40 pointer-events-none' : ''
          }`}
        >
          {!current || !currentResult ? (
            <div className="bg-[#0b0c18] border border-white/10 rounded-2xl p-4 text-center text-xs text-slate-400">
              Aucun compte Mobile Money actif trouvé dans la base de données pour cet établissement.
            </div>
          ) : (
            <>
              {/* Rappel comptable du sens des opérations */}
              <div className="bg-[#0b0c18] border border-sky-500/20 rounded-xl p-2.5 text-[10px] text-slate-300 leading-relaxed">
                <p className="font-semibold text-sky-400 mb-0.5">Règle de gestion financière :</p>
                <p>
                  • <strong>Dépôt</strong> : Client verse du cash (+Caisse) / Agence envoie monnaie
                  (-Portefeuille).
                </p>
                <p>
                  • <strong>Retrait</strong> : Client reçoit du cash (-Caisse) / Agence reçoit monnaie
                  (+Portefeuille).
                </p>
              </div>

              {/* Section 1: Opérations cumulées de la journée */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold text-slate-200">
                  1. Cumuls journaliers ({current.accountLabel})
                </h3>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                    <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
                    Total des Dépôts clients (+ Caisse / - Portefeuille)
                  </label>
                  <input
                    type="text"
                    disabled={isLocked || noActivity || isSubmitting}
                    value={current.totalDeposits.toString()}
                    onChange={(e) => updateCurrentField('totalDeposits', parseFC(e.target.value))}
                    placeholder="Ex: 250 000"
                    className="w-full bg-[#0a0a14] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-bold tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                    <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />
                    Total des Retraits clients (- Caisse / + Portefeuille)
                  </label>
                  <input
                    type="text"
                    disabled={isLocked || noActivity || isSubmitting}
                    value={current.totalWithdrawals.toString()}
                    onChange={(e) => updateCurrentField('totalWithdrawals', parseFC(e.target.value))}
                    placeholder="Ex: 120 000"
                    className="w-full bg-[#0a0a14] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-bold tabular-nums"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                      <Coins className="w-3 h-3 text-sky-400" />
                      Commissions reçues
                    </label>
                    <input
                      type="text"
                      disabled={isLocked || noActivity || isSubmitting}
                      value={current.commissionsReceived.toString()}
                      onChange={(e) =>
                        updateCurrentField('commissionsReceived', parseFC(e.target.value))
                      }
                      placeholder="Ex: 15 000"
                      className="w-full bg-[#0a0a14] border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-bold tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                      <Coins className="w-3 h-3 text-purple-400" />
                      Commissions conservées
                    </label>
                    <input
                      type="text"
                      disabled={isLocked || noActivity || isSubmitting}
                      value={current.earnedCommissions.toString()}
                      onChange={(e) =>
                        updateCurrentField('earnedCommissions', parseFC(e.target.value))
                      }
                      placeholder="Ex: 15 000"
                      className="w-full bg-[#0a0a14] border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-bold tabular-nums"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Contrôle du Portefeuille Électronique */}
              <div className="bg-[#0b0c18] border border-white/5 rounded-2xl p-3 space-y-2">
                <h4 className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                  <Wallet className="w-4 h-4" />
                  Contrôle Portefeuille Électronique
                </h4>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">
                      Solde Électr. Initial
                    </label>
                    <input
                      type="text"
                      disabled={isLocked || noActivity || isSubmitting}
                      value={current.initialEBalance.toString()}
                      onChange={(e) =>
                        updateCurrentField('initialEBalance', parseFC(e.target.value))
                      }
                      className="w-full bg-[#121324] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white font-bold tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">
                      Solde Électr. Final Réel
                    </label>
                    <input
                      type="text"
                      disabled={isLocked || noActivity || isSubmitting}
                      value={current.finalEBalance.toString()}
                      onChange={(e) => updateCurrentField('finalEBalance', parseFC(e.target.value))}
                      className="w-full bg-[#121324] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white font-bold tabular-nums"
                    />
                  </div>
                </div>

                <div className="pt-1 flex items-center justify-between text-[11px] border-t border-white/5">
                  <span className="text-slate-400">SE Théorique (calcul serveur) :</span>
                  <span className="font-bold text-white tabular-nums">
                    {formatFC(currentResult.theoreticalEBalance)}
                  </span>
                </div>

                {currentResult.eBalanceDiscrepancy !== 0 && (
                  <div className="bg-amber-950/70 border border-amber-500/40 p-2 rounded-lg text-[11px] text-amber-200 flex items-center justify-between">
                    <span>Écart électronique :</span>
                    <span className="font-extrabold tabular-nums">
                      {currentResult.eBalanceDiscrepancy > 0 ? '+' : ''}
                      {formatFC(currentResult.eBalanceDiscrepancy)}
                    </span>
                  </div>
                )}
              </div>

              {/* Section 3: Contrôle de la Caisse Physique */}
              <div className="bg-[#0b0c18] border border-white/5 rounded-2xl p-3 space-y-2">
                <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <Coins className="w-4 h-4" />
                  Contrôle Caisse Physique
                </h4>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Caisse Initiale</label>
                    <input
                      type="text"
                      disabled={isLocked || noActivity || isSubmitting}
                      value={current.initialCash.toString()}
                      onChange={(e) => updateCurrentField('initialCash', parseFC(e.target.value))}
                      className="w-full bg-[#121324] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white font-bold tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">
                      Caisse Finale Réelle
                    </label>
                    <input
                      type="text"
                      disabled={isLocked || noActivity || isSubmitting}
                      value={current.finalCash.toString()}
                      onChange={(e) => updateCurrentField('finalCash', parseFC(e.target.value))}
                      className="w-full bg-[#121324] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white font-bold tabular-nums"
                    />
                  </div>
                </div>

                <div className="pt-1 flex items-center justify-between text-[11px] border-t border-white/5">
                  <span className="text-slate-400">Caisse Théorique (calcul serveur) :</span>
                  <span className="font-bold text-white tabular-nums">
                    {formatFC(currentResult.theoreticalCash)}
                  </span>
                </div>

                {currentResult.cashDiscrepancy !== 0 && (
                  <div className="bg-amber-950/70 border border-amber-500/40 p-2 rounded-lg text-[11px] text-amber-200 flex items-center justify-between">
                    <span>Écart de caisse :</span>
                    <span className="font-extrabold tabular-nums">
                      {currentResult.cashDiscrepancy > 0 ? '+' : ''}
                      {formatFC(currentResult.cashDiscrepancy)}
                    </span>
                  </div>
                )}
              </div>

              {/* Section 4: Autres mouvements exceptionnels uniquement */}
              <div className="bg-[#0b0c18] border border-white/5 rounded-2xl p-3 space-y-2.5">
                <div>
                  <h4 className="text-xs font-bold text-purple-300">
                    Autres mouvements exceptionnels
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    Réapprovisionnement / ajustement hors dépôts & retraits clients (motif obligatoire).
                  </p>
                </div>

                {(current.movements || []).length > 0 && (
                  <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                    {(current.movements || []).map((mov, idx) => (
                      <div
                        key={mov.id || idx}
                        className="flex items-center justify-between p-2 rounded-lg bg-[#121324] border border-white/5 text-[11px] gap-2"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-slate-200 flex items-center gap-1.5">
                            <span>
                              {mov.movementType === 'other_electronic' ? 'Électronique' : 'Cash'}
                            </span>
                            <span
                              className={
                                mov.direction === 'in' ? 'text-emerald-400' : 'text-rose-400'
                              }
                            >
                              {mov.direction === 'in' ? '+' : '-'}
                              {formatFC(mov.amount)}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 truncate">{mov.notes}</p>
                        </div>

                        {!isLocked && !noActivity && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMovement(idx)}
                            className="text-slate-500 hover:text-red-400 shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {!isLocked && !noActivity && (
                  <div className="space-y-2 pt-1 border-t border-white/5">
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={movType}
                        onChange={(e) => setMovType(e.target.value as MoneyMovementType)}
                        className="bg-[#121324] border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white"
                      >
                        <option value="other_cash">Autre cash</option>
                        <option value="other_electronic">Autre électronique</option>
                      </select>

                      <select
                        value={movDirection}
                        onChange={(e) => setMovDirection(e.target.value as MoneyMovementDirection)}
                        className="bg-[#121324] border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white"
                      >
                        <option value="in">Entrée (+)</option>
                        <option value="out">Sortie (-)</option>
                      </select>
                    </div>

                    <input
                      type="text"
                      value={movAmountInput}
                      onChange={(e) => setMovAmountInput(e.target.value)}
                      placeholder="Montant (FC)"
                      className="w-full bg-[#121324] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 font-bold tabular-nums"
                    />

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={movNotes}
                        onChange={(e) => setMovNotes(e.target.value)}
                        placeholder="Motif obligatoire (ex: Appoint caisse)"
                        className="flex-1 bg-[#121324] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500"
                      />
                      <button
                        type="button"
                        onClick={handleAddMovement}
                        className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Ajouter</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Validation d'équilibrage global */}
              {!currentResult.hasDiscrepancy ? (
                <div className="bg-emerald-950/40 border border-emerald-500/30 p-2.5 rounded-xl flex items-center gap-2 text-xs text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
                  <span>Caisse physique et portefeuille électronique équilibrés</span>
                </div>
              ) : (
                <div className="bg-amber-950/50 border border-amber-500/30 p-2.5 rounded-xl flex items-center gap-2 text-xs text-amber-300">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    Un écart a été détecté. Une justification sera demandée lors de la clôture.
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Validation */}
        <div className="pt-3 border-t border-white/10">
          <button
            type="button"
            disabled={isLocked || isSubmitting}
            onClick={handleSave}
            className="w-full py-2.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 active:scale-98 text-white text-xs font-bold rounded-xl shadow-lg shadow-sky-950/40 flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>
              {isSubmitting ? 'Enregistrement serveur...' : 'Enregistrer Mobile Money'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
