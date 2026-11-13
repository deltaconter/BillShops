/**
 * Service d'accès aux données Supabase - BillShops (Hol Corporation)
 *
 * Règles Lot 2 :
 * - Toutes les lectures et écritures passent par Supabase.
 * - Aucun fallback localStorage hors mode développement explicite (VITE_DEV_LOCAL=true).
 * - Les colonnes calculées par PostgreSQL ne sont jamais envoyées au serveur.
 * - Les clôtures et réouvertures passent exclusivement par les RPC close_day / reopen_day.
 * - audit_logs est strictement en lecture seule côté application.
 */

import { supabase, isSupabaseConfigured, isDevLocalMode } from '../config/supabaseClient';
import { storageService, getEmptyDayInputs } from './storageService';
import {
  DbEstablishmentSettings,
  DbProductCategory,
  DbPublication,
  DbPublicProduct,
  DbAuditLog,
  DbDailyReport,
  DbOfficeReport,
  DbNetworkBalance,
  DbNetworkMovement,
  DbProductSale,
  DbMoneyService,
  DbMoneyAccount,
  DbMoneyReport,
  DbMoneyMovement,
} from '../types/database';
import {
  DailyReportSummary,
  TelecomNetwork,
  NetworkBalanceInput,
  ProductSaleInput,
  MoneyAccountInput,
  MoneyMovementType,
  MoneyMovementDirection,
} from '../types/financial';
import { SpecialVisitorAccount } from '../types/auth';
import { RpcAccessError, isRpcAccessError, notifyRpcAccessDenied } from '../utils/rpcAccessError';
import {
  SupabaseUnavailableError,
  notifySupabaseUnreachable,
  isNetworkOrServerUnreachableError,
} from '../utils/supabaseStatus';
import { calculateDailyReportSummary } from './financialCalculations';

const ALL_NETWORKS: TelecomNetwork[] = ['orange', 'airtel', 'africell', 'vodacom'];

const STRICT_PRIVILEGE_ERROR_CODES = new Set([
  '42501',
  '28000',
  '28P01',
  'PGRST301',
  'PGRST302',
  'PGRST303',
]);

interface PostgrestErrorShape {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
  status?: number;
}

function formatMovementTime(isoTimestamp?: string | null): string {
  if (!isoTimestamp) return '';
  try {
    return new Date(isoTimestamp).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Kinshasa',
    });
  } catch {
    return '';
  }
}

function assertSupabaseClient() {
  if (!isSupabaseConfigured || !supabase) {
    notifySupabaseUnreachable(
      true,
      'Configuration Supabase absente ou serveur injoignable. Aucune opération ne peut être enregistrée.'
    );
    throw new SupabaseUnavailableError();
  }
  return supabase;
}

function handleSupabaseError(
  error: PostgrestErrorShape | unknown,
  httpStatus?: number,
  options?: { isRpc?: boolean; preserveBusinessMessage?: boolean }
): never {
  if (isNetworkOrServerUnreachableError(error, httpStatus)) {
    notifySupabaseUnreachable(true);
    throw new SupabaseUnavailableError();
  }

  const err = (error || {}) as PostgrestErrorShape;
  const code = (err.code || '').trim().toUpperCase();
  const effectiveStatus = httpStatus ?? err.status;

  if (options?.preserveBusinessMessage) {
    if (
      effectiveStatus === 401 ||
      effectiveStatus === 403 ||
      STRICT_PRIVILEGE_ERROR_CODES.has(code)
    ) {
      notifyRpcAccessDenied();
      throw new RpcAccessError();
    }
    throw new Error(err.message || 'Opération refusée par le serveur.');
  }

  if (options?.isRpc && isRpcAccessError(err, effectiveStatus)) {
    notifyRpcAccessDenied();
    throw new RpcAccessError();
  }

  if (effectiveStatus === 401 || STRICT_PRIVILEGE_ERROR_CODES.has(code)) {
    notifyRpcAccessDenied();
    throw new RpcAccessError();
  }

  throw new Error(err.message || 'Erreur lors de la communication avec la base de données.');
}

async function runQuery<T>(
  operation: () => PromiseLike<{ data: T | null; error: PostgrestErrorShape | null; status?: number }>
): Promise<T> {
  try {
    const result = await operation();
    if (result.error) {
      handleSupabaseError(result.error, result.status);
    }
    notifySupabaseUnreachable(false);
    return result.data as T;
  } catch (err) {
    if (err instanceof SupabaseUnavailableError || err instanceof RpcAccessError) {
      throw err;
    }
    if (isNetworkOrServerUnreachableError(err)) {
      notifySupabaseUnreachable(true);
      throw new SupabaseUnavailableError();
    }
    throw err;
  }
}

async function runRpc<T = unknown>(
  operation: () => PromiseLike<{ data: T | null; error: PostgrestErrorShape | null; status?: number }>,
  options?: { preserveBusinessMessage?: boolean }
): Promise<T | null> {
  try {
    const result = await operation();
    if (result.error) {
      handleSupabaseError(result.error, result.status, {
        isRpc: true,
        preserveBusinessMessage: options?.preserveBusinessMessage,
      });
    }
    notifySupabaseUnreachable(false);
    return result.data;
  } catch (err) {
    if (err instanceof SupabaseUnavailableError || err instanceof RpcAccessError) {
      throw err;
    }
    if (isNetworkOrServerUnreachableError(err)) {
      notifySupabaseUnreachable(true);
      throw new SupabaseUnavailableError();
    }
    throw err;
  }
}

function buildMoneyAccountsFromRows(params: {
  services: DbMoneyService[];
  accounts: DbMoneyAccount[];
  moneyReports: DbMoneyReport[];
  moneyMovements: DbMoneyMovement[];
}): MoneyAccountInput[] {
  const serviceMap = new Map<string, DbMoneyService>();
  params.services.forEach((s) => serviceMap.set(s.id, s));

  const reportByAccount = new Map<string, DbMoneyReport>();
  params.moneyReports.forEach((mr) => reportByAccount.set(mr.account_id, mr));

  const movementsByReport = new Map<string, DbMoneyMovement[]>();
  params.moneyMovements.forEach((mm) => {
    const list = movementsByReport.get(mm.money_report_id) || [];
    list.push(mm);
    movementsByReport.set(mm.money_report_id, list);
  });

  const accountById = new Map<string, DbMoneyAccount>();
  params.accounts.forEach((a) => accountById.set(a.id, a));

  // Garantir l'inclusion des comptes actifs + ceux déjà présents dans les rapports du jour
  const orderedAccountIds = new Set<string>();
  params.accounts.filter((a) => a.is_active).forEach((a) => orderedAccountIds.add(a.id));
  params.moneyReports.forEach((mr) => orderedAccountIds.add(mr.account_id));

  const result: MoneyAccountInput[] = [];
  orderedAccountIds.forEach((accountId) => {
    const acc = accountById.get(accountId);
    const mr = reportByAccount.get(accountId);
    const service = acc ? serviceMap.get(acc.service_id) : undefined;
    const movements = mr ? movementsByReport.get(mr.id) || [] : [];

    result.push({
      reportId: mr?.id,
      accountId,
      serviceId: acc?.service_id || '',
      serviceName: service?.name || acc?.label || 'Mobile Money',
      accountLabel: acc?.label || acc?.account_number || service?.name || 'Compte principal',
      initialEBalance: mr?.initial_e_balance ?? 0,
      finalEBalance: mr?.final_e_balance ?? 0,
      initialCash: mr?.initial_cash ?? 0,
      finalCash: mr?.final_cash ?? 0,
      totalDeposits: mr?.total_deposits ?? 0,
      totalWithdrawals: mr?.total_withdrawals ?? 0,
      commissionsReceived: mr?.commissions_received ?? 0,
      earnedCommissions: mr?.earned_commissions ?? 0,
      movements: movements.map((m) => ({
        id: m.id,
        movementType: m.movement_type,
        direction: m.direction,
        amount: m.amount,
        notes: m.notes,
        createdAt: m.created_at,
        isPersisted: true,
      })),
      notes: mr?.notes ?? undefined,
      hasSavedReport: Boolean(mr),
      serverCalculated: mr
        ? {
            theoreticalEBalance: mr.theoretical_e_balance,
            eBalanceDiscrepancy: mr.e_balance_diff,
            theoreticalCash: mr.theoretical_cash,
            cashDiscrepancy: mr.cash_diff,
          }
        : undefined,
    });
  });

  return result;
}

class DataService {
  // ---------------------------------------------------------------------------
  // 1. PARAMÈTRES ÉTABLISSEMENT
  // ---------------------------------------------------------------------------
  async getSettings(establishmentId?: string): Promise<DbEstablishmentSettings | null> {
    if (isDevLocalMode && !isSupabaseConfigured) {
      return storageService.getSettings();
    }

    const client = assertSupabaseClient();
    const data = await runQuery<DbEstablishmentSettings | null>(() => {
      let query = client.from('establishment_settings').select('*');
      if (establishmentId) {
        query = query.eq('establishment_id', establishmentId);
      }
      return query.limit(1).maybeSingle();
    });

    return data ?? null;
  }

  async updateSettings(
    settings: DbEstablishmentSettings,
    establishmentId: string
  ): Promise<DbEstablishmentSettings> {
    if (!establishmentId) {
      throw new Error('Identifiant d’établissement manquant.');
    }

    if (isDevLocalMode && !isSupabaseConfigured) {
      const updated = { ...settings, establishment_id: establishmentId };
      storageService.saveSettings(updated);
      return updated;
    }

    const client = assertSupabaseClient();
    const editablePayload = {
      name: settings.name.trim(),
      legal_name: settings.legal_name?.trim() || null,
      currency: settings.currency?.trim() || 'FC',
      phone: settings.phone?.trim() || null,
      whatsapp_number: settings.whatsapp_number?.trim() || null,
      email: settings.email?.trim() || null,
      address: settings.address?.trim() || null,
      city: settings.city?.trim() || null,
      mpesa_enabled: Boolean(settings.mpesa_enabled),
    };

    const existing = await runQuery<{ id: string } | null>(() =>
      client
        .from('establishment_settings')
        .select('id')
        .eq('establishment_id', establishmentId)
        .limit(1)
        .maybeSingle()
    );

    if (existing?.id) {
      const updated = await runQuery<DbEstablishmentSettings>(() =>
        client
          .from('establishment_settings')
          .update(editablePayload)
          .eq('id', existing.id)
          .eq('establishment_id', establishmentId)
          .select('*')
          .single()
      );
      return updated;
    }

    const created = await runQuery<DbEstablishmentSettings>(() =>
      client
        .from('establishment_settings')
        .insert({
          establishment_id: establishmentId,
          ...editablePayload,
        })
        .select('*')
        .single()
    );
    return created;
  }

  // ---------------------------------------------------------------------------
  // 2. CATÉGORIES FRIGOS & PRODUITS
  // ---------------------------------------------------------------------------
  async getCategories(establishmentId: string): Promise<DbProductCategory[]> {
    if (isDevLocalMode && !isSupabaseConfigured) {
      return storageService.getCategories();
    }

    const client = assertSupabaseClient();
    const data = await runQuery<DbProductCategory[] | null>(() =>
      client
        .from('product_categories')
        .select('*')
        .eq('establishment_id', establishmentId)
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: true })
    );
    return data ?? [];
  }

  async createCategory(
    establishmentId: string,
    name: string,
    orderIndex: number
  ): Promise<DbProductCategory> {
    if (!establishmentId) {
      throw new Error('Identifiant d’établissement manquant.');
    }

    if (isDevLocalMode && !isSupabaseConfigured) {
      const existing = storageService.getCategories();
      const newCat: DbProductCategory = {
        id: `cat_${Date.now()}`,
        establishment_id: establishmentId,
        name: name.trim(),
        is_active: true,
        order_index: orderIndex,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      storageService.saveCategories([...existing, newCat]);
      return newCat;
    }

    const client = assertSupabaseClient();
    return runQuery<DbProductCategory>(() =>
      client
        .from('product_categories')
        .insert({
          establishment_id: establishmentId,
          name: name.trim(),
          is_active: true,
          order_index: orderIndex,
        })
        .select('*')
        .single()
    );
  }

  async toggleCategoryActive(
    establishmentId: string,
    categoryId: string,
    isActive: boolean
  ): Promise<DbProductCategory> {
    if (isDevLocalMode && !isSupabaseConfigured) {
      const existing = storageService.getCategories();
      let target: DbProductCategory | undefined;
      const updated = existing.map((c) => {
        if (c.id === categoryId) {
          target = { ...c, is_active: isActive, updated_at: new Date().toISOString() };
          return target;
        }
        return c;
      });
      storageService.saveCategories(updated);
      if (!target) throw new Error('Catégorie introuvable.');
      return target;
    }

    const client = assertSupabaseClient();
    return runQuery<DbProductCategory>(() =>
      client
        .from('product_categories')
        .update({ is_active: isActive })
        .eq('id', categoryId)
        .eq('establishment_id', establishmentId)
        .select('*')
        .single()
    );
  }

  // ---------------------------------------------------------------------------
  // 3. CATALOGUE PUBLIC ET TARIFS
  // ---------------------------------------------------------------------------
  async getPublicProducts(establishmentId?: string): Promise<DbPublicProduct[]> {
    if (isDevLocalMode && !isSupabaseConfigured) {
      return storageService.getPublicProducts();
    }

    const client = assertSupabaseClient();
    const data = await runQuery<DbPublicProduct[] | null>(() => {
      let query = client.from('public_products').select('*');
      if (establishmentId) {
        query = query.eq('establishment_id', establishmentId);
      } else {
        query = query.eq('is_available', true);
      }
      return query.order('order_index', { ascending: true }).order('created_at', { ascending: true });
    });

    return data ?? [];
  }

  async createPublicProduct(
    establishmentId: string,
    input: {
      name: string;
      description?: string | null;
      category: string;
      indicative_price: number;
      unit: string;
      order_index: number;
    }
  ): Promise<DbPublicProduct> {
    if (!establishmentId) {
      throw new Error('Identifiant d’établissement manquant.');
    }

    if (isDevLocalMode && !isSupabaseConfigured) {
      const existing = storageService.getPublicProducts();
      const newProd: DbPublicProduct = {
        id: `prod_${Date.now()}`,
        establishment_id: establishmentId,
        name: input.name.trim(),
        description: input.description ?? null,
        category: input.category,
        indicative_price: Math.max(0, Math.round(input.indicative_price)),
        unit: input.unit.trim() || 'unité',
        is_available: true,
        order_index: input.order_index,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      storageService.savePublicProducts([...existing, newProd]);
      return newProd;
    }

    const client = assertSupabaseClient();
    return runQuery<DbPublicProduct>(() =>
      client
        .from('public_products')
        .insert({
          establishment_id: establishmentId,
          name: input.name.trim(),
          description: input.description ?? null,
          category: input.category,
          indicative_price: Math.max(0, Math.round(input.indicative_price)),
          unit: input.unit.trim() || 'unité',
          is_available: true,
          order_index: input.order_index,
        })
        .select('*')
        .single()
    );
  }

  async deletePublicProduct(establishmentId: string, id: string): Promise<void> {
    if (isDevLocalMode && !isSupabaseConfigured) {
      const existing = storageService.getPublicProducts();
      storageService.savePublicProducts(existing.filter((p) => p.id !== id));
      return;
    }

    const client = assertSupabaseClient();
    await runQuery<null>(() =>
      client
        .from('public_products')
        .delete()
        .eq('id', id)
        .eq('establishment_id', establishmentId)
    );
  }

  // ---------------------------------------------------------------------------
  // 4. PUBLICATIONS ET PROMOTIONS VITRINE
  // ---------------------------------------------------------------------------
  async getPublications(establishmentId?: string): Promise<DbPublication[]> {
    if (isDevLocalMode && !isSupabaseConfigured) {
      return storageService.getPublications();
    }

    const client = assertSupabaseClient();
    const data = await runQuery<DbPublication[] | null>(() => {
      let query = client.from('publications').select('*');
      if (establishmentId) {
        query = query.eq('establishment_id', establishmentId);
      } else {
        query = query.eq('status', 'published');
      }
      return query
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: false });
    });

    return data ?? [];
  }

  async createPublication(
    establishmentId: string,
    input: {
      title: string;
      description: string;
      image_url?: string | null;
      category: 'promo' | 'announcement' | 'service' | 'news';
      price?: number | null;
      start_date: string;
      order_index: number;
    }
  ): Promise<DbPublication> {
    if (!establishmentId) {
      throw new Error('Identifiant d’établissement manquant.');
    }

    if (isDevLocalMode && !isSupabaseConfigured) {
      const existing = storageService.getPublications();
      const newPub: DbPublication = {
        id: `pub_${Date.now()}`,
        establishment_id: establishmentId,
        title: input.title.trim(),
        description: input.description.trim(),
        image_url: input.image_url ?? null,
        category: input.category,
        price: input.price ?? null,
        status: 'published',
        start_date: input.start_date,
        end_date: null,
        order_index: input.order_index,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      storageService.savePublications([newPub, ...existing]);
      return newPub;
    }

    const client = assertSupabaseClient();
    return runQuery<DbPublication>(() =>
      client
        .from('publications')
        .insert({
          establishment_id: establishmentId,
          title: input.title.trim(),
          description: input.description.trim(),
          image_url: input.image_url ?? null,
          category: input.category,
          price: typeof input.price === 'number' ? Math.max(0, Math.round(input.price)) : null,
          status: 'published',
          start_date: input.start_date,
          end_date: null,
          order_index: input.order_index,
        })
        .select('*')
        .single()
    );
  }

  async deletePublication(establishmentId: string, id: string): Promise<void> {
    if (isDevLocalMode && !isSupabaseConfigured) {
      const existing = storageService.getPublications();
      storageService.savePublications(existing.filter((p) => p.id !== id));
      return;
    }

    const client = assertSupabaseClient();
    await runQuery<null>(() =>
      client.from('publications').delete().eq('id', id).eq('establishment_id', establishmentId)
    );
  }

  // ---------------------------------------------------------------------------
  // 5. VISITEURS SPÉCIAUX (LECTURE SUPABASE POUR LOT 2)
  // ---------------------------------------------------------------------------
  async getSpecialVisitors(establishmentId: string): Promise<SpecialVisitorAccount[]> {
    if (isDevLocalMode && !isSupabaseConfigured) {
      return storageService.getSpecialVisitors();
    }

    const client = assertSupabaseClient();
    const data = await runQuery<
      Array<{ id: string; username: string; is_active: boolean; created_at: string }> | null
    >(() =>
      client
        .from('special_visitors')
        .select('id, username, is_active, created_at')
        .eq('establishment_id', establishmentId)
        .order('created_at', { ascending: false })
    );

    return (data ?? []).map((v) => ({
      id: v.id,
      username: v.username,
      isActive: v.is_active,
      createdAt: v.created_at,
    }));
  }

  // ---------------------------------------------------------------------------
  // 6. RAPPORTS JOURNALIERS & MODULES OPÉRATIONNELS
  // ---------------------------------------------------------------------------
  private async ensureDailyReport(
    establishmentId: string,
    reportDate: string
  ): Promise<DbDailyReport> {
    const client = assertSupabaseClient();

    const existing = await runQuery<DbDailyReport | null>(() =>
      client
        .from('daily_reports')
        .select('*')
        .eq('establishment_id', establishmentId)
        .eq('report_date', reportDate)
        .maybeSingle()
    );

    if (existing) {
      return existing;
    }

    try {
      const created = await runQuery<DbDailyReport>(() =>
        client
          .from('daily_reports')
          .insert({
            establishment_id: establishmentId,
            report_date: reportDate,
          })
          .select('*')
          .single()
      );
      return created;
    } catch (err) {
      const errObj = err as PostgrestErrorShape;
      if (errObj?.code === '23505') {
        const refetched = await runQuery<DbDailyReport | null>(() =>
          client
            .from('daily_reports')
            .select('*')
            .eq('establishment_id', establishmentId)
            .eq('report_date', reportDate)
            .maybeSingle()
        );
        if (refetched) return refetched;
      }
      throw err;
    }
  }

  private async fetchMoneyConfig(establishmentId: string): Promise<{
    services: DbMoneyService[];
    accounts: DbMoneyAccount[];
  }> {
    const client = assertSupabaseClient();
    const services =
      (await runQuery<DbMoneyService[] | null>(() =>
        client
          .from('money_services')
          .select('*')
          .eq('establishment_id', establishmentId)
          .order('created_at', { ascending: true })
      )) ?? [];

    if (services.length === 0) {
      return { services: [], accounts: [] };
    }

    const serviceIds = services.map((s) => s.id);
    const accounts =
      (await runQuery<DbMoneyAccount[] | null>(() =>
        client
          .from('money_accounts')
          .select('*')
          .in('service_id', serviceIds)
          .order('created_at', { ascending: true })
      )) ?? [];

    return { services, accounts };
  }

  async getReport(establishmentId: string, dateString: string): Promise<DailyReportSummary> {
    if (isDevLocalMode && !isSupabaseConfigured) {
      return storageService.getReportByDate(dateString);
    }

    const client = assertSupabaseClient();

    const [dailyReport, moneyConfig, categories] = await Promise.all([
      runQuery<DbDailyReport | null>(() =>
        client
          .from('daily_reports')
          .select('*')
          .eq('establishment_id', establishmentId)
          .eq('report_date', dateString)
          .maybeSingle()
      ),
      this.fetchMoneyConfig(establishmentId),
      this.getCategories(establishmentId),
    ]);

    const categoryNameById = new Map<string, string>();
    categories.forEach((c) => categoryNameById.set(c.id, c.name));

    const emptyInputs = getEmptyDayInputs();

    if (!dailyReport) {
      const emptyMoneyAccounts = buildMoneyAccountsFromRows({
        services: moneyConfig.services,
        accounts: moneyConfig.accounts,
        moneyReports: [],
        moneyMovements: [],
      });

      return calculateDailyReportSummary({
        id: null,
        establishmentId,
        reportDate: dateString,
        status: 'draft',
        office: { ...emptyInputs.office, hasSavedEntry: false, noActivity: false },
        telecomBalances: emptyInputs.telecom,
        telecomOptions: { hasSavedEntry: false, noActivity: false },
        productSales: [],
        productsOptions: { hasSavedEntry: false, noActivity: false },
        moneyAccounts: emptyMoneyAccounts,
        moneyOptions: { hasSavedEntry: false, noActivity: false },
      });
    }

    const [officeRow, networkBalances, productSalesRows, moneyReportRows] = await Promise.all([
      runQuery<DbOfficeReport | null>(() =>
        client
          .from('office_reports')
          .select('*')
          .eq('daily_report_id', dailyReport.id)
          .maybeSingle()
      ),
      runQuery<DbNetworkBalance[] | null>(() =>
        client.from('network_balances').select('*').eq('daily_report_id', dailyReport.id)
      ).then((r) => r ?? []),
      runQuery<DbProductSale[] | null>(() =>
        client.from('product_sales').select('*').eq('daily_report_id', dailyReport.id)
      ).then((r) => r ?? []),
      runQuery<DbMoneyReport[] | null>(() =>
        client.from('money_reports').select('*').eq('daily_report_id', dailyReport.id)
      ).then((r) => r ?? []),
    ]);

    const nbIds = networkBalances.map((nb) => nb.id);
    const mrIds = moneyReportRows.map((mr) => mr.id);

    const [networkMovements, moneyMovements] = await Promise.all([
      nbIds.length > 0
        ? runQuery<DbNetworkMovement[] | null>(() =>
            client
              .from('network_movements')
              .select('*')
              .in('network_balance_id', nbIds)
              .order('created_at', { ascending: true })
          ).then((r) => r ?? [])
        : Promise.resolve([] as DbNetworkMovement[]),
      mrIds.length > 0
        ? runQuery<DbMoneyMovement[] | null>(() =>
            client
              .from('money_movements')
              .select('*')
              .in('money_report_id', mrIds)
              .order('created_at', { ascending: true })
          ).then((r) => r ?? [])
        : Promise.resolve([] as DbMoneyMovement[]),
    ]);

    const movementsByBalance = new Map<string, DbNetworkMovement[]>();
    networkMovements.forEach((m) => {
      const list = movementsByBalance.get(m.network_balance_id) || [];
      list.push(m);
      movementsByBalance.set(m.network_balance_id, list);
    });

    const telecomBalances = { ...emptyInputs.telecom };
    ALL_NETWORKS.forEach((net) => {
      const row = networkBalances.find((nb) => nb.network === net);
      if (row) {
        const supplies = (movementsByBalance.get(row.id) || []).map((m) => ({
          id: m.id,
          amount: m.supply_amount,
          createdAt: m.created_at,
          time: formatMovementTime(m.created_at),
          notes: m.notes ?? undefined,
          isPersisted: true,
        }));

        telecomBalances[net] = {
          id: row.id,
          network: net,
          initialBalance: row.initial_balance,
          supplies,
          finalBalance: row.final_balance,
          cashCollected: row.cash_collected,
          notes: row.notes ?? undefined,
          serverTotals: {
            totalSupplies: row.total_supplies,
            soldUnits: row.sold_units,
            discrepancy: row.discrepancy,
          },
        };
      }
    });

    const mappedProductSales: ProductSaleInput[] = productSalesRows.map((ps) => ({
      categoryId: ps.category_id,
      categoryName: ps.category_name || categoryNameById.get(ps.category_id) || 'Catégorie',
      totalSales: ps.total_sales,
      notes: ps.notes ?? undefined,
    }));

    const moneyAccounts = buildMoneyAccountsFromRows({
      services: moneyConfig.services,
      accounts: moneyConfig.accounts,
      moneyReports: moneyReportRows,
      moneyMovements,
    });

    return calculateDailyReportSummary({
      id: dailyReport.id,
      establishmentId,
      reportDate: dailyReport.report_date,
      status: dailyReport.status,
      office: officeRow
        ? {
            turnover: officeRow.turnover,
            expenses: officeRow.expenses,
            serverNetResult: officeRow.net_result,
            notes: officeRow.notes ?? undefined,
            hasSavedEntry: true,
            noActivity: Boolean(dailyReport.office_no_activity),
          }
        : {
            turnover: 0,
            expenses: 0,
            serverNetResult: 0,
            hasSavedEntry: false,
            noActivity: Boolean(dailyReport.office_no_activity),
          },
      telecomBalances,
      telecomOptions: {
        hasSavedEntry: networkBalances.length > 0,
        noActivity: Boolean(dailyReport.telecom_no_activity),
      },
      productSales: mappedProductSales,
      productsOptions: {
        hasSavedEntry: productSalesRows.length > 0,
        noActivity: Boolean(dailyReport.products_no_activity),
      },
      moneyAccounts,
      moneyOptions: {
        hasSavedEntry: moneyReportRows.length > 0,
        noActivity: Boolean(dailyReport.money_no_activity),
      },
      closedAt: dailyReport.closed_at ?? undefined,
      closedBy: dailyReport.closed_by ?? undefined,
      reopenJustification: dailyReport.reopen_justification ?? undefined,
    });
  }

  async getReportsHistory(establishmentId: string): Promise<DailyReportSummary[]> {
    if (isDevLocalMode && !isSupabaseConfigured) {
      const map = storageService.getReportsMap();
      return Object.values(map).sort((a, b) => b.reportDate.localeCompare(a.reportDate));
    }

    const client = assertSupabaseClient();
    const dailyReports =
      (await runQuery<DbDailyReport[] | null>(() =>
        client
          .from('daily_reports')
          .select('*')
          .eq('establishment_id', establishmentId)
          .order('report_date', { ascending: false })
      )) ?? [];

    if (dailyReports.length === 0) {
      return [];
    }

    const reportIds = dailyReports.map((r) => r.id);

    const [
      officeRows,
      networkBalancesRows,
      productSalesRows,
      moneyReportsRows,
      moneyConfig,
      categories,
    ] = await Promise.all([
      runQuery<DbOfficeReport[] | null>(() =>
        client.from('office_reports').select('*').in('daily_report_id', reportIds)
      ).then((r) => r ?? []),
      runQuery<DbNetworkBalance[] | null>(() =>
        client.from('network_balances').select('*').in('daily_report_id', reportIds)
      ).then((r) => r ?? []),
      runQuery<DbProductSale[] | null>(() =>
        client.from('product_sales').select('*').in('daily_report_id', reportIds)
      ).then((r) => r ?? []),
      runQuery<DbMoneyReport[] | null>(() =>
        client.from('money_reports').select('*').in('daily_report_id', reportIds)
      ).then((r) => r ?? []),
      this.fetchMoneyConfig(establishmentId),
      this.getCategories(establishmentId),
    ]);

    const nbIds = networkBalancesRows.map((nb) => nb.id);
    const mrIds = moneyReportsRows.map((mr) => mr.id);

    const [networkMovementsRows, moneyMovementsRows] = await Promise.all([
      nbIds.length > 0
        ? runQuery<DbNetworkMovement[] | null>(() =>
            client.from('network_movements').select('*').in('network_balance_id', nbIds)
          ).then((r) => r ?? [])
        : Promise.resolve([] as DbNetworkMovement[]),
      mrIds.length > 0
        ? runQuery<DbMoneyMovement[] | null>(() =>
            client.from('money_movements').select('*').in('money_report_id', mrIds)
          ).then((r) => r ?? [])
        : Promise.resolve([] as DbMoneyMovement[]),
    ]);

    const categoryNameById = new Map<string, string>();
    categories.forEach((c) => categoryNameById.set(c.id, c.name));

    const emptyInputs = getEmptyDayInputs();

    return dailyReports.map((dr) => {
      const officeRow = officeRows.find((o) => o.daily_report_id === dr.id);
      const drNbs = networkBalancesRows.filter((nb) => nb.daily_report_id === dr.id);
      const drPs = productSalesRows.filter((ps) => ps.daily_report_id === dr.id);
      const drMrs = moneyReportsRows.filter((mr) => mr.daily_report_id === dr.id);

      const drNbIds = new Set(drNbs.map((n) => n.id));
      const drMrIds = new Set(drMrs.map((m) => m.id));

      const telecomBalances = { ...emptyInputs.telecom };
      ALL_NETWORKS.forEach((net) => {
        const row = drNbs.find((nb) => nb.network === net);
        if (row) {
          const supplies = networkMovementsRows
            .filter((m) => drNbIds.has(m.network_balance_id) && m.network_balance_id === row.id)
            .map((m) => ({
              id: m.id,
              amount: m.supply_amount,
              createdAt: m.created_at,
              time: formatMovementTime(m.created_at),
              notes: m.notes ?? undefined,
              isPersisted: true,
            }));

          telecomBalances[net] = {
            id: row.id,
            network: net,
            initialBalance: row.initial_balance,
            supplies,
            finalBalance: row.final_balance,
            cashCollected: row.cash_collected,
            notes: row.notes ?? undefined,
            serverTotals: {
              totalSupplies: row.total_supplies,
              soldUnits: row.sold_units,
              discrepancy: row.discrepancy,
            },
          };
        }
      });

      const mappedSales: ProductSaleInput[] = drPs.map((ps) => ({
        categoryId: ps.category_id,
        categoryName: ps.category_name || categoryNameById.get(ps.category_id) || 'Catégorie',
        totalSales: ps.total_sales,
        notes: ps.notes ?? undefined,
      }));

      const moneyAccounts = buildMoneyAccountsFromRows({
        services: moneyConfig.services,
        accounts: moneyConfig.accounts,
        moneyReports: drMrs,
        moneyMovements: moneyMovementsRows.filter((mm) => drMrIds.has(mm.money_report_id)),
      });

      return calculateDailyReportSummary({
        id: dr.id,
        establishmentId,
        reportDate: dr.report_date,
        status: dr.status,
        office: officeRow
          ? {
              turnover: officeRow.turnover,
              expenses: officeRow.expenses,
              serverNetResult: officeRow.net_result,
              notes: officeRow.notes ?? undefined,
              hasSavedEntry: true,
              noActivity: Boolean(dr.office_no_activity),
            }
          : {
              turnover: 0,
              expenses: 0,
              serverNetResult: 0,
              hasSavedEntry: false,
              noActivity: Boolean(dr.office_no_activity),
            },
        telecomBalances,
        telecomOptions: {
          hasSavedEntry: drNbs.length > 0,
          noActivity: Boolean(dr.telecom_no_activity),
        },
        productSales: mappedSales,
        productsOptions: {
          hasSavedEntry: drPs.length > 0,
          noActivity: Boolean(dr.products_no_activity),
        },
        moneyAccounts,
        moneyOptions: {
          hasSavedEntry: drMrs.length > 0,
          noActivity: Boolean(dr.money_no_activity),
        },
        closedAt: dr.closed_at ?? undefined,
        closedBy: dr.closed_by ?? undefined,
        reopenJustification: dr.reopen_justification ?? undefined,
      });
    });
  }

  // SAUVEGARDE MODULE 1 : BUREAUTIQUE
  async saveOfficeReport(
    establishmentId: string,
    dateString: string,
    input: { turnover: number; expenses: number; notes?: string; noActivity?: boolean }
  ): Promise<DailyReportSummary> {
    if (isDevLocalMode && !isSupabaseConfigured) {
      const existing = storageService.getReportByDate(dateString);
      const updated = calculateDailyReportSummary({
        ...existing,
        reportDate: dateString,
        status: existing.status === 'closed' ? 'closed' : 'in_progress',
        office: input.noActivity
          ? { turnover: 0, expenses: 0, hasSavedEntry: false, noActivity: true }
          : {
              turnover: input.turnover,
              expenses: input.expenses,
              notes: input.notes,
              hasSavedEntry: true,
              noActivity: false,
            },
        telecomBalances: existing.telecom.networks as unknown as Record<
          TelecomNetwork,
          NetworkBalanceInput
        >,
        telecomOptions: {
          hasSavedEntry: existing.telecom.hasSavedEntry,
          noActivity: existing.telecom.noActivity,
        },
        productSales: existing.products.sales,
        productsOptions: {
          hasSavedEntry: existing.products.hasSavedEntry,
          noActivity: existing.products.noActivity,
        },
        moneyAccounts: existing.money.accounts,
        moneyOptions: {
          hasSavedEntry: existing.money.hasSavedEntry,
          noActivity: existing.money.noActivity,
        },
      });
      storageService.saveReport(updated);
      return updated;
    }

    const client = assertSupabaseClient();
    const dailyReport = await this.ensureDailyReport(establishmentId, dateString);
    const noActivity = Boolean(input.noActivity);

    await runQuery<DbDailyReport>(() =>
      client
        .from('daily_reports')
        .update({ office_no_activity: noActivity })
        .eq('id', dailyReport.id)
        .eq('establishment_id', establishmentId)
        .select('*')
        .single()
    );

    const existingOffice = await runQuery<{ id: string } | null>(() =>
      client
        .from('office_reports')
        .select('id')
        .eq('daily_report_id', dailyReport.id)
        .maybeSingle()
    );

    if (noActivity) {
      if (existingOffice?.id) {
        await runQuery<null>(() =>
          client.from('office_reports').delete().eq('id', existingOffice.id)
        );
      }
    } else {
      // Ne jamais envoyer net_result (calculé par PostgreSQL)
      const payload = {
        daily_report_id: dailyReport.id,
        turnover: Math.max(0, Math.round(input.turnover || 0)),
        expenses: Math.max(0, Math.round(input.expenses || 0)),
        notes: input.notes?.trim() || null,
      };

      if (existingOffice?.id) {
        await runQuery<DbOfficeReport>(() =>
          client
            .from('office_reports')
            .update(payload)
            .eq('id', existingOffice.id)
            .select('*')
            .single()
        );
      } else {
        await runQuery<DbOfficeReport>(() =>
          client.from('office_reports').insert(payload).select('*').single()
        );
      }
    }

    return this.getReport(establishmentId, dateString);
  }

  // SAUVEGARDE MODULE 2 : UNITÉS TÉLÉPHONIQUES
  async saveTelecomModule(
    establishmentId: string,
    dateString: string,
    balances: Record<TelecomNetwork, NetworkBalanceInput>,
    noActivity = false
  ): Promise<DailyReportSummary> {
    if (isDevLocalMode && !isSupabaseConfigured) {
      const existing = storageService.getReportByDate(dateString);
      const updated = calculateDailyReportSummary({
        ...existing,
        reportDate: dateString,
        status: existing.status === 'closed' ? 'closed' : 'in_progress',
        office: existing.office,
        telecomBalances: noActivity ? getEmptyDayInputs().telecom : balances,
        telecomOptions: { hasSavedEntry: !noActivity, noActivity },
        productSales: existing.products.sales,
        productsOptions: {
          hasSavedEntry: existing.products.hasSavedEntry,
          noActivity: existing.products.noActivity,
        },
        moneyAccounts: existing.money.accounts,
        moneyOptions: {
          hasSavedEntry: existing.money.hasSavedEntry,
          noActivity: existing.money.noActivity,
        },
      });
      storageService.saveReport(updated);
      return updated;
    }

    const client = assertSupabaseClient();
    const dailyReport = await this.ensureDailyReport(establishmentId, dateString);

    await runQuery<DbDailyReport>(() =>
      client
        .from('daily_reports')
        .update({ telecom_no_activity: Boolean(noActivity) })
        .eq('id', dailyReport.id)
        .eq('establishment_id', establishmentId)
        .select('*')
        .single()
    );

    const existingBalances =
      (await runQuery<DbNetworkBalance[] | null>(() =>
        client.from('network_balances').select('*').eq('daily_report_id', dailyReport.id)
      )) ?? [];

    if (noActivity) {
      const existingIds = existingBalances.map((nb) => nb.id);
      if (existingIds.length > 0) {
        await runQuery<null>(() =>
          client.from('network_movements').delete().in('network_balance_id', existingIds)
        );
        await runQuery<null>(() =>
          client.from('network_balances').delete().in('id', existingIds)
        );
      }
      return this.getReport(establishmentId, dateString);
    }

    const existingBalanceIds = existingBalances.map((b) => b.id);
    const existingMovements =
      existingBalanceIds.length > 0
        ? (await runQuery<DbNetworkMovement[] | null>(() =>
            client.from('network_movements').select('*').in('network_balance_id', existingBalanceIds)
          )) ?? []
        : [];

    for (const net of ALL_NETWORKS) {
      const bal = balances[net];
      const existingRow = existingBalances.find((r) => r.network === net);

      // Ne jamais envoyer total_supplies, sold_units ni discrepancy (calculés par la base)
      const balancePayload = {
        daily_report_id: dailyReport.id,
        network: net,
        initial_balance: Math.max(0, Math.round(bal.initialBalance || 0)),
        final_balance: Math.max(0, Math.round(bal.finalBalance || 0)),
        cash_collected: Math.max(0, Math.round(bal.cashCollected || 0)),
        notes: bal.notes?.trim() || null,
      };

      let savedBalance: DbNetworkBalance;
      if (existingRow) {
        savedBalance = await runQuery<DbNetworkBalance>(() =>
          client
            .from('network_balances')
            .update(balancePayload)
            .eq('id', existingRow.id)
            .select('*')
            .single()
        );
      } else {
        savedBalance = await runQuery<DbNetworkBalance>(() =>
          client.from('network_balances').insert(balancePayload).select('*').single()
        );
      }

      // Synchronisation des approvisionnements dans network_movements
      const dbMovementsForNet = existingMovements.filter(
        (m) => m.network_balance_id === savedBalance.id
      );
      const keptPersistedIds = new Set(
        (bal.supplies || []).filter((s) => s.isPersisted && s.id).map((s) => s.id as string)
      );

      const idsToDelete = dbMovementsForNet
        .filter((m) => !keptPersistedIds.has(m.id))
        .map((m) => m.id);

      if (idsToDelete.length > 0) {
        await runQuery<null>(() =>
          client.from('network_movements').delete().in('id', idsToDelete)
        );
      }

      const newMovements = (bal.supplies || [])
        .filter((s) => !s.isPersisted && s.amount > 0)
        .map((s) => ({
          network_balance_id: savedBalance.id,
          supply_amount: Math.max(0, Math.round(s.amount)),
          notes: s.notes?.trim() || null,
        }));

      if (newMovements.length > 0) {
        await runQuery<DbNetworkMovement[] | null>(() =>
          client.from('network_movements').insert(newMovements).select('*')
        );
      }
    }

    return this.getReport(establishmentId, dateString);
  }

  // SAUVEGARDE MODULE 3 : FRIGOS & PRODUITS KONGOTERRA
  async saveProductSales(
    establishmentId: string,
    dateString: string,
    sales: ProductSaleInput[],
    noActivity = false
  ): Promise<DailyReportSummary> {
    if (isDevLocalMode && !isSupabaseConfigured) {
      const existing = storageService.getReportByDate(dateString);
      const updated = calculateDailyReportSummary({
        ...existing,
        reportDate: dateString,
        status: existing.status === 'closed' ? 'closed' : 'in_progress',
        office: existing.office,
        telecomBalances: existing.telecom.networks as unknown as Record<
          TelecomNetwork,
          NetworkBalanceInput
        >,
        telecomOptions: {
          hasSavedEntry: existing.telecom.hasSavedEntry,
          noActivity: existing.telecom.noActivity,
        },
        productSales: noActivity ? [] : sales,
        productsOptions: { hasSavedEntry: !noActivity, noActivity },
        moneyAccounts: existing.money.accounts,
        moneyOptions: {
          hasSavedEntry: existing.money.hasSavedEntry,
          noActivity: existing.money.noActivity,
        },
      });
      storageService.saveReport(updated);
      return updated;
    }

    const client = assertSupabaseClient();
    const dailyReport = await this.ensureDailyReport(establishmentId, dateString);

    await runQuery<DbDailyReport>(() =>
      client
        .from('daily_reports')
        .update({ products_no_activity: Boolean(noActivity) })
        .eq('id', dailyReport.id)
        .eq('establishment_id', establishmentId)
        .select('*')
        .single()
    );

    const existingRows =
      (await runQuery<DbProductSale[] | null>(() =>
        client.from('product_sales').select('*').eq('daily_report_id', dailyReport.id)
      )) ?? [];

    if (noActivity) {
      if (existingRows.length > 0) {
        await runQuery<null>(() =>
          client.from('product_sales').delete().eq('daily_report_id', dailyReport.id)
        );
      }
      return this.getReport(establishmentId, dateString);
    }

    for (const s of sales) {
      const existing = existingRows.find((r) => r.category_id === s.categoryId);
      // Ne envoyer que category_id (la base copie category_name depuis product_categories)
      const payload = {
        daily_report_id: dailyReport.id,
        category_id: s.categoryId,
        total_sales: Math.max(0, Math.round(s.totalSales || 0)),
        notes: s.notes?.trim() || null,
      };

      if (existing) {
        await runQuery<DbProductSale>(() =>
          client
            .from('product_sales')
            .update({ total_sales: payload.total_sales, notes: payload.notes })
            .eq('id', existing.id)
            .select('*')
            .single()
        );
      } else {
        await runQuery<DbProductSale>(() =>
          client.from('product_sales').insert(payload).select('*').single()
        );
      }
    }

    return this.getReport(establishmentId, dateString);
  }

  // SAUVEGARDE MODULE 4 : MOBILE MONEY
  async saveMoneyModule(
    establishmentId: string,
    dateString: string,
    accounts: MoneyAccountInput[],
    noActivity = false
  ): Promise<DailyReportSummary> {
    if (!noActivity) {
      for (const acc of accounts) {
        for (const mov of acc.movements || []) {
          if (mov.movementType !== 'other_electronic' && mov.movementType !== 'other_cash') {
            throw new Error(
              'Seuls les mouvements de type "Autre électronique" ou "Autre cash" sont autorisés.'
            );
          }
          if (mov.direction !== 'in' && mov.direction !== 'out') {
            throw new Error('La direction du mouvement Mobile Money doit être Entrée ou Sortie.');
          }
          if (!mov.notes || !mov.notes.trim()) {
            throw new Error(
              'Chaque mouvement exceptionnel Mobile Money doit comporter un motif obligatoire.'
            );
          }
        }
      }
    }

    if (isDevLocalMode && !isSupabaseConfigured) {
      const existing = storageService.getReportByDate(dateString);
      const updated = calculateDailyReportSummary({
        ...existing,
        reportDate: dateString,
        status: existing.status === 'closed' ? 'closed' : 'in_progress',
        office: existing.office,
        telecomBalances: existing.telecom.networks as unknown as Record<
          TelecomNetwork,
          NetworkBalanceInput
        >,
        telecomOptions: {
          hasSavedEntry: existing.telecom.hasSavedEntry,
          noActivity: existing.telecom.noActivity,
        },
        productSales: existing.products.sales,
        productsOptions: {
          hasSavedEntry: existing.products.hasSavedEntry,
          noActivity: existing.products.noActivity,
        },
        moneyAccounts: noActivity ? [] : accounts,
        moneyOptions: { hasSavedEntry: !noActivity, noActivity },
      });
      storageService.saveReport(updated);
      return updated;
    }

    const client = assertSupabaseClient();
    const dailyReport = await this.ensureDailyReport(establishmentId, dateString);

    await runQuery<DbDailyReport>(() =>
      client
        .from('daily_reports')
        .update({ money_no_activity: Boolean(noActivity) })
        .eq('id', dailyReport.id)
        .eq('establishment_id', establishmentId)
        .select('*')
        .single()
    );

    const existingReports =
      (await runQuery<DbMoneyReport[] | null>(() =>
        client.from('money_reports').select('*').eq('daily_report_id', dailyReport.id)
      )) ?? [];

    if (noActivity) {
      const mrIds = existingReports.map((mr) => mr.id);
      if (mrIds.length > 0) {
        await runQuery<null>(() =>
          client.from('money_movements').delete().in('money_report_id', mrIds)
        );
        await runQuery<null>(() => client.from('money_reports').delete().in('id', mrIds));
      }
      return this.getReport(establishmentId, dateString);
    }

    const existingMrIds = existingReports.map((mr) => mr.id);
    const existingMovements =
      existingMrIds.length > 0
        ? (await runQuery<DbMoneyMovement[] | null>(() =>
            client.from('money_movements').select('*').in('money_report_id', existingMrIds)
          )) ?? []
        : [];

    for (const acc of accounts) {
      const existingRow = existingReports.find((mr) => mr.account_id === acc.accountId);

      // Ne jamais envoyer theoretical_e_balance, e_balance_diff, theoretical_cash ni cash_diff
      const reportPayload = {
        daily_report_id: dailyReport.id,
        account_id: acc.accountId,
        initial_e_balance: Math.max(0, Math.round(acc.initialEBalance || 0)),
        final_e_balance: Math.max(0, Math.round(acc.finalEBalance || 0)),
        initial_cash: Math.max(0, Math.round(acc.initialCash || 0)),
        final_cash: Math.max(0, Math.round(acc.finalCash || 0)),
        total_deposits: Math.max(0, Math.round(acc.totalDeposits || 0)),
        total_withdrawals: Math.max(0, Math.round(acc.totalWithdrawals || 0)),
        commissions_received: Math.max(0, Math.round(acc.commissionsReceived || 0)),
        earned_commissions: Math.max(0, Math.round(acc.earnedCommissions || 0)),
        notes: acc.notes?.trim() || null,
      };

      let savedReport: DbMoneyReport;
      if (existingRow) {
        savedReport = await runQuery<DbMoneyReport>(() =>
          client
            .from('money_reports')
            .update(reportPayload)
            .eq('id', existingRow.id)
            .select('*')
            .single()
        );
      } else {
        savedReport = await runQuery<DbMoneyReport>(() =>
          client.from('money_reports').insert(reportPayload).select('*').single()
        );
      }

      // Synchronisation des mouvements exceptionnels ('other_electronic' | 'other_cash')
      const dbMovementsForAccount = existingMovements.filter(
        (m) => m.money_report_id === savedReport.id
      );
      const keptPersistedIds = new Set(
        (acc.movements || []).filter((m) => m.isPersisted && m.id).map((m) => m.id as string)
      );

      const idsToDelete = dbMovementsForAccount
        .filter((m) => !keptPersistedIds.has(m.id))
        .map((m) => m.id);

      if (idsToDelete.length > 0) {
        await runQuery<null>(() =>
          client.from('money_movements').delete().in('id', idsToDelete)
        );
      }

      const newMovements = (acc.movements || [])
        .filter((m) => !m.isPersisted && m.amount > 0)
        .map((m) => ({
          money_report_id: savedReport.id,
          movement_type: m.movementType as MoneyMovementType,
          direction: m.direction as MoneyMovementDirection,
          amount: Math.max(0, Math.round(m.amount)),
          notes: m.notes.trim(),
        }));

      if (newMovements.length > 0) {
        await runQuery<DbMoneyMovement[] | null>(() =>
          client.from('money_movements').insert(newMovements).select('*')
        );
      }
    }

    return this.getReport(establishmentId, dateString);
  }

  // CLÔTURE ET RÉOUVERTURE VIA FONCTIONS RPC SERVEUR UNIQUEMENT
  async closeDay(
    establishmentId: string,
    dateString: string,
    reportId?: string | null,
    justification?: string
  ): Promise<DailyReportSummary> {
    if (isDevLocalMode && !isSupabaseConfigured) {
      const existing = storageService.getReportByDate(dateString);
      const closed: DailyReportSummary = {
        ...existing,
        status: 'closed',
        closedAt: new Date().toISOString(),
        closedBy: 'Admin (DEV_LOCAL)',
      };
      storageService.saveReport(closed);
      return closed;
    }

    const client = assertSupabaseClient();
    const targetReportId = reportId || (await this.ensureDailyReport(establishmentId, dateString)).id;

    await runRpc(
      () =>
        client.rpc('close_day', {
          p_report_id: targetReportId,
          p_justification: justification?.trim() || null,
        }),
      { preserveBusinessMessage: true }
    );

    return this.getReport(establishmentId, dateString);
  }

  async reopenDay(
    establishmentId: string,
    reportId: string,
    dateString: string,
    justification: string
  ): Promise<DailyReportSummary> {
    if (isDevLocalMode && !isSupabaseConfigured) {
      const existing = storageService.getReportByDate(dateString);
      const reopened: DailyReportSummary = {
        ...existing,
        status: 'in_progress',
        reopenJustification: justification.trim(),
      };
      storageService.saveReport(reopened);
      return reopened;
    }

    const client = assertSupabaseClient();
    await runRpc(
      () =>
        client.rpc('reopen_day', {
          p_report_id: reportId,
          p_justification: justification.trim(),
        }),
      { preserveBusinessMessage: true }
    );

    return this.getReport(establishmentId, dateString);
  }

  // ---------------------------------------------------------------------------
  // 7. RÉSUMÉ VISITEUR SPÉCIAL (LECTURE SEULE STRICTE)
  // ---------------------------------------------------------------------------
  async getVisitorSummary(dateString: string) {
    if (isDevLocalMode && !isSupabaseConfigured) {
      const report = storageService.getReportByDate(dateString);
      return {
        report_date: dateString,
        day_status: report.status,
        office_turnover: report.office.turnover,
        telecom_sold_units: report.telecom.totalSoldUnits,
        products_sold: report.products.totalSales,
        money_commissions: report.money.totalEarnedCommissions,
        total_revenue: report.totalRevenue,
        growth_percentage: 0,
      };
    }

    const client = assertSupabaseClient();
    const data = await runRpc(() =>
      client.rpc('get_visitor_daily_summary', {
        p_report_date: dateString,
      })
    );

    if (Array.isArray(data)) {
      return data.length > 0 ? data[0] : null;
    }

    return data ?? null;
  }

  // ---------------------------------------------------------------------------
  // 8. AUDIT LOGS (LECTURE SEULE STRICTE - ALIMENTÉ PAR TRIGGERS SERVEUR)
  // ---------------------------------------------------------------------------
  async getAuditLogs(establishmentId: string): Promise<DbAuditLog[]> {
    if (isDevLocalMode && !isSupabaseConfigured) {
      return storageService.getAuditLogs();
    }

    const client = assertSupabaseClient();
    const data = await runQuery<DbAuditLog[] | null>(() =>
      client
        .from('audit_logs')
        .select('*')
        .eq('establishment_id', establishmentId)
        .order('timestamp', { ascending: false })
        .limit(100)
    );
    return data ?? [];
  }
}

export const dataService = new DataService();
