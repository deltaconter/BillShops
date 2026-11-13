/**
 * Moteur d'affichage et de prévisualisation financière - BillShops (Hol Corporation)
 * En production Supabase, les colonnes calculées (net_result, total_supplies, sold_units,
 * discrepancy, theoretical_e_balance, e_balance_diff, theoretical_cash, cash_diff)
 * proviennent directement de la base de données après confirmation serveur.
 */

import {
  OfficeCalculationInput,
  OfficeCalculationResult,
  NetworkBalanceInput,
  NetworkBalanceResult,
  TelecomModuleResult,
  TelecomNetwork,
  ProductSaleInput,
  ProductModuleResult,
  MoneyAccountInput,
  MoneyAccountResult,
  MoneyModuleResult,
  DailyReportSummary,
  DayStatus,
} from '../types/financial';

/**
 * Date du jour au format YYYY-MM-DD dans le fuseau horaire Africa/Kinshasa
 */
export function getKinshasaTodayDateString(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Kinshasa',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Formate un montant entier en devise Franc Congolais (FC)
 * Exemple : 125000 -> "125 000 FC", -5000 -> "-5 000 FC"
 */
export function formatFC(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return '0 FC';
  }
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? '-' : '';
  const absFormatted = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${sign}${absFormatted} FC`;
}

/**
 * Nettoie une chaîne saisie par l'utilisateur pour en extraire un entier positif ou nul
 */
export function parseFC(input: string | number): number {
  if (typeof input === 'number') {
    return Math.max(0, Math.round(input));
  }
  if (!input) return 0;
  const cleaned = input.toString().replace(/[^0-9]/g, '');
  return cleaned ? parseInt(cleaned, 10) : 0;
}

/**
 * 1. Calcul / mapping du module Bureautique
 */
export function calculateOffice(
  input: OfficeCalculationInput & {
    serverNetResult?: number;
    hasSavedEntry?: boolean;
    noActivity?: boolean;
  }
): OfficeCalculationResult {
  const turnover = Math.max(0, Math.round(input.turnover || 0));
  const expenses = Math.max(0, Math.round(input.expenses || 0));
  const netResult =
    typeof input.serverNetResult === 'number' ? Math.round(input.serverNetResult) : turnover - expenses;

  return {
    turnover,
    expenses,
    netResult,
    notes: input.notes,
    hasSavedEntry: input.hasSavedEntry,
    noActivity: input.noActivity,
  };
}

/**
 * 2. Calcul / mapping d'un réseau téléphonique individuel
 * sold_units peut être NÉGATIF : anomalie critique jamais masquée à 0.
 */
export function calculateNetworkBalance(input: NetworkBalanceInput): NetworkBalanceResult {
  const initialBalance = Math.max(0, Math.round(input.initialBalance || 0));
  const finalBalance = Math.max(0, Math.round(input.finalBalance || 0));
  const cashCollected = Math.max(0, Math.round(input.cashCollected || 0));
  const supplies = input.supplies || [];

  const totalSupplies = input.serverTotals
    ? Math.round(input.serverTotals.totalSupplies)
    : supplies.reduce((acc, m) => acc + Math.max(0, Math.round(m.amount || 0)), 0);

  const soldUnits = input.serverTotals
    ? Math.round(input.serverTotals.soldUnits)
    : initialBalance + totalSupplies - finalBalance;

  const discrepancy = input.serverTotals
    ? Math.round(input.serverTotals.discrepancy)
    : cashCollected - soldUnits;

  const hasNegativeSoldUnits = soldUnits < 0;
  const hasDiscrepancy = discrepancy !== 0 || hasNegativeSoldUnits;

  return {
    id: input.id,
    network: input.network,
    initialBalance,
    totalSupplies,
    finalBalance,
    soldUnits,
    cashCollected,
    discrepancy,
    hasDiscrepancy,
    hasNegativeSoldUnits,
    supplies,
    notes: input.notes,
  };
}

/**
 * Calcul global du module Unités Téléphoniques (4 réseaux)
 */
export function calculateTelecomModule(
  balances: Record<TelecomNetwork, NetworkBalanceInput>,
  options?: { hasSavedEntry?: boolean; noActivity?: boolean }
): TelecomModuleResult {
  const networks: Record<TelecomNetwork, NetworkBalanceResult> = {
    orange: calculateNetworkBalance(balances.orange),
    airtel: calculateNetworkBalance(balances.airtel),
    africell: calculateNetworkBalance(balances.africell),
    vodacom: calculateNetworkBalance(balances.vodacom),
  };

  const networkList = Object.values(networks);
  const totalInitialBalance = networkList.reduce((acc, n) => acc + n.initialBalance, 0);
  const totalSupplies = networkList.reduce((acc, n) => acc + n.totalSupplies, 0);
  const totalFinalBalance = networkList.reduce((acc, n) => acc + n.finalBalance, 0);
  const totalSoldUnits = networkList.reduce((acc, n) => acc + n.soldUnits, 0);
  const totalCashCollected = networkList.reduce((acc, n) => acc + n.cashCollected, 0);
  const totalDiscrepancy = networkList.reduce((acc, n) => acc + n.discrepancy, 0);
  const hasNegativeSoldUnits = networkList.some((n) => n.hasNegativeSoldUnits);
  const hasAnyDiscrepancy = networkList.some((n) => n.hasDiscrepancy);

  return {
    networks,
    totalInitialBalance,
    totalSupplies,
    totalFinalBalance,
    totalSoldUnits,
    totalCashCollected,
    totalDiscrepancy,
    hasAnyDiscrepancy,
    hasNegativeSoldUnits,
    hasSavedEntry: options?.hasSavedEntry,
    noActivity: options?.noActivity,
  };
}

/**
 * 3. Calcul du module Frigos et Produits KongoTerra
 */
export function calculateProducts(
  sales: ProductSaleInput[],
  options?: { hasSavedEntry?: boolean; noActivity?: boolean }
): ProductModuleResult {
  const normalizedSales = (sales || []).map((s) => ({
    ...s,
    totalSales: Math.max(0, Math.round(s.totalSales || 0)),
  }));

  const totalSales = normalizedSales.reduce((acc, s) => acc + s.totalSales, 0);

  return {
    sales: normalizedSales,
    totalSales,
    hasSavedEntry: options?.hasSavedEntry,
    noActivity: options?.noActivity,
  };
}

/**
 * 4. Calcul / mapping d'un compte Mobile Money individuel
 */
export function calculateMoneyAccount(account: MoneyAccountInput): MoneyAccountResult {
  const initialEBalance = Math.max(0, Math.round(account.initialEBalance || 0));
  const finalEBalance = Math.max(0, Math.round(account.finalEBalance || 0));
  const initialCash = Math.max(0, Math.round(account.initialCash || 0));
  const finalCash = Math.max(0, Math.round(account.finalCash || 0));
  const totalDeposits = Math.max(0, Math.round(account.totalDeposits || 0));
  const totalWithdrawals = Math.max(0, Math.round(account.totalWithdrawals || 0));
  const commissionsReceived = Math.max(0, Math.round(account.commissionsReceived || 0));
  const earnedCommissions = Math.max(0, Math.round(account.earnedCommissions || 0));
  const movements = account.movements || [];

  const otherElectronicDelta = movements
    .filter((m) => m.movementType === 'other_electronic')
    .reduce((acc, m) => acc + (m.direction === 'in' ? m.amount : -m.amount), 0);

  const otherCashDelta = movements
    .filter((m) => m.movementType === 'other_cash')
    .reduce((acc, m) => acc + (m.direction === 'in' ? m.amount : -m.amount), 0);

  const theoreticalEBalance = account.serverCalculated
    ? Math.round(account.serverCalculated.theoreticalEBalance)
    : initialEBalance - totalDeposits + totalWithdrawals + otherElectronicDelta;

  const eBalanceDiscrepancy = account.serverCalculated
    ? Math.round(account.serverCalculated.eBalanceDiscrepancy)
    : finalEBalance - theoreticalEBalance;

  const theoreticalCash = account.serverCalculated
    ? Math.round(account.serverCalculated.theoreticalCash)
    : initialCash + totalDeposits - totalWithdrawals + earnedCommissions + otherCashDelta;

  const cashDiscrepancy = account.serverCalculated
    ? Math.round(account.serverCalculated.cashDiscrepancy)
    : finalCash - theoreticalCash;

  const hasDiscrepancy = eBalanceDiscrepancy !== 0 || cashDiscrepancy !== 0;

  return {
    reportId: account.reportId,
    accountId: account.accountId,
    serviceId: account.serviceId,
    serviceName: account.serviceName,
    accountLabel: account.accountLabel,
    initialEBalance,
    totalDeposits,
    totalWithdrawals,
    theoreticalEBalance,
    finalEBalance,
    eBalanceDiscrepancy,
    initialCash,
    commissionsReceived,
    earnedCommissions,
    theoreticalCash,
    finalCash,
    cashDiscrepancy,
    movements,
    hasSavedReport: account.hasSavedReport,
    hasDiscrepancy,
    notes: account.notes,
  };
}

/**
 * Calcul global du module Mobile Money (tous comptes confondus)
 */
export function calculateMoneyModule(
  accounts: MoneyAccountInput[],
  options?: { hasSavedEntry?: boolean; noActivity?: boolean }
): MoneyModuleResult {
  const processedAccounts = (accounts || []).map(calculateMoneyAccount);

  const totalDepositsVolume = processedAccounts.reduce((acc, a) => acc + a.totalDeposits, 0);
  const totalWithdrawalsVolume = processedAccounts.reduce((acc, a) => acc + a.totalWithdrawals, 0);
  const totalCommissionsReceived = processedAccounts.reduce(
    (acc, a) => acc + a.commissionsReceived,
    0
  );
  const totalEarnedCommissions = processedAccounts.reduce((acc, a) => acc + a.earnedCommissions, 0);
  const totalCashDiscrepancy = processedAccounts.reduce((acc, a) => acc + a.cashDiscrepancy, 0);
  const totalEBalanceDiscrepancy = processedAccounts.reduce(
    (acc, a) => acc + a.eBalanceDiscrepancy,
    0
  );
  const hasAnyDiscrepancy = processedAccounts.some((a) => a.hasDiscrepancy);

  return {
    accounts: processedAccounts,
    totalDepositsVolume,
    totalWithdrawalsVolume,
    totalCommissionsReceived,
    totalEarnedCommissions,
    totalCashDiscrepancy,
    totalEBalanceDiscrepancy,
    hasAnyDiscrepancy,
    hasSavedEntry: options?.hasSavedEntry,
    noActivity: options?.noActivity,
  };
}

/**
 * Calcul du rapport consolidé de la journée
 */
export function calculateDailyReportSummary(params: {
  id?: string | null;
  establishmentId?: string;
  reportDate: string;
  status: DayStatus;
  office: OfficeCalculationInput & {
    serverNetResult?: number;
    hasSavedEntry?: boolean;
    noActivity?: boolean;
  };
  telecomBalances: Record<TelecomNetwork, NetworkBalanceInput>;
  telecomOptions?: { hasSavedEntry?: boolean; noActivity?: boolean };
  productSales: ProductSaleInput[];
  productsOptions?: { hasSavedEntry?: boolean; noActivity?: boolean };
  moneyAccounts: MoneyAccountInput[];
  moneyOptions?: { hasSavedEntry?: boolean; noActivity?: boolean };
  closedAt?: string;
  closedBy?: string;
  reopenJustification?: string;
}): DailyReportSummary {
  const office = calculateOffice(params.office);
  const telecom = calculateTelecomModule(params.telecomBalances, params.telecomOptions);
  const products = calculateProducts(params.productSales, params.productsOptions);
  const money = calculateMoneyModule(params.moneyAccounts, params.moneyOptions);

  const totalRevenue =
    office.turnover +
    telecom.totalCashCollected +
    products.totalSales +
    money.totalEarnedCommissions;

  const hasAnyDiscrepancy =
    telecom.hasAnyDiscrepancy || telecom.hasNegativeSoldUnits || money.hasAnyDiscrepancy;

  const isFullyEntered = Boolean(
    (office.hasSavedEntry || office.noActivity) &&
      (telecom.hasSavedEntry || telecom.noActivity) &&
      (products.hasSavedEntry || products.noActivity) &&
      (money.hasSavedEntry || money.noActivity)
  );

  return {
    id: params.id,
    establishmentId: params.establishmentId,
    reportDate: params.reportDate,
    status: params.status,
    office,
    telecom,
    products,
    money,
    totalRevenue,
    hasAnyDiscrepancy,
    isFullyEntered,
    closedAt: params.closedAt,
    closedBy: params.closedBy,
    reopenJustification: params.reopenJustification,
  };
}
