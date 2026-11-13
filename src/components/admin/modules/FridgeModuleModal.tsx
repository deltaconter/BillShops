import React, { useState, useEffect, useRef } from 'react';
import { X, Coffee, Plus, Save, Tag, Calculator, AlertCircle, Ban } from 'lucide-react';
import { ProductSaleInput } from '../../../types/financial';
import { DbProductCategory } from '../../../types/database';
import {
  calculateProducts,
  formatFC,
  parseFC,
} from '../../../services/financialCalculations';
import {
  clearModuleDraft,
  getModuleDraft,
  saveModuleDraft,
} from '../../../services/draftService';

interface FridgeDraft {
  salesMap: Record<string, number>;
  noActivity: boolean;
}

interface FridgeModuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  establishmentId?: string;
  reportDate: string;
  categories: DbProductCategory[];
  initialSales: ProductSaleInput[];
  initialNoActivity?: boolean;
  onSaveSales: (sales: ProductSaleInput[], noActivity: boolean) => Promise<void>;
  onCreateCategory: (name: string) => Promise<DbProductCategory>;
  onToggleCategory: (categoryId: string, isActive: boolean) => Promise<DbProductCategory>;
  isLocked?: boolean;
}

export const FridgeModuleModal: React.FC<FridgeModuleModalProps> = ({
  isOpen,
  onClose,
  establishmentId,
  reportDate,
  categories,
  initialSales,
  initialNoActivity = false,
  onSaveSales,
  onCreateCategory,
  onToggleCategory,
  isLocked = false,
}) => {
  const [salesMap, setSalesMap] = useState<Record<string, number>>({});
  const [noActivity, setNoActivity] = useState(initialNoActivity);
  const [isManagingCategories, setIsManagingCategories] = useState(false);
  const [categoryList, setCategoryList] = useState<DbProductCategory[]>(categories);
  const [newCatName, setNewCatName] = useState('');
  const [hasDraftNotice, setHasDraftNotice] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCategorySaving, setIsCategorySaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastInitKeyRef = useRef<string | null>(null);

  useEffect(() => {
    setCategoryList(categories);
  }, [categories]);

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
    setIsCategorySaving(false);
    setIsManagingCategories(false);
    setCategoryList(categories);

    const draft = !isLocked
      ? getModuleDraft<FridgeDraft>(establishmentId, reportDate, 'fridge')
      : null;

    if (draft) {
      setSalesMap(draft.salesMap || {});
      setNoActivity(Boolean(draft.noActivity));
      setHasDraftNotice(true);
    } else {
      const map: Record<string, number> = {};
      initialSales.forEach((s) => {
        map[s.categoryId] = s.totalSales;
      });
      setSalesMap(map);
      setNoActivity(Boolean(initialNoActivity));
      setHasDraftNotice(false);
    }
  }, [isOpen, establishmentId, reportDate, isLocked, initialSales, initialNoActivity, categories]);

  if (!isOpen) return null;

  const activeCategories = categoryList.filter((c) => c.is_active);

  const formattedSales: ProductSaleInput[] = activeCategories.map((cat) => ({
    categoryId: cat.id,
    categoryName: cat.name,
    totalSales: noActivity ? 0 : salesMap[cat.id] || 0,
  }));

  const productResult = calculateProducts(formattedSales);

  const persistDraft = (nextSalesMap: Record<string, number>, nextNoActivity: boolean) => {
    if (isLocked) return;
    saveModuleDraft<FridgeDraft>(establishmentId, reportDate, 'fridge', {
      salesMap: nextSalesMap,
      noActivity: nextNoActivity,
    });
  };

  const resetToServerValues = () => {
    clearModuleDraft(establishmentId, reportDate, 'fridge');
    const map: Record<string, number> = {};
    initialSales.forEach((s) => {
      map[s.categoryId] = s.totalSales;
    });
    setSalesMap(map);
    setNoActivity(Boolean(initialNoActivity));
    setHasDraftNotice(false);
    setError(null);
  };

  const handleSaleChange = (catId: string, val: string) => {
    const amount = parseFC(val);
    const nextSalesMap = {
      ...salesMap,
      [catId]: amount,
    };
    setSalesMap(nextSalesMap);
    persistDraft(nextSalesMap, noActivity);
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim() || isCategorySaving) return;

    setError(null);
    setIsCategorySaving(true);
    try {
      const created = await onCreateCategory(newCatName.trim());
      setCategoryList((prev) => [...prev, created]);
      setNewCatName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible d’ajouter la catégorie.');
    } finally {
      setIsCategorySaving(false);
    }
  };

  const handleToggleCategory = async (cat: DbProductCategory) => {
    if (isCategorySaving) return;
    setError(null);
    setIsCategorySaving(true);
    try {
      const updatedCat = await onToggleCategory(cat.id, !cat.is_active);
      setCategoryList((prev) => prev.map((c) => (c.id === updatedCat.id ? updatedCat : c)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de modifier la catégorie.');
    } finally {
      setIsCategorySaving(false);
    }
  };

  const handleSave = async () => {
    if (isLocked || isSubmitting) return;
    if (!noActivity && activeCategories.length === 0) {
      setError(
        'Aucune catégorie active. Créez une catégorie ou cochez "Aucune vente aujourd\'hui".'
      );
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await onSaveSales(formattedSales, noActivity);
      clearModuleDraft(establishmentId, reportDate, 'fridge');
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
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-600/20 rounded-full blur-2xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#F59E0B] to-[#D97706] flex items-center justify-center text-white">
              <Coffee className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Frigos & KongoTerra</h2>
              <p className="text-[10px] text-slate-400">Boissons fraîches et produits du terroir</p>
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

        {/* Toggle Mode: Saisie des ventes vs Gestion des catégories */}
        <div className="flex items-center justify-between my-3 px-1">
          <span className="text-xs font-semibold text-slate-300">
            {isManagingCategories ? 'Gestion des catégories' : 'Saisie des ventes du jour'}
          </span>
          <button
            type="button"
            onClick={() => setIsManagingCategories(!isManagingCategories)}
            className="text-[11px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1"
          >
            <Tag className="w-3.5 h-3.5" />
            <span>{isManagingCategories ? 'Retour aux ventes' : 'Gérer catégories'}</span>
          </button>
        </div>

        {/* MODE 1: GESTION DES CATÉGORIES */}
        {isManagingCategories ? (
          <div className="space-y-3 flex-1 overflow-y-auto pr-1">
            <p className="text-[11px] text-slate-400">
              Activez ou désactivez les catégories sans affecter l'historique des anciennes journées.
            </p>

            <div className="space-y-1.5">
              {categoryList.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">
                  Aucune catégorie enregistrée.
                </p>
              ) : (
                categoryList.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#0e0f1d] border border-white/5 text-xs"
                  >
                    <span
                      className={cat.is_active ? 'text-white font-medium' : 'text-slate-500 line-through'}
                    >
                      {cat.name}
                    </span>
                    <button
                      type="button"
                      disabled={isCategorySaving}
                      onClick={() => handleToggleCategory(cat)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold disabled:opacity-50 ${
                        cat.is_active
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {cat.is_active ? 'Actif' : 'Désactivé'}
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Ajouter une catégorie */}
            <form onSubmit={handleAddCategory} className="pt-2 flex gap-2">
              <input
                type="text"
                disabled={isCategorySaving}
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Nouvelle catégorie (ex: Frigo 3)"
                className="flex-1 bg-[#0a0a14] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
              <button
                type="submit"
                disabled={isCategorySaving || !newCatName.trim()}
                className="px-3 py-2 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1 disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isCategorySaving ? '...' : 'Ajouter'}</span>
              </button>
            </form>
          </div>
        ) : (
          /* MODE 2: SAISIE DES VENTES DU JOUR */
          <div className="space-y-3 flex-1 overflow-y-auto pr-1">
            {!isLocked && (
              <label className="flex items-center justify-between bg-[#0e0f1d] border border-white/10 rounded-xl px-3 py-2 cursor-pointer">
                <div className="flex items-center gap-2 text-xs text-slate-200 font-medium">
                  <Ban className="w-4 h-4 text-slate-400" />
                  <span>Aucune vente Frigos / Produits aujourd'hui</span>
                </div>
                <input
                  type="checkbox"
                  checked={noActivity}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setNoActivity(next);
                    persistDraft(salesMap, next);
                  }}
                  className="accent-amber-600 w-4 h-4"
                />
              </label>
            )}

            <div className={`space-y-3 ${noActivity ? 'opacity-40 pointer-events-none' : ''}`}>
              {activeCategories.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">
                  Aucune catégorie active configurée. Cliquez sur « Gérer catégories » pour en ajouter.
                </div>
              ) : (
                activeCategories.map((cat) => (
                  <div key={cat.id}>
                    <label className="block text-xs font-semibold text-slate-200 mb-1">
                      {cat.name} (FC)
                    </label>
                    <input
                      type="text"
                      disabled={isLocked || noActivity || isSubmitting}
                      value={(salesMap[cat.id] ?? 0).toString()}
                      onChange={(e) => handleSaleChange(cat.id, e.target.value)}
                      placeholder="0"
                      className="w-full bg-[#0a0a14] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-bold tabular-nums"
                    />
                  </div>
                ))
              )}

              {/* Total général */}
              <div className="bg-[#0b0c18] border border-amber-500/30 rounded-2xl p-3.5 flex items-center justify-between text-xs mt-3">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <Calculator className="w-3.5 h-3.5 text-amber-400" />
                  Total des ventes frigos & produits :
                </span>
                <span className="text-sm font-extrabold text-amber-400 tabular-nums">
                  {formatFC(noActivity ? 0 : productResult.totalSales)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Validation */}
        {!isManagingCategories && (
          <div className="pt-3 border-t border-white/10">
            <button
              type="button"
              disabled={isLocked || isSubmitting}
              onClick={handleSave}
              className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 active:scale-98 text-white text-xs font-bold rounded-xl shadow-lg shadow-amber-950/40 flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>
                {isSubmitting ? 'Enregistrement serveur...' : 'Enregistrer les ventes Frigos'}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
