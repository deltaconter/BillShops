/**
 * Schéma de types TypeScript pour les tables PostgreSQL Supabase de BillShops
 */

export interface DbEstablishment {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface DbEstablishmentSettings {
  id: string;
  establishment_id: string;
  name: string;
  legal_name: string | null;
  currency: string; // 'FC' par défaut
  phone: string | null;
  whatsapp_number: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  mpesa_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbProfile {
  id: string; // FK auth.users
  establishment_id: string;
  role: 'admin' | 'visitor';
  full_name: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbSpecialVisitor {
  id: string;
  establishment_id: string;
  username: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbDailyReport {
  id: string;
  establishment_id: string;
  report_date: string; // YYYY-MM-DD
  status: 'draft' | 'in_progress' | 'closed';
  office_no_activity: boolean;
  telecom_no_activity: boolean;
  products_no_activity: boolean;
  money_no_activity: boolean;
  closed_at: string | null;
  closed_by: string | null;
  reopen_justification: string | null;
  reopened_at: string | null;
  reopened_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbOfficeReport {
  id: string;
  daily_report_id: string;
  turnover: number;
  expenses: number;
  net_result: number; // Calculé par la base
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbNetworkBalance {
  id: string;
  daily_report_id: string;
  network: 'orange' | 'airtel' | 'africell' | 'vodacom';
  initial_balance: number;
  final_balance: number;
  total_supplies: number; // Calculé par la base
  sold_units: number; // Calculé par la base (peut être négatif en cas d'anomalie)
  cash_collected: number;
  discrepancy: number; // Calculé par la base
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbNetworkMovement {
  id: string;
  network_balance_id: string;
  supply_amount: number;
  created_at: string;
  notes: string | null;
}

export interface DbProductCategory {
  id: string;
  establishment_id: string;
  name: string;
  is_active: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface DbProductSale {
  id: string;
  daily_report_id: string;
  category_id: string;
  category_name: string | null; // Copié par la base depuis product_categories
  total_sales: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbMoneyService {
  id: string;
  establishment_id: string;
  name: string; // 'Orange Money', 'M-Pesa'
  code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbMoneyAccount {
  id: string;
  service_id: string;
  account_number: string;
  label: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbMoneyReport {
  id: string;
  daily_report_id: string;
  account_id: string;
  initial_e_balance: number;
  final_e_balance: number;
  initial_cash: number;
  final_cash: number;
  total_deposits: number;
  total_withdrawals: number;
  commissions_received: number;
  earned_commissions: number; // Commissions conservées
  theoretical_e_balance: number; // Calculé par la base
  theoretical_cash: number; // Calculé par la base
  e_balance_diff: number; // Calculé par la base
  cash_diff: number; // Calculé par la base
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbMoneyMovement {
  id: string;
  money_report_id: string;
  movement_type: 'other_electronic' | 'other_cash';
  direction: 'in' | 'out';
  amount: number;
  notes: string;
  created_at: string;
}

export interface DbPublication {
  id: string;
  establishment_id: string;
  title: string;
  description: string;
  image_url: string | null;
  category: 'promo' | 'announcement' | 'service' | 'news';
  price: number | null;
  status: 'draft' | 'published' | 'archived';
  start_date: string;
  end_date: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface DbPublicProduct {
  id: string;
  establishment_id: string;
  name: string;
  description: string | null;
  category: string;
  indicative_price: number;
  unit: string; // Ex: 'par page', 'canette', 'carte'
  is_available: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface DbAuditLog {
  id: string;
  establishment_id: string;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  justification: string | null;
  timestamp: string;
  ip_address: string | null;
}
