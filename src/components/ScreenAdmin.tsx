import React, { useState, useEffect, useCallback } from 'react';
import {
  Menu,
  Calendar,
  Printer,
  BarChart3,
  Coffee,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  LayoutGrid,
  Megaphone,
  Users,
  Settings,
  LogOut,
  Home,
  BarChart2,
  Layers,
  MoreHorizontal,
  Lock,
  Unlock,
  Sparkles,
} from 'lucide-react';
import { BillShopsLogo } from './BillShopsLogo';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../services/supabaseService';
import {
  DailyReportSummary,
  NetworkBalanceInput,
  TelecomNetwork,
} from '../types/financial';
import { DbProductCategory } from '../types/database';
import { formatFC, getKinshasaTodayDateString } from '../services/financialCalculations';
import { OfficeModuleModal } from './admin/modules/OfficeModuleModal';
import { UnitsModuleModal } from './admin/modules/UnitsModuleModal';
import { FridgeModuleModal } from './admin/modules/FridgeModuleModal';
import { MoneyModuleModal } from './admin/modules/MoneyModuleModal';
import { DayClosureModal } from './admin/DayClosureModal';
import { DayReopenModal } from './admin/DayReopenModal';
import { HistoryView } from './admin/HistoryView';
import { PublicationsView } from './admin/PublicationsView';
import { UsersManagementView } from './admin/UsersManagementView';
import { SettingsView } from './admin/SettingsView';

interface ScreenAdminProps {
  onNavigateToVisitor?: () => void;
}

type AdminSubView = 'dashboard' | 'history' | 'publications' | 'users' | 'settings';

export const ScreenAdmin: React.FC<ScreenAdminProps> = ({ onNavigateToVisitor }) => {
  const { logout, session } = useAuth();
  const establishmentId = session?.establishmentId;

  const [subView, setSubView] = useState<AdminSubView>('dashboard');
  const [activeBottomTab, setActiveBottomTab] = useState<
    'accueil' | 'rapports' | 'activites' | 'plus'
  >('accueil');

  const todayString = getKinshasaTodayDateString();
  const [currentDate, setCurrentDate] = useState<string>(todayString);
  const [report, setReport] = useState<DailyReportSummary | null>(null);
  const [categories, setCategories] = useState<DbProductCategory[]>([]);
  const [isLoadingReport, setIsLoadingReport] = useState(true);
  const [reportError, setReportError] = useState<string | null>(null);

  // Modales d'édition des 4 modules
  const [activeModal, setActiveModal] = useState<'office' | 'units' | 'fridge' | 'money' | null>(
    null
  );
  const [isClosureModalOpen, setIsClosureModalOpen] = useState(false);
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3500);
  };

  const loadReportData = useCallback(
    async (date: string) => {
      if (!establishmentId) {
        setIsLoadingReport(false);
        return;
      }

      setIsLoadingReport(true);
      setReportError(null);
      try {
        const [loadedReport, loadedCategories] = await Promise.all([
          dataService.getReport(establishmentId, date),
          dataService.getCategories(establishmentId),
        ]);
        setReport(loadedReport);
        setCategories(loadedCategories);
      } catch (err) {
        setReportError(
          err instanceof Error
            ? err.message
            : 'Impossible de charger les données du tableau de bord depuis Supabase.'
        );
      } finally {
        setIsLoadingReport(false);
      }
    },
    [establishmentId]
  );

  useEffect(() => {
    void loadReportData(currentDate);
  }, [currentDate, loadReportData]);

  // Navigation via la barre inférieure
  const handleBottomTabChange = (tab: 'accueil' | 'rapports' | 'activites' | 'plus') => {
    setActiveBottomTab(tab);
    if (tab === 'accueil') setSubView('dashboard');
    if (tab === 'rapports') setSubView('history');
    if (tab === 'activites') setSubView('dashboard');
    if (tab === 'plus') setSubView('settings');
  };

  const renderMainContent = () => {
    if (subView === 'history') {
      return (
        <HistoryView
          onBack={() => {
            setSubView('dashboard');
            setActiveBottomTab('accueil');
            void loadReportData(currentDate);
          }}
          onSelectReport={(date) => {
            setCurrentDate(date);
            setSubView('dashboard');
            setActiveBottomTab('accueil');
          }}
        />
      );
    }

    if (subView === 'publications') {
      return (
        <PublicationsView
          onBack={() => {
            setSubView('dashboard');
            setActiveBottomTab('accueil');
          }}
        />
      );
    }

    if (subView === 'users') {
      return (
        <UsersManagementView
          onBack={() => {
            setSubView('dashboard');
            setActiveBottomTab('accueil');
          }}
        />
      );
    }

    if (subView === 'settings') {
      return (
        <SettingsView
          onBack={() => {
            setSubView('dashboard');
            setActiveBottomTab('accueil');
          }}
        />
      );
    }

    if (isLoadingReport && !report) {
      return (
        <div className="bg-[#131424] border border-white/5 rounded-2xl p-6 text-center text-xs text-slate-300">
          Chargement des données confirmées depuis Supabase...
        </div>
      );
    }

    if (reportError && !report) {
      return (
        <div
          role="alert"
          className="bg-red-950/70 border border-red-500/40 rounded-2xl p-4 space-y-3 text-xs text-red-200"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{reportError}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadReportData(currentDate)}
            className="w-full py-2 bg-red-600/30 hover:bg-red-600/50 border border-red-500/40 rounded-xl font-bold text-white transition"
          >
            Réessayer le chargement
          </button>
        </div>
      );
    }

    if (!report) {
      return null;
    }

    const isClosed = report.status === 'closed';
    const dayStatusLabel =
      report.status === 'closed'
        ? 'Journée clôturée'
        : report.status === 'in_progress'
          ? 'Journée en cours'
          : 'Non commencée';

    // Calcul du taux de saisie réel : un module vide n'est JAMAIS validé automatiquement
    let completionCount = 0;
    if (report.office.hasSavedEntry || report.office.noActivity) completionCount++;
    if (report.telecom.hasSavedEntry || report.telecom.noActivity) completionCount++;
    if (report.products.hasSavedEntry || report.products.noActivity) completionCount++;
    if (report.money.hasSavedEntry || report.money.noActivity) completionCount++;
    const completionPercentage = Math.round((completionCount / 4) * 100);

    return (
      <>
        {reportError && (
          <div
            role="alert"
            className="bg-red-950/70 border border-red-500/40 rounded-2xl p-3 flex items-center justify-between gap-2 text-xs text-red-200"
          >
            <span>{reportError}</span>
            <button
              type="button"
              onClick={() => void loadReportData(currentDate)}
              className="underline font-bold text-red-300 shrink-0"
            >
              Actualiser
            </button>
          </div>
        )}

        {/* Welcome Card & Date Selector */}
        <section className="relative rounded-2xl bg-[#131424] p-4 border border-white/5 shadow-xl shadow-black/40 overflow-hidden">
          <div className="absolute -top-10 -right-10 w-36 h-36 bg-purple-600/15 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-1.5">
                  Bonjour {session?.username || 'Admin'} <span className="text-xl">👋</span>
                </h1>
                <p className="text-xs text-slate-400 mt-0.5 font-normal">
                  Tableau de bord de gestion commerciale
                </p>
              </div>

              {/* Bouton Clôture / Réouverture */}
              {isClosed ? (
                <button
                  type="button"
                  onClick={() => setIsReopenModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Rouvrir</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsClosureModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-purple-900/40 active:scale-95 transition"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Clôturer</span>
                </button>
              )}
            </div>

            {/* Date + Status Bar */}
            <div className="mt-3.5 bg-[#0e0f1d] rounded-xl px-3 py-2.5 flex items-center justify-between border border-white/5 gap-2">
              <label className="flex items-center gap-2 text-slate-200 cursor-pointer relative min-w-0">
                <Calendar className="w-4 h-4 text-purple-400 shrink-0" />
                <span className="text-xs font-medium tracking-tight truncate">
                  {new Date(`${report.reportDate}T12:00:00`).toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
                <input
                  type="date"
                  value={currentDate}
                  onChange={(e) => {
                    if (e.target.value) setCurrentDate(e.target.value);
                  }}
                  aria-label="Choisir une date de rapport"
                  className="absolute inset-0 opacity-0 cursor-pointer w-full"
                />
              </label>

              <span
                className={`text-[10.5px] font-semibold px-2.5 py-0.5 rounded-lg shadow-sm border shrink-0 ${
                  isClosed
                    ? 'bg-purple-950/70 text-purple-300 border-purple-500/30'
                    : report.status === 'in_progress'
                      ? 'bg-[#10B981] text-white border-emerald-400/30'
                      : 'bg-slate-800 text-slate-300 border-white/10'
                }`}
              >
                {dayStatusLabel}
              </span>
            </div>
          </div>
        </section>

        {/* Alerte critique si sold_units négatif détecté */}
        {report.telecom.hasNegativeSoldUnits && (
          <div
            role="alert"
            className="bg-red-950/75 border border-red-500/50 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-red-200"
          >
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-red-300">Anomalie détectée : Unités vendues négatives</p>
              <p className="text-[11px] text-red-200/85 mt-0.5">
                Total affiché : {formatFC(report.telecom.totalSoldUnits)}. Ouvrez le module Unités
                Téléphoniques pour vérifier les soldes et approvisionnements.
              </p>
            </div>
          </div>
        )}

        {/* Total Recettes d'exploitation Banner */}
        <div className="bg-gradient-to-r from-purple-900/40 to-indigo-950/40 border border-purple-500/30 rounded-2xl p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-purple-300 uppercase tracking-wider font-bold">
              Recettes totales d'exploitation
            </span>
            <p className="text-xl font-extrabold text-white tabular-nums tracking-tight mt-0.5">
              {formatFC(report.totalRevenue)}
            </p>
          </div>

          {report.telecom.hasNegativeSoldUnits ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-[11px] font-bold">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span>Anomalie unités</span>
            </div>
          ) : report.hasAnyDiscrepancy ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-bold">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Écart détecté</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold">
              <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
              <span>Équilibré</span>
            </div>
          )}
        </div>

        {/* 2x2 Gradient Metric Cards */}
        <section className="grid grid-cols-2 gap-3">
          {/* Card 1: Bureautique (Violet) */}
          <button
            type="button"
            onClick={() => setActiveModal('office')}
            className="w-full text-left rounded-2xl p-4 bg-gradient-to-br from-[#7C3AED] via-[#8B5CF6] to-[#6D28D9] shadow-lg shadow-purple-950/40 relative overflow-hidden active:scale-[0.98] transition group"
          >
            <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-white/10 rounded-full blur-md" />
            <div className="flex flex-col items-start">
              <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center mb-2.5 text-white">
                <Printer className="w-5 h-5 stroke-[2.2]" />
              </div>
              <span className="text-xs font-medium text-white/90">Bureautique</span>
              <span className="text-base font-extrabold text-white tracking-tight mt-0.5 tabular-nums">
                {formatFC(report.office.netResult)}
              </span>
              <span className="text-[10px] text-purple-200 mt-1 font-semibold">
                {report.office.noActivity
                  ? 'Aucune activité'
                  : `CA : ${formatFC(report.office.turnover)}`}
              </span>
            </div>
          </button>

          {/* Card 2: Unités Vendues (Vert) */}
          <button
            type="button"
            onClick={() => setActiveModal('units')}
            className="w-full text-left rounded-2xl p-4 bg-gradient-to-br from-[#10B981] via-[#059669] to-[#047857] shadow-lg shadow-emerald-950/40 relative overflow-hidden active:scale-[0.98] transition group"
          >
            <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-white/10 rounded-full blur-md" />
            <div className="flex flex-col items-start">
              <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center mb-2.5 text-white">
                <BarChart3 className="w-5 h-5 stroke-[2.2]" />
              </div>
              <span className="text-xs font-medium text-white/90">Unités Vendues</span>
              <span
                className={`text-base font-extrabold tracking-tight mt-0.5 tabular-nums ${
                  report.telecom.hasNegativeSoldUnits ? 'text-red-200' : 'text-white'
                }`}
              >
                {formatFC(report.telecom.totalSoldUnits)}
              </span>
              <span className="text-[10px] text-emerald-200 mt-1 font-semibold">
                {report.telecom.noActivity
                  ? 'Aucune opération'
                  : `Encaissé : ${formatFC(report.telecom.totalCashCollected)}`}
              </span>
            </div>
          </button>

          {/* Card 3: Boissons & KongoTerra (Orange) */}
          <button
            type="button"
            onClick={() => setActiveModal('fridge')}
            className="w-full text-left rounded-2xl p-4 bg-gradient-to-br from-[#F59E0B] via-[#EA580C] to-[#D97706] shadow-lg shadow-amber-950/40 relative overflow-hidden active:scale-[0.98] transition group"
          >
            <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-white/10 rounded-full blur-md" />
            <div className="flex flex-col items-start">
              <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center mb-2.5 text-white">
                <Coffee className="w-5 h-5 stroke-[2.2]" />
              </div>
              <span className="text-xs font-medium text-white/90">Boissons & Produits</span>
              <span className="text-base font-extrabold text-white tracking-tight mt-0.5 tabular-nums">
                {formatFC(report.products.totalSales)}
              </span>
              <span className="text-[10px] text-amber-200 mt-1 font-semibold">
                {report.products.noActivity ? 'Aucune vente' : 'Frigos & Terroir'}
              </span>
            </div>
          </button>

          {/* Card 4: Mobile Money (Bleu) */}
          <button
            type="button"
            onClick={() => setActiveModal('money')}
            className="w-full text-left rounded-2xl p-4 bg-gradient-to-br from-[#0284C7] via-[#0369A1] to-[#2563EB] shadow-lg shadow-sky-950/40 relative overflow-hidden active:scale-[0.98] transition group"
          >
            <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-white/10 rounded-full blur-md" />
            <div className="flex flex-col items-start">
              <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center mb-2.5 text-white">
                <Smartphone className="w-5 h-5 stroke-[2.2]" />
              </div>
              <span className="text-xs font-medium text-white/90">Mobile Money</span>
              <span className="text-base font-extrabold text-white tracking-tight mt-0.5 tabular-nums">
                {formatFC(report.money.totalEarnedCommissions)}
              </span>
              <span className="text-[10px] text-sky-200 mt-1 font-semibold">
                {report.money.noActivity ? 'Aucune opération' : 'Commissions conservées'}
              </span>
            </div>
          </button>
        </section>

        {/* Progression réelle de la journée */}
        <section className="rounded-2xl bg-[#131424] p-4 border border-white/5 shadow-md">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
            <span>Progression de saisie de la journée</span>
            <span className="tabular-nums font-bold text-slate-100">{completionPercentage}%</span>
          </div>

          <div className="w-full bg-[#1b1c2f] rounded-full h-2 my-2.5 overflow-hidden">
            <div
              className="bg-[#10B981] h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>

          <div className="flex items-center gap-2 mt-1">
            {completionPercentage === 100 ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-[#10B981] fill-[#10B981]/20 shrink-0" />
                <span className="text-xs font-normal text-slate-300">
                  Tous les 4 modules sont validés
                </span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs font-normal text-amber-200/90">
                  {4 - completionCount} module(s) en attente de validation
                </span>
              </>
            )}
          </div>
        </section>

        {/* Menu Principal Navigation Raccourcis */}
        <section className="pt-1">
          <h2 className="text-base font-bold text-white mb-3">Menu Principal</h2>

          <div className="grid grid-cols-3 gap-2.5">
            {/* Rapports */}
            <button
              type="button"
              onClick={() => {
                setSubView('history');
                setActiveBottomTab('rapports');
              }}
              className="bg-[#131424] hover:bg-[#1a1b32] active:scale-95 transition rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 border border-white/5 group"
            >
              <div className="w-9 h-9 rounded-lg bg-[#3B82F6]/15 text-[#3B82F6] flex items-center justify-center group-hover:scale-110 transition">
                <BarChart3 className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium text-slate-200">Rapports</span>
            </button>

            {/* Clôture */}
            <button
              type="button"
              onClick={() => setIsClosureModalOpen(true)}
              className="bg-[#131424] hover:bg-[#1a1b32] active:scale-95 transition rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 border border-white/5 group"
            >
              <div className="w-9 h-9 rounded-lg bg-[#10B981]/15 text-[#10B981] flex items-center justify-center group-hover:scale-110 transition">
                <LayoutGrid className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium text-slate-200">Clôture</span>
            </button>

            {/* Publications */}
            <button
              type="button"
              onClick={() => setSubView('publications')}
              className="bg-[#131424] hover:bg-[#1a1b32] active:scale-95 transition rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 border border-white/5 group"
            >
              <div className="w-9 h-9 rounded-lg bg-[#06B6D4]/15 text-[#06B6D4] flex items-center justify-center group-hover:scale-110 transition">
                <Megaphone className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium text-slate-200">Publications</span>
            </button>

            {/* Utilisateurs */}
            <button
              type="button"
              onClick={() => setSubView('users')}
              className="bg-[#131424] hover:bg-[#1a1b32] active:scale-95 transition rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 border border-white/5 group"
            >
              <div className="w-9 h-9 rounded-lg bg-[#8B5CF6]/15 text-[#8B5CF6] flex items-center justify-center group-hover:scale-110 transition">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium text-slate-200">Visiteurs</span>
            </button>

            {/* Paramètres */}
            <button
              type="button"
              onClick={() => {
                setSubView('settings');
                setActiveBottomTab('plus');
              }}
              className="bg-[#131424] hover:bg-[#1a1b32] active:scale-95 transition rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 border border-white/5 group"
            >
              <div className="w-9 h-9 rounded-lg bg-slate-500/15 text-slate-300 flex items-center justify-center group-hover:scale-110 transition">
                <Settings className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium text-slate-200">Paramètres</span>
            </button>

            {/* Déconnexion */}
            <button
              type="button"
              onClick={() => {
                showNotification('Déconnexion en cours...');
                setTimeout(() => void logout(), 300);
              }}
              className="bg-[#131424] hover:bg-[#1a1b32] active:scale-95 transition rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 border border-white/5 group"
            >
              <div className="w-9 h-9 rounded-lg bg-[#F97316]/15 text-[#F97316] flex items-center justify-center group-hover:scale-110 transition">
                <LogOut className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium text-slate-200">Déconnexion</span>
            </button>
          </div>
        </section>
      </>
    );
  };

  const initialTelecomBalances: Record<TelecomNetwork, NetworkBalanceInput> | null = report
    ? {
        orange: {
          id: report.telecom.networks.orange.id,
          network: 'orange',
          initialBalance: report.telecom.networks.orange.initialBalance,
          supplies: report.telecom.networks.orange.supplies,
          finalBalance: report.telecom.networks.orange.finalBalance,
          cashCollected: report.telecom.networks.orange.cashCollected,
          notes: report.telecom.networks.orange.notes,
          serverTotals: {
            totalSupplies: report.telecom.networks.orange.totalSupplies,
            soldUnits: report.telecom.networks.orange.soldUnits,
            discrepancy: report.telecom.networks.orange.discrepancy,
          },
        },
        airtel: {
          id: report.telecom.networks.airtel.id,
          network: 'airtel',
          initialBalance: report.telecom.networks.airtel.initialBalance,
          supplies: report.telecom.networks.airtel.supplies,
          finalBalance: report.telecom.networks.airtel.finalBalance,
          cashCollected: report.telecom.networks.airtel.cashCollected,
          notes: report.telecom.networks.airtel.notes,
          serverTotals: {
            totalSupplies: report.telecom.networks.airtel.totalSupplies,
            soldUnits: report.telecom.networks.airtel.soldUnits,
            discrepancy: report.telecom.networks.airtel.discrepancy,
          },
        },
        africell: {
          id: report.telecom.networks.africell.id,
          network: 'africell',
          initialBalance: report.telecom.networks.africell.initialBalance,
          supplies: report.telecom.networks.africell.supplies,
          finalBalance: report.telecom.networks.africell.finalBalance,
          cashCollected: report.telecom.networks.africell.cashCollected,
          notes: report.telecom.networks.africell.notes,
          serverTotals: {
            totalSupplies: report.telecom.networks.africell.totalSupplies,
            soldUnits: report.telecom.networks.africell.soldUnits,
            discrepancy: report.telecom.networks.africell.discrepancy,
          },
        },
        vodacom: {
          id: report.telecom.networks.vodacom.id,
          network: 'vodacom',
          initialBalance: report.telecom.networks.vodacom.initialBalance,
          supplies: report.telecom.networks.vodacom.supplies,
          finalBalance: report.telecom.networks.vodacom.finalBalance,
          cashCollected: report.telecom.networks.vodacom.cashCollected,
          notes: report.telecom.networks.vodacom.notes,
          serverTotals: {
            totalSupplies: report.telecom.networks.vodacom.totalSupplies,
            soldUnits: report.telecom.networks.vodacom.soldUnits,
            discrepancy: report.telecom.networks.vodacom.discrepancy,
          },
        },
      }
    : null;

  const isClosed = report?.status === 'closed';

  return (
    <div className="w-full bg-[#0B0B14] text-white flex flex-col justify-between min-h-screen relative overflow-x-hidden">
      {/* Scrollable Container */}
      <div className="flex-1 p-4 pb-24 space-y-4 max-w-[430px] mx-auto w-full">
        {/* Top Header */}
        <header className="flex items-center justify-between pt-1 pb-2">
          <button
            type="button"
            onClick={() => {
              if (subView !== 'dashboard') {
                setSubView('dashboard');
                setActiveBottomTab('accueil');
              } else {
                setSubView('publications');
              }
            }}
            className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 transition flex items-center justify-center text-slate-200"
            aria-label="Menu"
          >
            <Menu className="w-6 h-6 stroke-[2.2]" />
          </button>

          <BillShopsLogo subtitle="Hol Corporation" />

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                if (onNavigateToVisitor) onNavigateToVisitor();
                else showNotification('Connecté en tant qu’Administrateur');
              }}
              className="w-10 h-10 rounded-full overflow-hidden border border-purple-500/30 ring-2 ring-purple-600/20 active:scale-95 transition"
              title="Basculer vers la vue Visiteur Spécial"
            >
              <img
                src="/src/assets/images/admin_avatar_1794061961889.jpg"
                alt="Avatar Admin"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </button>
            <span
              className="absolute bottom-0 right-0 w-3 h-3 bg-[#10B981] border-2 border-[#0B0B14] rounded-full"
              title="En ligne"
            />
          </div>
        </header>

        {renderMainContent()}
      </div>

      {/* Floating Action Notice Toast */}
      {actionNotice && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-purple-950/90 border border-purple-500/50 text-purple-200 px-4 py-2 rounded-xl text-xs font-medium shadow-2xl backdrop-blur-md flex items-center gap-2 animate-fade-in">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* MODALES DES 4 MODULES (uniquement quand le rapport serveur est chargé) */}
      {report && establishmentId && (
        <>
          <OfficeModuleModal
            isOpen={activeModal === 'office'}
            onClose={() => setActiveModal(null)}
            establishmentId={establishmentId}
            reportDate={currentDate}
            isLocked={isClosed}
            initialNoActivity={Boolean(report.office.noActivity)}
            initialData={{
              turnover: report.office.turnover,
              expenses: report.office.expenses,
              notes: report.office.notes,
              serverNetResult: report.office.netResult,
            }}
            onSave={async (data) => {
              const updated = await dataService.saveOfficeReport(establishmentId, currentDate, data);
              setReport(updated);
              showNotification('Module Bureautique confirmé et enregistré.');
            }}
          />

          {initialTelecomBalances && (
            <UnitsModuleModal
              isOpen={activeModal === 'units'}
              onClose={() => setActiveModal(null)}
              establishmentId={establishmentId}
              reportDate={currentDate}
              isLocked={isClosed}
              initialNoActivity={Boolean(report.telecom.noActivity)}
              initialBalances={initialTelecomBalances}
              onSave={async (balances, noActivity) => {
                const updated = await dataService.saveTelecomModule(
                  establishmentId,
                  currentDate,
                  balances,
                  noActivity
                );
                setReport(updated);
                showNotification('Unités téléphoniques confirmées et enregistrées.');
              }}
            />
          )}

          <FridgeModuleModal
            isOpen={activeModal === 'fridge'}
            onClose={() => setActiveModal(null)}
            establishmentId={establishmentId}
            reportDate={currentDate}
            isLocked={isClosed}
            categories={categories}
            initialSales={report.products.sales}
            initialNoActivity={Boolean(report.products.noActivity)}
            onCreateCategory={async (name) => {
              const created = await dataService.createCategory(
                establishmentId,
                name,
                categories.length + 1
              );
              setCategories((prev) => [...prev, created]);
              return created;
            }}
            onToggleCategory={async (categoryId, isActive) => {
              const updatedCat = await dataService.toggleCategoryActive(
                establishmentId,
                categoryId,
                isActive
              );
              setCategories((prev) =>
                prev.map((c) => (c.id === updatedCat.id ? updatedCat : c))
              );
              return updatedCat;
            }}
            onSaveSales={async (sales, noActivity) => {
              const updated = await dataService.saveProductSales(
                establishmentId,
                currentDate,
                sales,
                noActivity
              );
              setReport(updated);
              showNotification('Ventes Frigos & Produits enregistrées.');
            }}
          />

          <MoneyModuleModal
            isOpen={activeModal === 'money'}
            onClose={() => setActiveModal(null)}
            establishmentId={establishmentId}
            reportDate={currentDate}
            isLocked={isClosed}
            initialNoActivity={Boolean(report.money.noActivity)}
            accounts={report.money.accounts.map((acc) => ({
              reportId: acc.reportId,
              accountId: acc.accountId,
              serviceId: acc.serviceId,
              serviceName: acc.serviceName,
              accountLabel: acc.accountLabel,
              initialEBalance: acc.initialEBalance,
              finalEBalance: acc.finalEBalance,
              initialCash: acc.initialCash,
              finalCash: acc.finalCash,
              totalDeposits: acc.totalDeposits,
              totalWithdrawals: acc.totalWithdrawals,
              commissionsReceived: acc.commissionsReceived,
              earnedCommissions: acc.earnedCommissions,
              movements: acc.movements,
              notes: acc.notes,
              hasSavedReport: acc.hasSavedReport,
              serverCalculated: {
                theoreticalEBalance: acc.theoreticalEBalance,
                eBalanceDiscrepancy: acc.eBalanceDiscrepancy,
                theoreticalCash: acc.theoreticalCash,
                cashDiscrepancy: acc.cashDiscrepancy,
              },
            }))}
            onSave={async (accs, noActivity) => {
              const updated = await dataService.saveMoneyModule(
                establishmentId,
                currentDate,
                accs,
                noActivity
              );
              setReport(updated);
              showNotification('Comptes Mobile Money confirmés et enregistrés.');
            }}
          />

          <DayClosureModal
            isOpen={isClosureModalOpen}
            onClose={() => setIsClosureModalOpen(false)}
            report={report}
            onConfirmClose={async (justification) => {
              const closedReport = await dataService.closeDay(
                establishmentId,
                report.reportDate,
                report.id,
                justification
              );
              setReport(closedReport);
              showNotification('Journée clôturée et verrouillée avec succès.');
            }}
          />

          <DayReopenModal
            isOpen={isReopenModalOpen}
            onClose={() => setIsReopenModalOpen(false)}
            dateString={report.reportDate}
            onConfirmReopen={async (justification) => {
              if (!report.id) {
                throw new Error('Identifiant de rapport manquant pour la réouverture.');
              }
              const reopenedReport = await dataService.reopenDay(
                establishmentId,
                report.id,
                report.reportDate,
                justification
              );
              setReport(reopenedReport);
              showNotification('Journée réouverte avec succès.');
            }}
          />
        </>
      )}

      {/* Fixed Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0d0e1c]/95 backdrop-blur-md border-t border-white/5 py-2 px-6">
        <div className="max-w-[430px] mx-auto flex items-center justify-around">
          <button
            type="button"
            onClick={() => handleBottomTabChange('accueil')}
            className={`flex flex-col items-center gap-1 transition ${
              activeBottomTab === 'accueil'
                ? 'text-[#A855F7]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition ${
                activeBottomTab === 'accueil' ? 'bg-purple-500/15' : ''
              }`}
            >
              <Home className="w-5 h-5 stroke-[2.2]" />
            </div>
            <span className="text-[11px] font-semibold">Accueil</span>
          </button>

          <button
            type="button"
            onClick={() => handleBottomTabChange('rapports')}
            className={`flex flex-col items-center gap-1 transition ${
              activeBottomTab === 'rapports'
                ? 'text-[#A855F7]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition ${
                activeBottomTab === 'rapports' ? 'bg-purple-500/15' : ''
              }`}
            >
              <BarChart2 className="w-5 h-5 stroke-[2.2]" />
            </div>
            <span className="text-[11px] font-semibold">Rapports</span>
          </button>

          <button
            type="button"
            onClick={() => {
              handleBottomTabChange('activites');
              if (report) setActiveModal('office');
            }}
            className={`flex flex-col items-center gap-1 transition ${
              activeBottomTab === 'activites'
                ? 'text-[#A855F7]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition ${
                activeBottomTab === 'activites' ? 'bg-purple-500/15' : ''
              }`}
            >
              <Layers className="w-5 h-5 stroke-[2.2]" />
            </div>
            <span className="text-[11px] font-semibold">Activités</span>
          </button>

          <button
            type="button"
            onClick={() => handleBottomTabChange('plus')}
            className={`flex flex-col items-center gap-1 transition ${
              activeBottomTab === 'plus' ? 'text-[#A855F7]' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition ${
                activeBottomTab === 'plus' ? 'bg-purple-500/15' : ''
              }`}
            >
              <MoreHorizontal className="w-5 h-5 stroke-[2.2]" />
            </div>
            <span className="text-[11px] font-semibold">Plus</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
