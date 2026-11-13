import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  ArrowLeft,
  Trash2,
  Star,
  Save,
  X,
  AlertCircle,
} from 'lucide-react';
import { DbPublication, DbPublicProduct } from '../../types/database';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/supabaseService';
import { formatFC, parseFC, getKinshasaTodayDateString } from '../../services/financialCalculations';

interface PublicationsViewProps {
  onBack: () => void;
}

export const PublicationsView: React.FC<PublicationsViewProps> = ({ onBack }) => {
  const { session } = useAuth();
  const establishmentId = session?.establishmentId;

  const [activeTab, setActiveTab] = useState<'pubs' | 'products'>('pubs');
  const [publications, setPublications] = useState<DbPublication[]>([]);
  const [products, setProducts] = useState<DbPublicProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isAddPubOpen, setIsAddPubOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Form states for new publication
  const [pubTitle, setPubTitle] = useState('');
  const [pubDesc, setPubDesc] = useState('');
  const [pubCategory, setPubCategory] = useState<'promo' | 'announcement' | 'service' | 'news'>('promo');
  const [pubPrice, setPubPrice] = useState('');

  // Form states for new product
  const [prodName, setProdName] = useState('');
  const [prodCategory, setProdCategory] = useState('Bureautique');
  const [prodPrice, setProdPrice] = useState('');
  const [prodUnit, setProdUnit] = useState('par page');

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  const loadAll = useCallback(async () => {
    if (!establishmentId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    try {
      const [loadedPubs, loadedProds] = await Promise.all([
        dataService.getPublications(establishmentId),
        dataService.getPublicProducts(establishmentId),
      ]);
      setPublications(loadedPubs);
      setProducts(loadedProds);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Impossible de charger les publications.');
    } finally {
      setIsLoading(false);
    }
  }, [establishmentId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleCreatePub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!establishmentId || !pubTitle.trim() || !pubDesc.trim() || isSubmitting) return;

    setModalError(null);
    setIsSubmitting(true);
    try {
      const created = await dataService.createPublication(establishmentId, {
        title: pubTitle.trim(),
        description: pubDesc.trim(),
        image_url: '/src/assets/images/gift_box_promo_1794061962055.jpg',
        category: pubCategory,
        price: pubPrice.trim() ? parseFC(pubPrice) : null,
        start_date: getKinshasaTodayDateString(),
        order_index: publications.length + 1,
      });

      setPublications((prev) => [created, ...prev]);
      setIsAddPubOpen(false);
      setPubTitle('');
      setPubDesc('');
      setPubPrice('');
      showNotice('Publication mise en ligne sur la vitrine publique !');
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Impossible de créer la publication.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePub = async (id: string) => {
    if (!establishmentId) return;
    setLoadError(null);
    try {
      await dataService.deletePublication(establishmentId, id);
      setPublications((prev) => prev.filter((p) => p.id !== id));
      showNotice('Publication retirée de la vitrine.');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Impossible de supprimer la publication.');
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!establishmentId || !prodName.trim() || isSubmitting) return;

    setModalError(null);
    setIsSubmitting(true);
    try {
      const created = await dataService.createPublicProduct(establishmentId, {
        name: prodName.trim(),
        description: null,
        category: prodCategory.trim() || 'Bureautique',
        indicative_price: parseFC(prodPrice),
        unit: prodUnit.trim() || 'unité',
        order_index: products.length + 1,
      });

      setProducts((prev) => [...prev, created]);
      setIsAddProductOpen(false);
      setProdName('');
      setProdPrice('');
      showNotice('Tarif ajouté au catalogue public !');
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Impossible d’ajouter le tarif.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!establishmentId) return;
    setLoadError(null);
    try {
      await dataService.deletePublicProduct(establishmentId, id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      showNotice('Tarif supprimé du catalogue.');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Impossible de supprimer le tarif.');
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
          <h2 className="text-base font-bold text-white">Publications & Tarifs</h2>
          <p className="text-[10px] text-slate-400">Administration de la vitrine publique</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setModalError(null);
            if (activeTab === 'pubs') setIsAddPubOpen(true);
            else setIsAddProductOpen(true);
          }}
          className="w-9 h-9 rounded-xl bg-purple-600 hover:bg-purple-700 flex items-center justify-center text-white shadow-md shadow-purple-900/40"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {notice && (
        <div className="bg-purple-950/80 border border-purple-500/40 px-3.5 py-2 rounded-xl text-xs text-purple-200">
          {notice}
        </div>
      )}

      {loadError && (
        <div
          role="alert"
          className="bg-red-950/70 border border-red-500/40 px-3.5 py-2.5 rounded-xl text-xs text-red-200 flex items-start justify-between gap-2"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{loadError}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadAll()}
            className="underline font-bold text-red-300 shrink-0"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Tabs Switcher */}
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#131424] rounded-2xl border border-white/5">
        <button
          type="button"
          onClick={() => setActiveTab('pubs')}
          className={`py-2 text-xs font-semibold rounded-xl transition ${
            activeTab === 'pubs' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400'
          }`}
        >
          Bannières & Promos ({publications.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('products')}
          className={`py-2 text-xs font-semibold rounded-xl transition ${
            activeTab === 'products' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400'
          }`}
        >
          Tarifs du catalogue ({products.length})
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-xs text-slate-400">
          Chargement depuis Supabase...
        </div>
      ) : (
        <>
          {/* TAB 1: BANNIÈRES ET PROMOS */}
          {activeTab === 'pubs' && (
            <div className="space-y-3">
              {publications.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-500">
                  Aucune publication enregistrée.
                </div>
              ) : (
                publications.map((pub) => (
                  <div
                    key={pub.id}
                    className="bg-[#131424] border border-white/5 rounded-2xl p-4 space-y-2 relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold">
                        <Star className="w-4 h-4 fill-amber-400" />
                        <span className="uppercase tracking-wider">{pub.title}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleDeletePub(pub.id)}
                        className="text-slate-500 hover:text-red-400 p-1"
                        aria-label="Supprimer la publication"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">{pub.description}</p>

                    <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[10px] text-slate-400">
                      <span className="bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-md font-semibold">
                        {pub.status === 'published' ? 'Visible en public' : pub.status}
                      </span>
                      <span>Publié le {pub.start_date}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: TARIFS DU CATALOGUE */}
          {activeTab === 'products' && (
            <div className="space-y-2">
              {products.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-500">
                  Aucun tarif enregistré dans le catalogue.
                </div>
              ) : (
                products.map((prod) => (
                  <div
                    key={prod.id}
                    className="bg-[#131424] border border-white/5 rounded-2xl p-3 flex items-center justify-between text-xs"
                  >
                    <div>
                      <h4 className="font-bold text-white">{prod.name}</h4>
                      <p className="text-[10px] text-slate-400">
                        {prod.category} • {prod.unit}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-extrabold text-[#10B981] tabular-nums">
                        {formatFC(prod.indicative_price)}
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleDeleteProduct(prod.id)}
                        className="text-slate-500 hover:text-red-400 p-1"
                        aria-label="Supprimer le tarif"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* Add Publication Modal */}
      {isAddPubOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-[#121324] border border-white/10 w-full max-w-sm rounded-3xl p-5 shadow-2xl text-white relative">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-bold text-white">Nouvelle publication vitrine</h3>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsAddPubOpen(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePub} className="space-y-3 pt-3">
              {modalError && (
                <div
                  role="alert"
                  className="bg-red-950/70 border border-red-500/40 rounded-xl p-2 text-xs text-red-200 flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">Titre</label>
                <input
                  type="text"
                  required
                  disabled={isSubmitting}
                  value={pubTitle}
                  onChange={(e) => setPubTitle(e.target.value)}
                  placeholder="Ex: Promotion du mois !"
                  className="w-full bg-[#0a0a14] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">Catégorie</label>
                <select
                  disabled={isSubmitting}
                  value={pubCategory}
                  onChange={(e) =>
                    setPubCategory(e.target.value as 'promo' | 'announcement' | 'service' | 'news')
                  }
                  className="w-full bg-[#0a0a14] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="promo">Promotion</option>
                  <option value="announcement">Annonce</option>
                  <option value="service">Service</option>
                  <option value="news">Actualité</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  Description
                </label>
                <textarea
                  required
                  rows={3}
                  disabled={isSubmitting}
                  value={pubDesc}
                  onChange={(e) => setPubDesc(e.target.value)}
                  placeholder="Ex: Impressions noir & blanc et couleur à prix réduit..."
                  className="w-full bg-[#0a0a14] border border-white/10 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  Prix promotionnel (FC, facultatif)
                </label>
                <input
                  type="text"
                  disabled={isSubmitting}
                  value={pubPrice}
                  onChange={(e) => setPubPrice(e.target.value)}
                  placeholder="Ex: 5 000"
                  className="w-full bg-[#0a0a14] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-bold"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 text-white text-xs font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition mt-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSubmitting ? 'Publication...' : 'Publier sur la vitrine'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {isAddProductOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-[#121324] border border-white/10 w-full max-w-sm rounded-3xl p-5 shadow-2xl text-white relative">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-bold text-white">Nouveau tarif au catalogue</h3>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsAddProductOpen(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-3 pt-3">
              {modalError && (
                <div
                  role="alert"
                  className="bg-red-950/70 border border-red-500/40 rounded-xl p-2 text-xs text-red-200 flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  Désignation
                </label>
                <input
                  type="text"
                  required
                  disabled={isSubmitting}
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  placeholder="Ex: Reliure spirale A4"
                  className="w-full bg-[#0a0a14] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  Catégorie
                </label>
                <input
                  type="text"
                  required
                  disabled={isSubmitting}
                  value={prodCategory}
                  onChange={(e) => setProdCategory(e.target.value)}
                  placeholder="Ex: Bureautique, Boissons..."
                  className="w-full bg-[#0a0a14] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  Prix indicatif (FC)
                </label>
                <input
                  type="text"
                  required
                  disabled={isSubmitting}
                  value={prodPrice}
                  onChange={(e) => setProdPrice(e.target.value)}
                  placeholder="Ex: 2 500"
                  className="w-full bg-[#0a0a14] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">Unité</label>
                <input
                  type="text"
                  disabled={isSubmitting}
                  value={prodUnit}
                  onChange={(e) => setProdUnit(e.target.value)}
                  placeholder="Ex: par document, par canette..."
                  className="w-full bg-[#0a0a14] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 text-white text-xs font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition mt-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSubmitting ? 'Enregistrement...' : 'Ajouter le tarif'}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
