/**
 * Service de stockage local — STRICTEMENT réservé au mode développement explicite (VITE_DEV_LOCAL=true).
 * Ne s'exécute jamais et ne s'initialise jamais en production ni en mode Supabase normal.
 */

import { isDevLocalMode } from '../config/supabaseClient';
import {
  DbEstablishmentSettings,
  DbProductCategory,
  DbPublication,
  DbPublicProduct,
  DbAuditLog,
} from '../types/database';
import {
  DailyReportSummary,
  TelecomNetwork,
  OfficeCalculationInput,
  NetworkBalanceInput,
  ProductSaleInput,
  MoneyAccountInput,
} from '../types/financial';
import { SpecialVisitorAccount } from '../types/auth';
import { calculateDailyReportSummary, getKinshasaTodayDateString } from './financialCalculations';

const STORAGE_PREFIX = 'billshops_';
const KEY_SETTINGS = `${STORAGE_PREFIX}establishment_settings`;
const KEY_CATEGORIES = `${STORAGE_PREFIX}product_categories`;
const KEY_PUBLICATIONS = `${STORAGE_PREFIX}publications`;
const KEY_PUBLIC_PRODUCTS = `${STORAGE_PREFIX}public_products`;
const KEY_VISITORS = `${STORAGE_PREFIX}special_visitors`;
const KEY_REPORTS = `${STORAGE_PREFIX}daily_reports_map`;
const KEY_AUDIT_LOGS = `${STORAGE_PREFIX}audit_logs`;

export const DEFAULT_ESTABLISHMENT: DbEstablishmentSettings = {
  id: 'est_settings_dev_01',
  establishment_id: 'est_kinshasa_01',
  name: 'BillShops',
  legal_name: 'BillShops SARL - Hol Corporation',
  currency: 'FC',
  phone: '+243 97 123 4567',
  whatsapp_number: '+243971234567',
  email: 'contact@billshops.cd',
  address: 'Avenue de la Paix, Gombe',
  city: 'Kinshasa, RDC',
  mpesa_enabled: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const DEFAULT_PRODUCT_CATEGORIES: DbProductCategory[] = [
  {
    id: 'cat_frigo_1',
    establishment_id: DEFAULT_ESTABLISHMENT.establishment_id,
    name: 'Frigo 1 — Sodas & Boissons gazeuses',
    is_active: true,
    order_index: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'cat_frigo_2',
    establishment_id: DEFAULT_ESTABLISHMENT.establishment_id,
    name: 'Frigo 2 — Eaux minérales & Jus naturels',
    is_active: true,
    order_index: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'cat_kongoterra',
    establishment_id: DEFAULT_ESTABLISHMENT.establishment_id,
    name: 'Produits KongoTerra (Café & Terroir RDC)',
    is_active: true,
    order_index: 3,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const DEFAULT_PUBLIC_PRODUCTS: DbPublicProduct[] = [];
export const DEFAULT_PUBLICATIONS: DbPublication[] = [];
export const DEFAULT_SPECIAL_VISITORS: SpecialVisitorAccount[] = [];

export function getEmptyDayInputs(): {
  office: OfficeCalculationInput;
  telecom: Record<TelecomNetwork, NetworkBalanceInput>;
  products: ProductSaleInput[];
  money: MoneyAccountInput[];
} {
  return {
    office: {
      turnover: 0,
      expenses: 0,
    },
    telecom: {
      orange: { network: 'orange', initialBalance: 0, supplies: [], finalBalance: 0, cashCollected: 0 },
      airtel: { network: 'airtel', initialBalance: 0, supplies: [], finalBalance: 0, cashCollected: 0 },
      africell: { network: 'africell', initialBalance: 0, supplies: [], finalBalance: 0, cashCollected: 0 },
      vodacom: { network: 'vodacom', initialBalance: 0, supplies: [], finalBalance: 0, cashCollected: 0 },
    },
    products: [],
    money: [],
  };
}

class StorageService {
  private assertDevLocal(): boolean {
    return isDevLocalMode;
  }

  initStorage() {
    if (!this.assertDevLocal()) return;
    try {
      if (!localStorage.getItem(KEY_SETTINGS)) {
        localStorage.setItem(KEY_SETTINGS, JSON.stringify(DEFAULT_ESTABLISHMENT));
      }
      if (!localStorage.getItem(KEY_CATEGORIES)) {
        localStorage.setItem(KEY_CATEGORIES, JSON.stringify(DEFAULT_PRODUCT_CATEGORIES));
      }
      if (!localStorage.getItem(KEY_REPORTS)) {
        const today = getKinshasaTodayDateString();
        const empty = getEmptyDayInputs();
        const report = calculateDailyReportSummary({
          id: `dev_${today}`,
          establishmentId: DEFAULT_ESTABLISHMENT.establishment_id,
          reportDate: today,
          status: 'draft',
          office: empty.office,
          telecomBalances: empty.telecom,
          productSales: empty.products,
          moneyAccounts: empty.money,
        });
        localStorage.setItem(KEY_REPORTS, JSON.stringify({ [today]: report }));
      }
    } catch {
      // Ignorer
    }
  }

  getSettings(): DbEstablishmentSettings {
    if (!this.assertDevLocal()) return DEFAULT_ESTABLISHMENT;
    try {
      const data = localStorage.getItem(KEY_SETTINGS);
      return data ? JSON.parse(data) : DEFAULT_ESTABLISHMENT;
    } catch {
      return DEFAULT_ESTABLISHMENT;
    }
  }

  saveSettings(settings: DbEstablishmentSettings) {
    if (!this.assertDevLocal()) return;
    localStorage.setItem(KEY_SETTINGS, JSON.stringify(settings));
  }

  getCategories(): DbProductCategory[] {
    if (!this.assertDevLocal()) return [];
    try {
      const data = localStorage.getItem(KEY_CATEGORIES);
      return data ? JSON.parse(data) : DEFAULT_PRODUCT_CATEGORIES;
    } catch {
      return DEFAULT_PRODUCT_CATEGORIES;
    }
  }

  saveCategories(categories: DbProductCategory[]) {
    if (!this.assertDevLocal()) return;
    localStorage.setItem(KEY_CATEGORIES, JSON.stringify(categories));
  }

  getPublicProducts(): DbPublicProduct[] {
    if (!this.assertDevLocal()) return [];
    try {
      const data = localStorage.getItem(KEY_PUBLIC_PRODUCTS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  savePublicProducts(products: DbPublicProduct[]) {
    if (!this.assertDevLocal()) return;
    localStorage.setItem(KEY_PUBLIC_PRODUCTS, JSON.stringify(products));
  }

  getPublications(): DbPublication[] {
    if (!this.assertDevLocal()) return [];
    try {
      const data = localStorage.getItem(KEY_PUBLICATIONS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  savePublications(pubs: DbPublication[]) {
    if (!this.assertDevLocal()) return;
    localStorage.setItem(KEY_PUBLICATIONS, JSON.stringify(pubs));
  }

  getSpecialVisitors(): SpecialVisitorAccount[] {
    if (!this.assertDevLocal()) return [];
    try {
      const data = localStorage.getItem(KEY_VISITORS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  saveSpecialVisitors(visitors: SpecialVisitorAccount[]) {
    if (!this.assertDevLocal()) return;
    localStorage.setItem(KEY_VISITORS, JSON.stringify(visitors));
  }

  getReportsMap(): Record<string, DailyReportSummary> {
    if (!this.assertDevLocal()) return {};
    try {
      const data = localStorage.getItem(KEY_REPORTS);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  getReportByDate(dateString: string): DailyReportSummary {
    const map = this.getReportsMap();
    if (map[dateString]) {
      return map[dateString];
    }
    const empty = getEmptyDayInputs();
    return calculateDailyReportSummary({
      id: `dev_${dateString}`,
      establishmentId: DEFAULT_ESTABLISHMENT.establishment_id,
      reportDate: dateString,
      status: 'draft',
      office: empty.office,
      telecomBalances: empty.telecom,
      productSales: empty.products,
      moneyAccounts: empty.money,
    });
  }

  saveReport(report: DailyReportSummary) {
    if (!this.assertDevLocal()) return;
    const map = this.getReportsMap();
    map[report.reportDate] = report;
    localStorage.setItem(KEY_REPORTS, JSON.stringify(map));
  }

  getAuditLogs(): DbAuditLog[] {
    if (!this.assertDevLocal()) return [];
    try {
      const data = localStorage.getItem(KEY_AUDIT_LOGS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }
}

export const storageService = new StorageService();
if (isDevLocalMode) {
  storageService.initStorage();
}
