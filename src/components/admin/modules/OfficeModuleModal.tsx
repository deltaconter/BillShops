import React, { useState, useEffect, useRef } from 'react';
import { X, Printer, Calculator, AlertCircle, Save, Ban } from 'lucide-react';
import { OfficeCalculationInput } from '../../../types/financial';
import { calculateOffice, formatFC, parseFC } from '../../../services/financialCalculations';
import {
  clearModuleDraft,
  getModuleDraft,
  saveModuleDraft,
} from '../../../services/draftService';

interface OfficeDraft {
  turnoverInput: string;
  expensesInput: string;
  notes: string;
  noActivity: boolean;
}

interface OfficeModuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  establishmentId?: string;
  reportDate: string;
  initialData: OfficeCalculationInput & { notes?: string; serverNetResult?: number };
  initialNoActivity?: boolean;
  onSave: (data: OfficeCalculationInput & { notes?: string; noActivity: boolean }) => Promise<void>;
  isLocked?: boolean;
}

export const OfficeModuleModal: React.FC<OfficeModuleModalProps> = ({
  isOpen,
  onClose,
  establishmentId,
  reportDate,
  initialData,
  initialNoActivity = false,
  onSave,
  isLocked = false,
}) => {
  const [turnoverInput, setTurnoverInput] = useState(initialData.turnover.toString());
  const [expensesInput, setExpensesInput] = useState(initialData.expenses.toString());
  const [notes, setNotes] = useState(initialData.notes || '');
  const [noActivity, setNoActivity] = useState(initialNoActivity);
  const [isModified, setIsModified] = useState(false);
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

    const draft = !isLocked
      ? getModuleDraft<OfficeDraft>(establishmentId, reportDate, 'office')
      : null;

    if (draft) {
      setTurnoverInput(draft.turnoverInput ?? '0');
      setExpensesInput(draft.expensesInput ?? '0');
      setNotes(draft.notes ?? '');
      setNoActivity(Boolean(draft.noActivity));
      setIsModified(true);
      setHasDraftNotice(true);
    } else {
      setTurnoverInput(initialData.turnover.toString());
      setExpensesInput(initialData.expenses.toString());
      setNotes(initialData.notes || '');
      setNoActivity(Boolean(initialNoActivity));
      setIsModified(false);
      setHasDraftNotice(false);
    }
  }, [isOpen, establishmentId, reportDate, isLocked, initialData, initialNoActivity]);

  if (!isOpen) return null;

  const persistDraft = (next: OfficeDraft) => {
    if (isLocked) return;
    saveModuleDraft(establishmentId, reportDate, 'office', next);
  };

  const resetToServerValues = () => {
    clearModuleDraft(establishmentId, reportDate, 'office');
    setTurnoverInput(initialData.turnover.toString());
    setExpensesInput(initialData.expenses.toString());
    setNotes(initialData.notes || '');
    setNoActivity(Boolean(initialNoActivity));
    setIsModified(false);
    setHasDraftNotice(false);
    setError(null);
  };

  const turnover = noActivity ? 0 : parseFC(turnoverInput);
  const expenses = noActivity ? 0 : parseFC(expensesInput);
  const result = calculateOffice({
    turnover,
    expenses,
    serverNetResult: !isModified && !noActivity ? initialData.serverNetResult : undefined,
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked || isSubmitting) return;

    setError(null);
    setIsSubmitting(true);
    try {
      await onSave({
        turnover,
        expenses,
        notes: noActivity ? undefined : notes,
        noActivity,
      });
      clearModuleDraft(establishmentId, reportDate, 'office');
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
      <div className="bg-[#121324] border border-white/10 w-full max-w-sm rounded-3xl p-5 shadow-2xl text-white relative overflow-hidden flex flex-col max-h-[90vh]">
        {/* Glow */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-600/20 rounded-full blur-2xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#9333EA] flex items-center justify-center text-white">
              <Printer className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Module Bureautique</h2>
              <p className="text-[10px] text-slate-400">Activité principale de l'agence</p>
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

        {/* Content */}
        <form onSubmit={handleSave} className="space-y-4 pt-3 flex-1 overflow-y-auto pr-1">
          {hasDraftNotice && (
            <div className="bg-amber-950/60 border border-amber-500/40 rounded-xl px-3 py-2 text-[11px] text-amber-200 flex items-center justify-between gap-2">
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
              className="bg-red-950/70 border border-red-500/40 rounded-xl p-2.5 text-xs text-red-200 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Option Aucune activité */}
          {!isLocked && (
            <label className="flex items-center justify-between bg-[#0e0f1d] border border-white/10 rounded-xl px-3 py-2.5 cursor-pointer">
              <div className="flex items-center gap-2 text-xs text-slate-200 font-medium">
                <Ban className="w-4 h-4 text-slate-400" />
                <span>Aucune activité Bureautique aujourd'hui</span>
              </div>
              <input
                type="checkbox"
                checked={noActivity}
                onChange={(e) => {
                  const next = e.target.checked;
                  setNoActivity(next);
                  setIsModified(true);
                  persistDraft({ turnoverInput, expensesInput, notes, noActivity: next });
                }}
                className="accent-purple-600 w-4 h-4"
              />
            </label>
          )}

          {/* Chiffre d'affaires */}
          <div className={noActivity ? 'opacity-40 pointer-events-none' : ''}>
            <label className="block text-xs font-semibold text-slate-200 mb-1">
              Chiffre d'affaires journalier (FC)
            </label>
            <input
              type="text"
              disabled={isLocked || noActivity || isSubmitting}
              value={turnoverInput}
              onChange={(e) => {
                const next = e.target.value;
                setTurnoverInput(next);
                setIsModified(true);
                persistDraft({ turnoverInput: next, expensesInput, notes, noActivity });
              }}
              placeholder="Ex: 125 000"
              className="w-full bg-[#0a0a14] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-bold tabular-nums"
            />
            <p className="text-[10px] text-slate-400 mt-1">Montant saisi : {formatFC(turnover)}</p>
          </div>

          {/* Dépenses journalières */}
          <div className={noActivity ? 'opacity-40 pointer-events-none' : ''}>
            <label className="block text-xs font-semibold text-slate-200 mb-1">
              Dépenses journalières d'exploitation (FC)
            </label>
            <input
              type="text"
              disabled={isLocked || noActivity || isSubmitting}
              value={expensesInput}
              onChange={(e) => {
                const next = e.target.value;
                setExpensesInput(next);
                setIsModified(true);
                persistDraft({ turnoverInput, expensesInput: next, notes, noActivity });
              }}
              placeholder="Ex: 15 000"
              className="w-full bg-[#0a0a14] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-bold tabular-nums"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Papier, reliures, encre, électricité, etc.
            </p>
          </div>

          {/* Aperçu résultat net */}
          <div className="bg-[#0b0c18] border border-purple-500/30 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-purple-400" />
                Chiffre d'affaires brut :
              </span>
              <span className="font-bold text-white tabular-nums">{formatFC(result.turnover)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Dépenses d'exploitation :</span>
              <span className="font-bold text-rose-400 tabular-nums">- {formatFC(result.expenses)}</span>
            </div>
            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
              <span className="font-bold text-white">Résultat net (calcul serveur) :</span>
              <span
                className={`text-sm font-extrabold tabular-nums ${
                  result.netResult < 0 ? 'text-red-400' : 'text-[#10B981]'
                }`}
              >
                {formatFC(result.netResult)}
              </span>
            </div>
          </div>

          {/* Observations facultatives */}
          <div className={noActivity ? 'opacity-40 pointer-events-none' : ''}>
            <label className="block text-xs font-semibold text-slate-200 mb-1">
              Observations facultatives
            </label>
            <textarea
              rows={2}
              disabled={isLocked || noActivity || isSubmitting}
              value={notes}
              onChange={(e) => {
                const next = e.target.value;
                setNotes(next);
                setIsModified(true);
                persistDraft({ turnoverInput, expensesInput, notes: next, noActivity });
              }}
              placeholder="Ex: Réparation d'imprimante A3 effectuée l'après-midi..."
              className="w-full bg-[#0a0a14] border border-white/10 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 resize-none"
            />
          </div>

          {/* Bouton de sauvegarde */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isLocked || isSubmitting}
              className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-98 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-900/30 flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>
                {isSubmitting ? 'Enregistrement serveur...' : 'Enregistrer le module Bureautique'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
