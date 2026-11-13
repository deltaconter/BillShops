/**
 * Types financiers et règles de calcul - BillShops (Hol Corporation)
 * Tous les montants en Francs Congolais (FC) sont gérés sous forme d'entiers (BIGINT).
 */

export type TelecomNetwork = 'orange' | 'airtel' | 'africell' | 'vodacom';

export const TELECOM_NETWORKS: { id: TelecomNetwork; name: string; color: string; bgBadge: string }[] = [
  { id: 'orange', name: 'Orange', color: '#EA580C', bgBadge: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  { id: 'airtel', name: 'Airtel', color: '#EF4444', bgBadge: 'bg-red-500/15 text-red-400 border-red-500/30' },
  { id: 'africell', name: 'Africell', color: '#A855F7', bgBadge: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  { id: 'vodacom', name: 'Vodacom', color: '#E11D48', bgBadge: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
];

export type DayStatus = 'draft' | 'in_progress' | 'closed';

/**
 * 1. Module Bureautique
 * Résultat net = CA - Dépenses (calculé côté serveur en production)
 */
export interface OfficeCalculationInput {
  turnover: number;
  expenses: number;
  notes?: string;
}

export interface OfficeCalculationResult {
  turnover: number;
  expenses: number;
  netResult: number;
  notes?: string;
  hasSavedEntry?: boolean;
  noActivity?: boolean;
}

/**
 * 2. Module Unités Téléphoniques
 * Unités vendues = Solde initial + Approvisionnements - Solde final (peut être négatif : anomalie)
 * Écart = Encaissement réel - Valeur des unités vendues
 */
export interface NetworkMovementInput {
  id?: string;
  amount: number;
  time?: string;
  notes?: string;
  createdAt?: string;
  isPersisted?: boolean;
}

export interface NetworkBalanceInput {
  id?: string;
  network: TelecomNetwork;
  initialBalance: number;
  supplies: NetworkMovementInput[];
  finalBalance: number;
  cashCollected: number;
  notes?: string;
  serverTotals?: {
    totalSupplies: number;
    soldUnits: number;
    discrepancy: number;
  };
}

export interface NetworkBalanceResult {
  id?: string;
  network: TelecomNetwork;
  initialBalance: number;
  totalSupplies: number;
  finalBalance: number;
  soldUnits: number;
  cashCollected: number;
  discrepancy: number; // cashCollected - soldUnits
  hasDiscrepancy: boolean;
  hasNegativeSoldUnits: boolean;
  supplies: NetworkMovementInput[];
  notes?: string;
}

export interface TelecomModuleResult {
  networks: Record<TelecomNetwork, NetworkBalanceResult>;
  totalInitialBalance: number;
  totalSupplies: number;
  totalFinalBalance: number;
  totalSoldUnits: number;
  totalCashCollected: number;
  totalDiscrepancy: number;
  hasAnyDiscrepancy: boolean;
  hasNegativeSoldUnits: boolean;
  hasSavedEntry?: boolean;
  noActivity?: boolean;
}

/**
 * 3. Module Frigos et Produits KongoTerra
 */
export interface ProductCategoryItem {
  id: string;
  name: string;
  isActive: boolean;
  orderIndex: number;
}

export interface ProductSaleInput {
  categoryId: string;
  categoryName: string;
  totalSales: number;
  notes?: string;
}

export interface ProductModuleResult {
  sales: ProductSaleInput[];
  totalSales: number;
  hasSavedEntry?: boolean;
  noActivity?: boolean;
}

/**
 * 4. Module Mobile Money
 * RÈGLE COMPTABLE STRICTE (Du point de vue de l'établissement) :
 * - Dépôt client : Le client remet du cash physique -> Caisse physique AUGMENTE (+), Solde électronique DIMINUE (-).
 * - Retrait client : Le client reçoit du cash physique -> Caisse physique DIMINUE (-), Solde électronique AUGMENTE (+).
 * - money_movements ne contient QUE 'other_electronic' / 'other_cash' (direction 'in' / 'out', notes obligatoires).
 */
export type MoneyMovementType = 'other_electronic' | 'other_cash';
export type MoneyMovementDirection = 'in' | 'out';

export interface MoneyMovementInput {
  id?: string;
  movementType: MoneyMovementType;
  direction: MoneyMovementDirection;
  amount: number;
  notes: string;
  createdAt?: string;
  isPersisted?: boolean;
}

export interface MoneyAccountInput {
  reportId?: string;
  accountId: string;
  serviceId: string;
  serviceName: string; // Ex: 'Orange Money', 'M-Pesa'
  accountLabel: string;
  initialEBalance: number;
  finalEBalance: number;
  initialCash: number;
  finalCash: number;
  totalDeposits: number;
  totalWithdrawals: number;
  commissionsReceived: number;
  earnedCommissions: number; // Commissions conservées
  movements?: MoneyMovementInput[];
  notes?: string;
  hasSavedReport?: boolean;
  serverCalculated?: {
    theoreticalEBalance: number;
    eBalanceDiscrepancy: number;
    theoreticalCash: number;
    cashDiscrepancy: number;
  };
}

export interface MoneyAccountResult {
  reportId?: string;
  accountId: string;
  serviceId: string;
  serviceName: string;
  accountLabel: string;

  // Portefeuille électronique
  initialEBalance: number;
  totalDeposits: number;
  totalWithdrawals: number;
  theoreticalEBalance: number;
  finalEBalance: number;
  eBalanceDiscrepancy: number;

  // Caisse physique & commissions
  initialCash: number;
  commissionsReceived: number;
  earnedCommissions: number;
  theoreticalCash: number;
  finalCash: number;
  cashDiscrepancy: number;

  movements: MoneyMovementInput[];
  hasSavedReport?: boolean;
  hasDiscrepancy: boolean;
  notes?: string;
}

export interface MoneyModuleResult {
  accounts: MoneyAccountResult[];
  totalDepositsVolume: number;
  totalWithdrawalsVolume: number;
  totalCommissionsReceived: number;
  totalEarnedCommissions: number;
  totalCashDiscrepancy: number;
  totalEBalanceDiscrepancy: number;
  hasAnyDiscrepancy: boolean;
  hasSavedEntry?: boolean;
  noActivity?: boolean;
}

/**
 * Synthèse globale de la journée (Rapport Journalier)
 */
export interface DailyReportSummary {
  id?: string | null;
  establishmentId?: string;
  reportDate: string; // YYYY-MM-DD
  status: DayStatus;

  office: OfficeCalculationResult;
  telecom: TelecomModuleResult;
  products: ProductModuleResult;
  money: MoneyModuleResult;

  // Total des recettes d'exploitation
  totalRevenue: number;

  // Alertes globales
  hasAnyDiscrepancy: boolean;
  isFullyEntered: boolean;
  closedAt?: string;
  closedBy?: string;
  reopenJustification?: string;
}
