import React, { useState, useEffect } from 'react';
import {
  Shield,
  Lock,
  LineChart,
  Calendar,
  CheckCircle,
  Layers,
  TrendingUp,
  Printer,
  BarChart3,
  Coffee,
  Smartphone,
  Info,
  Home,
  BarChart2,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { BillShopsLogo } from './BillShopsLogo';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../services/supabaseService';
import { formatFC, getKinshasaTodayDateString } from '../services/financialCalculations';

interface ScreenVisitorProps {
  onBackToAdmin?: () => void;
}

export const ScreenVisitor: React.FC<ScreenVisitorProps> = ({ onBackToAdmin }) => {
  const { logout, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'resume' | 'statistiques' | 'apropos'>('resume');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const todayString = getKinshasaTodayDateString();
  const [summary, setSummary] = useState<{
    report_date: string;
    day_status: string;
    office_turnover: number;
    telecom_sold_units: number;
    products_sold: number;
    money_commissions: number;
    total_revenue: number;
    growth_percentage: number;
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoadError(null);
    dataService
      .getVisitorSummary(todayString)
      .then((data) => {
        if (active && data) {
          setSummary(data as any);
        }
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof Error && err.name !== 'RpcAccessError') {
          setLoadError(err.message);
        }
      });
    return () => {
      active = false;
    };
  }, [todayString]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const totalRev = summary?.total_revenue || 1;
  const officePct = summary ? Math.round((summary.office_turnover / totalRev) * 100) : 0;
  const telecomPct = summary ? Math.round((summary.telecom_sold_units / totalRev) * 100) : 0;
  const productsPct = summary ? Math.round((summary.products_sold / totalRev) * 100) : 0;
  const moneyPct = summary ? Math.round((summary.money_commissions / totalRev) * 100) : 0;

  return (
    <div className="w-full bg-[#0B0B14] text-white flex flex-col justify-between min-h-screen relative overflow-x-hidden">
      {/* Scrollable Content */}
      <div className="flex-1 p-4 pb-24 space-y-4 max-w-[430px] mx-auto w-full">
        {/* Top Header */}
        <header className="flex items-center justify-between pt-1 pb-2">
          {/* Shield Icon Container */}
          <button
            onClick={() => {
              if (isAdmin && onBackToAdmin) {
                onBackToAdmin();
              } else {
                showToast('Accès Visiteur Spécial • Lecture seule');
              }
            }}
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-200 hover:bg-white/10 transition"
            title={isAdmin ? 'Retour au tableau de bord Admin' : 'Accès sécurisé'}
          >
            <Shield className="w-5 h-5 text-purple-400" />
          </button>

          {/* Logo BillShops + Accès Visiteur Spécial */}
          <BillShopsLogo subtitle="Accès Visiteur Spécial" />

          {/* Lock Icon : Déconnexion sécurisée */}
          <button
            onClick={() => {
              showToast('Verrouillage et déconnexion...');
              setTimeout(() => logout(), 400);
            }}
            className="w-10 h-10 rounded-xl bg-white/5 hover:bg-red-500/10 active:scale-95 transition flex items-center justify-center text-slate-300 hover:text-red-400"
            aria-label="Verrouiller et se déconnecter"
            title="Verrouiller et se déconnecter"
          >
            <Lock className="w-5 h-5" />
          </button>
        </header>

        {/* Erreur serveur le cas échéant */}
        {loadError && (
          <div className="bg-red-950/70 border border-red-500/30 text-red-200 px-3.5 py-2.5 rounded-xl text-xs">
            {loadError}
          </div>
        )}

        {/* Hero Card: Rapport Résumé */}
        <section className="rounded-2xl bg-[#131424] p-4 border border-white/5 shadow-xl shadow-black/40 flex items-center gap-4 relative overflow-hidden">
          <div className="absolute -top-6 -right-6 w-28 h-28 bg-purple-600/10 rounded-full blur-xl pointer-events-none" />

          <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#6366F1] to-[#A855F7] p-3 flex items-center justify-center text-white shadow-lg shadow-purple-900/40 shrink-0">
            <LineChart className="w-7 h-7 stroke-[2.2]" />
          </div>

          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">Rapport Résumé</h1>
            <p className="text-xs text-slate-400 font-normal mt-0.5">Vue consolidée en lecture seule</p>
          </div>
        </section>

        {/* 4 Mini-Cards 2x2 Grid */}
        <section className="grid grid-cols-2 gap-3">
          {/* Mini Card 1: Date */}
          <div className="bg-[#131424] rounded-2xl p-3.5 border border-white/5 shadow-md flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block font-normal leading-tight">
                Date
              </span>
              <span className="text-xs font-bold text-white tracking-tight mt-0.5 block">
                {summary?.report_date || todayString}
              </span>
            </div>
          </div>

          {/* Mini Card 2: Clôture */}
          <div className="bg-[#131424] rounded-2xl p-3.5 border border-white/5 shadow-md flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-[#10B981] flex items-center justify-center shrink-0">
              <CheckCircle className="w-5 h-5 fill-emerald-500/20" />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block font-normal leading-tight">
                Journée
              </span>
              <span className="text-xs font-bold text-white tracking-tight mt-0.5 block">
                {summary?.day_status === 'closed' ? 'Clôturée' : 'En cours'}
              </span>
            </div>
          </div>

          {/* Mini Card 3: Total Général */}
          <div className="bg-[#131424] rounded-2xl p-3.5 border border-white/5 shadow-md flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block font-normal leading-tight">
                Total Recettes
              </span>
              <span className="text-xs font-bold text-white tracking-tight mt-0.5 block tabular-nums">
                {formatFC(summary?.total_revenue || 0)}
              </span>
            </div>
          </div>

          {/* Mini Card 4: Croissance */}
          <div className="bg-[#131424] rounded-2xl p-3.5 border border-white/5 shadow-md flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block font-normal leading-tight">
                Tendance
              </span>
              <span className="text-xs font-bold text-emerald-400 tracking-tight mt-0.5 block tabular-nums">
                {(summary?.growth_percentage ?? 0) >= 0 ? '+' : ''}
                {summary?.growth_percentage ?? 0}%
              </span>
            </div>
          </div>
        </section>

        {/* Section: Par Activité (Données calculées en temps réel) */}
        <section className="pt-1">
          <h2 className="text-base font-bold text-white mb-2.5">Par Activité</h2>

          <div className="space-y-2">
            {/* Item 1: Bureautique */}
            <div className="bg-[#131424] rounded-2xl px-3.5 py-3 border border-white/5 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-300">
                  <Printer className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-slate-100">Bureautique</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-bold text-white tabular-nums">
                  {formatFC(summary?.office_turnover || 0)}
                </span>
                <span className="text-[10px] font-bold text-purple-400 bg-purple-950/70 border border-purple-800/40 px-2 py-0.5 rounded-md tabular-nums">
                  {officePct}%
                </span>
              </div>
            </div>

            {/* Item 2: Unités Téléphoniques */}
            <div className="bg-[#131424] rounded-2xl px-3.5 py-3 border border-white/5 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-300">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-slate-100">Unités Téléphoniques</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-bold text-white tabular-nums">
                  {formatFC(summary?.telecom_sold_units || 0)}
                </span>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/70 border border-emerald-800/40 px-2 py-0.5 rounded-md tabular-nums">
                  {telecomPct}%
                </span>
              </div>
            </div>

            {/* Item 3: Boissons & Produits */}
            <div className="bg-[#131424] rounded-2xl px-3.5 py-3 border border-white/5 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-300">
                  <Coffee className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-slate-100">Boissons & Produits</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-bold text-white tabular-nums">
                  {formatFC(summary?.products_sold || 0)}
                </span>
                <span className="text-[10px] font-bold text-amber-400 bg-amber-950/70 border border-amber-800/40 px-2 py-0.5 rounded-md tabular-nums">
                  {productsPct}%
                </span>
              </div>
            </div>

            {/* Item 4: Mobile Money (Commissions) */}
            <div className="bg-[#131424] rounded-2xl px-3.5 py-3 border border-white/5 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-300">
                  <Smartphone className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-slate-100">Mobile Money</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-bold text-white tabular-nums">
                  {formatFC(summary?.money_commissions || 0)}
                </span>
                <span className="text-[10px] font-bold text-sky-400 bg-sky-950/70 border border-sky-800/40 px-2 py-0.5 rounded-md tabular-nums">
                  {moneyPct}%
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Encadré violet: Accès en lecture seule */}
        <section className="rounded-2xl bg-[#18132d] border border-purple-500/30 p-3.5 flex items-start gap-3.5 shadow-lg shadow-purple-950/30">
          <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0 mt-0.5">
            <Info className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white">Accès en lecture seule</h3>
            <p className="text-[11px] text-purple-200/80 leading-relaxed mt-0.5">
              Vous consultez un résumé des données consolidées. Les détails d'opérations et dépenses confidentielles sont isolés.
            </p>
          </div>
        </section>
      </div>

      {/* Floating Action Notice Toast */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-purple-950/90 border border-purple-500/50 text-purple-200 px-4 py-2 rounded-xl text-xs font-medium shadow-2xl backdrop-blur-md flex items-center gap-2 animate-fade-in">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Fixed Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0d0e1c]/95 backdrop-blur-md border-t border-white/5 py-2 px-8">
        <div className="max-w-[430px] mx-auto flex items-center justify-around">
          <button
            onClick={() => setActiveTab('resume')}
            className={`flex flex-col items-center gap-1 transition ${
              activeTab === 'resume' ? 'text-[#A855F7]' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition ${
                activeTab === 'resume' ? 'bg-purple-500/15' : ''
              }`}
            >
              <Home className="w-5 h-5 stroke-[2.2]" />
            </div>
            <span className="text-[11px] font-semibold">Résumé</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('statistiques');
              showToast('Visualisation des tendances globales');
            }}
            className={`flex flex-col items-center gap-1 transition ${
              activeTab === 'statistiques' ? 'text-[#A855F7]' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition ${
                activeTab === 'statistiques' ? 'bg-purple-500/15' : ''
              }`}
            >
              <BarChart2 className="w-5 h-5 stroke-[2.2]" />
            </div>
            <span className="text-[11px] font-semibold">Statistiques</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('apropos');
              showToast('BillShops • Hol Corporation');
            }}
            className={`flex flex-col items-center gap-1 transition ${
              activeTab === 'apropos' ? 'text-[#A855F7]' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition ${
                activeTab === 'apropos' ? 'bg-purple-500/15' : ''
              }`}
            >
              <HelpCircle className="w-5 h-5 stroke-[2.2]" />
            </div>
            <span className="text-[11px] font-semibold">À propos</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
