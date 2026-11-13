import React, { useState, useEffect } from 'react';
import {
  X,
  Lock,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Calendar,
  FileCheck,
} from 'lucide-react';
import { DailyReportSummary } from '../../types/financial';
import { formatFC } from '../../services/financialCalculations';

interface DayClosureModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: DailyReportSummary;
  onConfirmClose: (justification?: string) => Promise<void>;
}

export const DayClosureModal: React.FC<DayClosureModalProps> = ({
  isOpen,
  onClose,
  report,
  onConfirmClose,
}) => {
  const [justification, setJustification] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setJustification('');
    setIsSubmitting(false);
    setError(null);
  }, [isOpen, report.reportDate]);

  if (!isOpen) return null;

  const hasDiscrepancy = report.hasAnyDiscrepancy;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (hasDiscrepancy && !justification.trim()) {
      setError('Une justification écrite est obligatoire lorsqu’un écart ou une anomalie existe.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await onConfirmClose(justification.trim() || undefined);
      onClose();
    } catch (err) {
      // Afficher tel quel le message d'erreur renvoyé par le serveur (en français)
      setError(err instanceof Error ? err.message : 'Erreur lors de la clôture de la journée.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 animate-in fade-in duration-200">
      <div className="bg-[#121324] border border-white/10 w-full max-w-sm rounded-3xl p-5 shadow-2xl text-white relative overflow-hidden flex flex-col max-h-[92vh]">
        {/* Glow */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-600/20 rounded-full blur-2xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Clôture de la journée</h2>
              <p className="text-[10px] text-slate-400">Vérification et verrouillage comptable</p>
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

        {/* Body */}
        <form onSubmit={handleSubmit} className="space-y-3.5 pt-3 flex-1 overflow-y-auto pr-1">
          {error && (
            <div
              role="alert"
              className="bg-red-950/75 border border-red-500/40 rounded-xl p-2.5 text-xs text-red-200 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Date info */}
          <div className="bg-[#0b0c18] rounded-xl p-3 border border-white/5 flex items-center justify-between text-xs">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-purple-400" />
              Date de la journée :
            </span>
            <span className="font-bold text-white">{report.reportDate}</span>
          </div>

          {/* Synthèse des 4 modules */}
          <div className="space-y-2 text-xs bg-[#0b0c18] p-3 rounded-2xl border border-white/5">
            <h3 className="font-bold text-slate-300 text-[11px] uppercase tracking-wider">
              Récapitulatif des 4 modules
            </h3>

            <div className="flex justify-between text-slate-300">
              <span>Bureautique (Net) :</span>
              <span className="font-bold text-white tabular-nums">
                {report.office.noActivity ? 'Aucune activité' : formatFC(report.office.netResult)}
              </span>
            </div>

            <div className="flex justify-between text-slate-300">
              <span>Unités télécoms vendues :</span>
              <span
                className={`font-bold tabular-nums ${
                  report.telecom.hasNegativeSoldUnits ? 'text-red-400' : 'text-white'
                }`}
              >
                {report.telecom.noActivity
                  ? 'Aucune opération'
                  : formatFC(report.telecom.totalSoldUnits)}
              </span>
            </div>

            <div className="flex justify-between text-slate-300">
              <span>Boissons & Produits :</span>
              <span className="font-bold text-white tabular-nums">
                {report.products.noActivity ? 'Aucune vente' : formatFC(report.products.totalSales)}
              </span>
            </div>

            <div className="flex justify-between text-slate-300">
              <span>Mobile Money (Commissions) :</span>
              <span className="font-bold text-white tabular-nums">
                {report.money.noActivity
                  ? 'Aucune opération'
                  : formatFC(report.money.totalEarnedCommissions)}
              </span>
            </div>

            <div className="pt-2 border-t border-white/10 flex justify-between font-bold text-sm">
              <span className="text-white">Total Recettes d'exploitation :</span>
              <span className="text-emerald-400 tabular-nums">
                {formatFC(report.totalRevenue)}
              </span>
            </div>
          </div>

          {!report.isFullyEntered && (
            <div className="bg-amber-950/40 border border-amber-500/30 p-2.5 rounded-xl flex items-start gap-2 text-[11px] text-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                Tous les modules ne sont pas encore validés (saisie ou « Aucune activité »). Le serveur vérifiera la complétude avant clôture.
              </span>
            </div>
          )}

          {/* État d'équilibrage & Alertes */}
          {hasDiscrepancy ? (
            <div className="bg-amber-950/60 border border-amber-500/40 p-3 rounded-2xl space-y-2 text-xs">
              <div className="flex items-center gap-2 text-amber-300 font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  {report.telecom.hasNegativeSoldUnits
                    ? 'Anomalie (unités vendues négatives) ou écarts détectés !'
                    : 'Des écarts de caisse ou de solde ont été détectés !'}
                </span>
              </div>
              <p className="text-[11px] text-amber-200/80 leading-relaxed">
                Une justification écrite est <strong>obligatoire</strong> pour autoriser la clôture
                de cette journée.
              </p>

              <div>
                <label className="block text-[11px] font-semibold text-amber-200 mb-1">
                  Motif / Justification de l'écart (obligatoire) :
                </label>
                <textarea
                  required
                  rows={3}
                  disabled={isSubmitting}
                  value={justification}
                  onChange={(e) => {
                    setJustification(e.target.value);
                    setError(null);
                  }}
                  placeholder="Expliquez la cause de la différence constatée..."
                  className="w-full bg-[#0a0a14] border border-amber-500/40 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>
          ) : (
            <div className="bg-emerald-950/40 border border-emerald-500/30 p-3 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-300">
              <CheckCircle2 className="w-5 h-5 text-[#10B981] shrink-0" />
              <div>
                <p className="font-bold">Tous les modules sont équilibrés</p>
                <p className="text-[10px] text-emerald-400/80">
                  Aucun déficit ni surplus détecté.
                </p>
              </div>
            </div>
          )}

          <p className="text-[10px] text-slate-400 text-center">
            Après confirmation serveur, la journée sera verrouillée. Seul l'administrateur pourra la
            rouvrir avec une justification.
          </p>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting || (hasDiscrepancy && !justification.trim())}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-98 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-900/40 flex items-center justify-center gap-2 transition disabled:opacity-40"
          >
            <Lock className="w-4 h-4" />
            <span>
              {isSubmitting ? 'Clôture serveur en cours...' : 'Confirmer et verrouiller la journée'}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
};
