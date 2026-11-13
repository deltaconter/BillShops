import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Printer,
  Unlock,
  ArrowLeft,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import { DailyReportSummary } from '../../types/financial';
import { DbEstablishmentSettings } from '../../types/database';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/supabaseService';
import { formatFC } from '../../services/financialCalculations';
import { exportReportToPdf } from '../../services/pdfExportService';
import { DayReopenModal } from './DayReopenModal';

interface HistoryViewProps {
  onBack: () => void;
  onSelectReport?: (dateString: string) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ onBack, onSelectReport }) => {
  const { session } = useAuth();
  const establishmentId = session?.establishmentId;

  const [reports, setReports] = useState<DailyReportSummary[]>([]);
  const [settings, setSettings] = useState<DbEstablishmentSettings | null>(null);
  const [filter, setFilter] = useState<'all' | 'closed' | 'in_progress'>('all');
  const [reopenTargetReport, setReopenTargetReport] = useState<DailyReportSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    if (!establishmentId) {
      setReports([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const [historyList, loadedSettings] = await Promise.all([
        dataService.getReportsHistory(establishmentId),
        dataService.getSettings(establishmentId),
      ]);
      setReports(historyList);
      setSettings(loadedSettings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger l’historique.');
    } finally {
      setIsLoading(false);
    }
  }, [establishmentId]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const filteredReports = reports.filter((r) => {
    if (filter === 'closed') return r.status === 'closed';
    if (filter === 'in_progress') return r.status === 'in_progress' || r.status === 'draft';
    return true;
  });

  const handleReopenConfirm = async (justification: string) => {
    if (!establishmentId || !reopenTargetReport?.id) {
      throw new Error('Identifiant de rapport manquant pour la réouverture.');
    }
    await dataService.reopenDay(
      establishmentId,
      reopenTargetReport.id,
      reopenTargetReport.reportDate,
      justification
    );
    await loadReports();
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
          <h2 className="text-base font-bold text-white">Historique & Rapports</h2>
          <p className="text-[10px] text-slate-400">Journal des journées et exportations</p>
        </div>
        <div className="w-9" />
      </div>

      {error && (
        <div
          role="alert"
          className="bg-red-950/70 border border-red-500/40 p-3 rounded-2xl flex items-start justify-between gap-2 text-xs text-red-200"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadReports()}
            className="underline font-bold text-red-300 shrink-0"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#131424] rounded-2xl border border-white/5">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`py-2 text-xs font-semibold rounded-xl transition ${
            filter === 'all' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400'
          }`}
        >
          Toutes ({reports.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('closed')}
          className={`py-2 text-xs font-semibold rounded-xl transition ${
            filter === 'closed' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400'
          }`}
        >
          Clôturées
        </button>
        <button
          type="button"
          onClick={() => setFilter('in_progress')}
          className={`py-2 text-xs font-semibold rounded-xl transition ${
            filter === 'in_progress' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400'
          }`}
        >
          En cours
        </button>
      </div>

      {/* List */}
      <div className="space-y-2.5">
        {isLoading ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            Chargement des rapports depuis Supabase...
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs">
            Aucun rapport trouvé pour ce filtre.
          </div>
        ) : (
          filteredReports.map((rep) => {
            const isClosed = rep.status === 'closed';
            const statusLabel =
              rep.status === 'closed'
                ? 'Clôturée'
                : rep.status === 'in_progress'
                  ? 'En cours'
                  : 'Non commencée';
            return (
              <div
                key={rep.id || rep.reportDate}
                className="bg-[#131424] border border-white/5 rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        isClosed
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-purple-500/15 text-purple-400'
                      }`}
                    >
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">{rep.reportDate}</h4>
                      <p className="text-[10px] text-slate-400">
                        {isClosed
                          ? 'Journée clôturée'
                          : rep.status === 'in_progress'
                            ? 'Journée en cours'
                            : 'Brouillon'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {rep.telecom.hasNegativeSoldUnits && (
                      <span
                        title="Anomalie : unités vendues négatives"
                        className="text-red-400 bg-red-500/15 border border-red-500/30 p-1 rounded-lg"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-lg border ${
                        isClosed
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                      }`}
                    >
                      {statusLabel}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-[#0b0c18] p-2.5 rounded-xl border border-white/5">
                  <div>
                    <span className="text-[10px] text-slate-400 block">
                      Recettes d'exploitation
                    </span>
                    <span className="font-extrabold text-[#10B981] tabular-nums">
                      {formatFC(rep.totalRevenue)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Bureautique net</span>
                    <span className="font-extrabold text-white tabular-nums">
                      {formatFC(rep.office.netResult)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => exportReportToPdf(rep, settings)}
                    className="flex-1 py-1.5 bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition"
                  >
                    <Printer className="w-3.5 h-3.5 text-purple-400" />
                    <span>Exporter PDF</span>
                  </button>

                  {isClosed ? (
                    <button
                      type="button"
                      onClick={() => setReopenTargetReport(rep)}
                      className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-semibold rounded-xl flex items-center gap-1 transition"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      <span>Rouvrir</span>
                    </button>
                  ) : (
                    onSelectReport && (
                      <button
                        type="button"
                        onClick={() => onSelectReport(rep.reportDate)}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl transition"
                      >
                        Éditer
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal de réouverture avec justification obligatoire */}
      {reopenTargetReport && (
        <DayReopenModal
          isOpen={true}
          dateString={reopenTargetReport.reportDate}
          onClose={() => setReopenTargetReport(null)}
          onConfirmReopen={handleReopenConfirm}
        />
      )}
    </div>
  );
};
