import React, { useState, useEffect, useRef } from 'react';
import {
  Menu,
  Printer,
  Coffee,
  Package,
  Smartphone,
  Tag,
  Star,
  Phone,
  MapPin,
  ArrowRight,
  X,
  Sparkles,
  Layers,
  Receipt,
  MessageSquare,
} from 'lucide-react';
import { BillShopsLogo } from './BillShopsLogo';
import { dataService } from '../services/supabaseService';
import { DbEstablishmentSettings, DbPublicProduct, DbPublication } from '../types/database';
import { formatFC } from '../services/financialCalculations';

interface ScreenPublicProps {
  onSecretAccessTrigger: () => void;
}

export const ScreenPublic: React.FC<ScreenPublicProps> = ({ onSecretAccessTrigger }) => {
  const [settings, setSettings] = useState<DbEstablishmentSettings | null>(null);
  const [products, setProducts] = useState<DbPublicProduct[]>([]);
  const [publications, setPublications] = useState<DbPublication[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [showAllServicesModal, setShowAllServicesModal] = useState(false);
  const [showContactFeedback, setShowContactFeedback] = useState(false);
  const [isHamburgerOpen, setIsHamburgerOpen] = useState(false);

  // Détection du geste secret : 5 taps sur le logo dans les 3 secondes
  const tapTimesRef = useRef<number[]>([]);

  const handleLogoTap = () => {
    const now = Date.now();
    tapTimesRef.current = [...tapTimesRef.current.filter((t) => now - t <= 3000), now];

    if (tapTimesRef.current.length >= 5) {
      tapTimesRef.current = [];
      onSecretAccessTrigger();
    }
  };

  useEffect(() => {
    let active = true;
    setIsLoadingData(true);
    setLoadError(null);

    Promise.all([
      dataService.getSettings(),
      dataService.getPublicProducts(),
      dataService.getPublications(),
    ])
      .then(([loadedSettings, loadedProducts, loadedPublications]) => {
        if (!active) return;
        setSettings(loadedSettings);
        setProducts(loadedProducts);
        setPublications(loadedPublications);
      })
      .catch((err) => {
        if (!active) return;
        setLoadError(
          err instanceof Error
            ? err.message
            : 'Impossible de charger la vitrine depuis le serveur.'
        );
      })
      .finally(() => {
        if (active) setIsLoadingData(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const servicesSectionRef = useRef<HTMLDivElement>(null);
  const pricingSectionRef = useRef<HTMLDivElement>(null);
  const contactSectionRef = useRef<HTMLDivElement>(null);

  const scrollToSection = (section: 'services' | 'tarifs' | 'contact') => {
    setIsHamburgerOpen(false);
    if (section === 'services') {
      servicesSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else if (section === 'tarifs') {
      pricingSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else if (section === 'contact') {
      contactSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const servicesList = [
    {
      id: 'bureautique',
      name: 'Bureautique',
      desc: 'Impressions A4/A3 noir & blanc et couleur, reliure thermique et spirale, plastification.',
      bgColor: 'bg-[#E0F2FE]',
      iconColor: 'text-[#0284C7]',
      icon: Printer,
    },
    {
      id: 'boissons',
      name: 'Boissons',
      desc: 'Boissons fraîches, jus de fruits naturels, sodas et café chaud expresso.',
      bgColor: 'bg-[#FFEDD5]',
      iconColor: 'text-[#EA580C]',
      icon: Coffee,
    },
    {
      id: 'kongoterra',
      name: 'KongoTerra',
      desc: 'Produits locaux authentiques, café de terroir de la RDC, produits artisanaux sélectionnés.',
      bgColor: 'bg-[#DCFCE7]',
      iconColor: 'text-[#16A34A]',
      icon: Package,
    },
    {
      id: 'recharge',
      name: 'Recharge',
      desc: 'Recharge de crédit téléphonique et forfaits internet : Vodacom, Orange, Airtel, Africell.',
      bgColor: 'bg-[#E0F2FE]',
      iconColor: 'text-[#0284C7]',
      icon: Smartphone,
    },
  ];

  const handleWhatsAppClick = () => {
    setShowContactFeedback(true);
    setTimeout(() => setShowContactFeedback(false), 3500);
    const waNumber = (settings?.whatsapp_number || '+243971234567').replace(/[^0-9]/g, '');
    window.open(
      `https://wa.me/${waNumber}?text=Bonjour%20BillShops,%20je%20souhaite%20un%20renseignement`,
      '_blank'
    );
  };

  const promoPub = publications.find((p) => p.status === 'published' && p.category === 'promo');

  return (
    <div className="w-full bg-[#0B0B14] text-slate-900 flex flex-col justify-between min-h-screen relative overflow-x-hidden">
      {/* Top Header (Dark) */}
      <header className="px-4 pt-3 pb-3 flex items-center justify-between bg-[#0B0B14] max-w-[430px] mx-auto w-full">
        {/* Logo BillShops avec écouteur de 5 taps cachés (sans indice visuel) */}
        <div
          onClick={handleLogoTap}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleLogoTap();
          }}
          className="cursor-pointer select-none active:opacity-95"
        >
          <BillShopsLogo subtitle="Votre partenaire de confiance" />
        </div>

        {/* Menu Hamburger public */}
        <button
          onClick={() => setIsHamburgerOpen(true)}
          className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 transition flex items-center justify-center text-slate-200"
          aria-label="Menu"
        >
          <Menu className="w-6 h-6 stroke-[2.2]" />
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-[430px] mx-auto w-full">
        {/* Hero Section */}
        <div className="relative h-56 w-full overflow-hidden">
          <img
            src="/src/assets/images/desk_workspace_hero_1794061962186.jpg"
            alt="Bureau BillShops"
            className="w-full h-full object-cover object-center scale-105"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0B0B14]/80 via-[#0B0B14]/40 to-[#0B0B14]/90" />

          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 -mt-3">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight drop-shadow-md">
              {settings?.name || 'BillShops'}
            </h1>
            <p className="text-xs sm:text-sm font-medium text-white/90 drop-shadow mt-1">
              Bureautique • Services • KongoTerra
            </p>

            <div className="mt-3">
              <span className="bg-[#6D28D9] text-white text-[10.5px] font-semibold px-3.5 py-1.5 rounded-full shadow-lg shadow-purple-900/50 inline-flex items-center gap-1">
                Qualité, rapidité, proximité
              </span>
            </div>
          </div>
        </div>

        {/* White Overlapping Rounded Panel */}
        <div className="relative z-10 -mt-6 bg-white rounded-t-[30px] pt-6 pb-6 px-4 shadow-2xl">
          {/* Section: Nos Services */}
          <div ref={servicesSectionRef}>
            <div className="flex items-center justify-between mb-3.5">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Nos Services</h2>
              <button
                onClick={() => setShowAllServicesModal(true)}
                className="bg-[#6D28D9] hover:bg-[#5B21B6] active:scale-95 transition text-white text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1 shadow-sm"
              >
                <span>Voir tout</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 4 Pastel Square Tiles */}
            <div className="grid grid-cols-4 gap-2.5">
              {servicesList.map((srv) => {
                const IconComponent = srv.icon;
                return (
                  <button
                    key={srv.id}
                    onClick={() => setSelectedService(srv.name)}
                    className="flex flex-col items-center group text-center"
                  >
                    <div
                      className={`w-full aspect-square ${srv.bgColor} rounded-2xl flex items-center justify-center ${srv.iconColor} shadow-sm group-hover:scale-105 group-active:scale-95 transition duration-150`}
                    >
                      <IconComponent className="w-6 h-6 stroke-[2.2]" />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-800 mt-1.5 truncate w-full">
                      {srv.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section: Nos Tarifs (Dynamiques administrables depuis la base de données) */}
          <div ref={pricingSectionRef} className="mt-5">
            <div className="flex items-center gap-1.5 mb-2.5">
              <Tag className="w-4 h-4 text-purple-600 fill-purple-600/20" />
              <h3 className="text-sm font-bold text-slate-900">
                Nos Tarifs <span className="text-slate-500 font-normal text-xs">(catalogue officiel)</span>
              </h3>
            </div>

            <div className="rounded-xl overflow-hidden border border-slate-200/80 shadow-xs">
              {isLoadingData ? (
                <div className="px-3.5 py-3 text-xs text-slate-500 bg-white">
                  Chargement des tarifs...
                </div>
              ) : loadError ? (
                <div className="px-3.5 py-3 text-xs text-red-600 bg-red-50">
                  {loadError}
                </div>
              ) : products.length === 0 ? (
                <div className="px-3.5 py-3 text-xs text-slate-500 bg-white">
                  Aucun tarif publié pour le moment.
                </div>
              ) : (
                products.slice(0, 5).map((prod, idx) => (
                  <div
                    key={prod.id}
                    className={`flex items-center justify-between px-3.5 py-2.5 text-xs ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'
                    } ${idx > 0 ? 'border-t border-slate-100' : ''}`}
                  >
                    <span className="text-slate-800 font-medium">{prod.name}</span>
                    <span className="text-slate-900 font-bold tabular-nums">
                      {formatFC(prod.indicative_price)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Promotional Banner: Promotion du mois (Dynamique) */}
          <div className="mt-5 relative rounded-2xl bg-gradient-to-r from-[#5B21B6] via-[#7C3AED] to-[#9333EA] text-white p-4 shadow-lg shadow-purple-600/25 overflow-hidden flex items-center justify-between">
            <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none" />

            <div className="relative z-10 pr-2">
              <div className="flex items-center gap-1.5 text-amber-300">
                <Star className="w-3.5 h-3.5 fill-amber-300" />
                <span className="text-[11px] font-extrabold uppercase tracking-wider">
                  {promoPub?.title || 'Promotion du mois !'}
                </span>
              </div>
              <h4 className="text-xs font-medium text-white/95 mt-1 tracking-tight leading-relaxed max-w-[220px]">
                {promoPub?.description || 'Profitez de nos offres spéciales sur vos impressions.'}
              </h4>
            </div>

            <div className="relative z-10 w-14 h-14 shrink-0 rounded-xl overflow-hidden shadow-md shadow-purple-950/40">
              <img
                src={promoPub?.image_url || '/src/assets/images/gift_box_promo_1794061962055.jpg'}
                alt="Promotion"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>

          {/* Service Mobile Money Info */}
          <div className="mt-5 p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-500/15 text-sky-600 flex items-center justify-center">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-slate-800">Orange Money</p>
                <p className="text-[10px] text-slate-500">Dépôts et retraits sécurisés</p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-600">
              {settings?.mpesa_enabled ? 'M-Pesa actif' : 'M-Pesa : Bientôt'}
            </span>
          </div>

          {/* Section: Contactez-nous (Dynamique) */}
          <div ref={contactSectionRef} className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-900">Contactez-nous</h4>
              <div className="flex items-center gap-1.5 text-slate-700 text-xs">
                <Phone className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-medium tabular-nums">{settings?.phone || '+243 97 123 4567'}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>{settings?.city || 'Kinshasa, RDC'}</span>
              </div>
            </div>

            <button
              onClick={handleWhatsAppClick}
              className="bg-[#25D366] hover:bg-[#20BD5A] active:scale-95 transition text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-md shadow-green-500/20"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.456 5.711 1.457h.005c6.554 0 11.89-5.335 11.893-11.893a11.82 11.82 0 00-3.48-8.413z" />
              </svg>
              <span>WhatsApp</span>
            </button>
          </div>
        </div>
      </main>

      {/* Public Footer */}
      <footer className="bg-[#0B0B14] py-3.5 px-4 text-center border-t border-white/5">
        <p className="text-[11px] text-slate-400 font-normal">
          © {new Date().getFullYear()} {settings?.name || 'BillShops'}. {settings?.legal_name || 'Une solution Hol Corporation'}.
        </p>
      </footer>

      {/* Hamburger Drawer Public: UNIQUEMENT Services, Tarifs, Contact */}
      {isHamburgerOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex justify-end animate-in fade-in duration-150">
          <div className="w-64 max-w-[80%] h-full bg-[#111222] border-l border-white/10 p-5 flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-200">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Menu BillShops
                </span>
                <button
                  onClick={() => setIsHamburgerOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white"
                  aria-label="Fermer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <nav className="mt-5 space-y-2">
                <button
                  onClick={() => scrollToSection('services')}
                  className="w-full text-left py-3 px-3.5 rounded-xl bg-white/5 hover:bg-white/10 active:scale-98 transition flex items-center gap-3 text-slate-200 text-xs font-semibold"
                >
                  <Layers className="w-4 h-4 text-purple-400" />
                  <span>Nos Services</span>
                </button>

                <button
                  onClick={() => scrollToSection('tarifs')}
                  className="w-full text-left py-3 px-3.5 rounded-xl bg-white/5 hover:bg-white/10 active:scale-98 transition flex items-center gap-3 text-slate-200 text-xs font-semibold"
                >
                  <Receipt className="w-4 h-4 text-purple-400" />
                  <span>Nos Tarifs</span>
                </button>

                <button
                  onClick={() => scrollToSection('contact')}
                  className="w-full text-left py-3 px-3.5 rounded-xl bg-white/5 hover:bg-white/10 active:scale-98 transition flex items-center gap-3 text-slate-200 text-xs font-semibold"
                >
                  <MessageSquare className="w-4 h-4 text-purple-400" />
                  <span>Contact</span>
                </button>
              </nav>
            </div>

            <div className="pt-4 border-t border-white/5 text-center">
              <p className="text-[10px] text-slate-500">
                {settings?.address || 'Kinshasa, RDC'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Service Details Modal */}
      {selectedService && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 w-full max-w-sm rounded-2xl p-5 shadow-2xl space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Service : {selectedService}</h3>
              <button
                onClick={() => setSelectedService(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {servicesList.find((s) => s.name === selectedService)?.desc ||
                'Prestations de qualité au meilleur prix avec BillShops Kinshasa.'}
            </p>
            <div className="pt-2 flex gap-2">
              <button
                onClick={handleWhatsAppClick}
                className="flex-1 py-2 bg-[#25D366] text-white text-xs font-semibold rounded-xl"
              >
                Commander via WhatsApp
              </button>
              <button
                onClick={() => setSelectedService(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* All Services Modal */}
      {showAllServicesModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-3">
          <div className="bg-white text-slate-900 w-full max-w-md rounded-2xl p-5 shadow-2xl space-y-4 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Catalogue BillShops</h3>
                <p className="text-xs text-slate-500">Tous les services disponibles en agence</p>
              </div>
              <button
                onClick={() => setShowAllServicesModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {products.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">
                  {loadError || 'Aucun article dans le catalogue pour le moment.'}
                </p>
              ) : (
                products.map((prod) => (
                  <div
                    key={prod.id}
                    className="p-3 rounded-xl border border-slate-100 bg-slate-50/70 flex items-center justify-between"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{prod.name}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">{prod.category} • {prod.unit}</p>
                    </div>
                    <span className="font-extrabold text-purple-700 text-xs tabular-nums">
                      {formatFC(prod.indicative_price)}
                    </span>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setShowAllServicesModal(false)}
              className="w-full py-2.5 bg-purple-600 text-white text-xs font-semibold rounded-xl"
            >
              Fermer le catalogue
            </button>
          </div>
        </div>
      )}

      {/* WhatsApp Feedback Notice */}
      {showContactFeedback && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-green-700 text-white px-4 py-2 rounded-xl text-xs font-medium shadow-xl flex items-center gap-2 animate-fade-in">
          <Sparkles className="w-4 h-4" />
          <span>Ouverture de WhatsApp ({settings?.whatsapp_number || '+243 97 123 4567'})...</span>
        </div>
      )}
    </div>
  );
};
