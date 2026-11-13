-- =============================================================================
-- CAHIER DES CHARGES BILLSHOPS — SCHÉMA POSTGRESQL / SUPABASE (16 TABLES)
-- Éditeur : Hol Corporation
-- Fuseau horaire : Africa/Kinshasa | Devise : FC (Francs Congolais, entiers BIGINT)
-- =============================================================================

-- Extension pour la génération d'UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. TABLE : establishment_settings (Paramètres de l'établissement)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS establishment_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL DEFAULT 'BillShops',
    legal_name VARCHAR(255) NOT NULL DEFAULT 'BillShops SARL - Hol Corporation',
    currency VARCHAR(10) NOT NULL DEFAULT 'FC',
    phone VARCHAR(50) NOT NULL DEFAULT '+243 97 123 4567',
    whatsapp_number VARCHAR(50) NOT NULL DEFAULT '+243971234567',
    email VARCHAR(255) NOT NULL DEFAULT 'contact@billshops.cd',
    address TEXT NOT NULL DEFAULT 'Avenue de la Paix, Gombe',
    city VARCHAR(100) NOT NULL DEFAULT 'Kinshasa, RDC',
    mpesa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Africa/Kinshasa', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Africa/Kinshasa', now())
);

-- -----------------------------------------------------------------------------
-- 2. TABLE : profiles (Profils Administrateurs liés à Supabase Auth)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    establishment_id UUID NOT NULL REFERENCES establishment_settings(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'admin' CHECK (role IN ('admin')),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Africa/Kinshasa', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Africa/Kinshasa', now())
);

-- -----------------------------------------------------------------------------
-- 3. TABLE : special_visitors (Comptes Visiteurs Spéciaux)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS special_visitors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    establishment_id UUID NOT NULL REFERENCES establishment_settings(id) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL UNIQUE,
    pin_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Africa/Kinshasa', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Africa/Kinshasa', now())
);

-- -----------------------------------------------------------------------------
-- 4. TABLE : daily_reports (Rapports journaliers uniques par date)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    establishment_id UUID NOT NULL REFERENCES establishment_settings(id) ON DELETE CASCADE,
    report_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'closed')),
    closed_at TIMESTAMPTZ,
    closed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    reopen_justification TEXT,
    reopened_at TIMESTAMPTZ,
    reopened_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Africa/Kinshasa', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Africa/Kinshasa', now()),
    CONSTRAINT unique_establishment_report_date UNIQUE (establishment_id, report_date)
);

-- -----------------------------------------------------------------------------
-- 5. TABLE : office_reports (Module 1 : Bureautique)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS office_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    daily_report_id UUID NOT NULL UNIQUE REFERENCES daily_reports(id) ON DELETE CASCADE,
    turnover BIGINT NOT NULL DEFAULT 0 CHECK (turnover >= 0),
    expenses BIGINT NOT NULL DEFAULT 0 CHECK (expenses >= 0),
    net_result BIGINT GENERATED ALWAYS AS (turnover - expenses) STORED,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Africa/Kinshasa', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Africa/Kinshasa', now())
);

-- -----------------------------------------------------------------------------
-- 6. TABLE : network_balances (Module 2 : Unités Téléphoniques par réseau)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS network_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    daily_report_id UUID NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
    network VARCHAR(20) NOT NULL CHECK (network IN ('orange', 'airtel', 'africell', 'vodacom')),
    initial_balance BIGINT NOT NULL DEFAULT 0 CHECK (initial_balance >= 0),
    final_balance BIGINT NOT NULL DEFAULT 0 CHECK (final_balance >= 0),
    sold_units BIGINT NOT NULL DEFAULT 0 CHECK (sold_units >= 0),
    cash_collected BIGINT NOT NULL DEFAULT 0 CHECK (cash_collected >= 0),
    discrepancy BIGINT NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Africa/Kinshasa', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Africa/Kinshasa', now()),
    CONSTRAINT unique_daily_report_network UNIQUE (daily_report_id, network)
);

-- -----------------------------------------------------------------------------
-- 7. TABLE : network_movements (Approvisionnements de crédits en cours de journée)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS network_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    network_balance_id UUID NOT NULL REFERENCES network_balances(id) ON DELETE CASCADE,
    supply_amount BIGINT NOT NULL CHECK (supply_amount > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Africa/Kinshasa', now()),
    notes TEXT
);

-- -----------------------------------------------------------------------------
-- 8. TABLE : product_categories (Catégories configurables Frigos & KongoTerra)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    establishment_id UUID NOT NULL REFERENCES establishment_settings(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    order_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Africa/Kinshasa', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Africa/Kinshasa', now())
);

-- -----------------------------------------------------------------------------
-- 9. TABLE : product_sales (Ventes journalières par catégorie)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    daily_report_id UUID NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES product_categories(id) ON DELETE RESTRICT,
    total_sales BIGINT NOT NULL DEFAULT 0 CHECK (total_sales >= 0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Africa/Kinshasa', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Africa/Kinshasa', now()),
    CONSTRAINT unique_report_product_category UNIQUE (daily_report_id, category_id)
);

-- -----------------------------------------------------------------------------
-- 10. TABLE : money_services (Services Mobile Money)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS money_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    establishment_id UUID NOT NULL REFERENCES establishment_settings(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Africa/Kinshasa', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Africa/Kinshasa', now())
);

-- -----------------------------------------------------------------------------
-- 11. TABLE : money_accounts (Comptes / Puces par service Mobile Money)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS money_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES money_services(id) ON DELETE CASCADE,
    account_number VARCHAR(100) NOT NULL,
    label VARCHAR(150) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Africa/Kinshasa', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Africa/Kinshasa', now())
);

-- -----------------------------------------------------------------------------
-- 12. TABLE : money_reports (Synthèse journalière par compte Mobile Money)
-- STRICTE RÈGLE :
-- Dépôt : client remet cash -> caisse + | solde électronique -
-- Retrait : client prend cash -> caisse - | solde électronique +
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS money_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    daily_report_id UUID NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES money_accounts(id) ON DELETE RESTRICT,
    
    -- Portefeuille électronique
    initial_e_balance BIGINT NOT NULL DEFAULT 0 CHECK (initial_e_balance >= 0),
    final_e_balance BIGINT NOT NULL DEFAULT 0 CHECK (final_e_balance >= 0),
    total_deposits BIGINT NOT NULL DEFAULT 0 CHECK (total_deposits >= 0),
    total_withdrawals BIGINT NOT NULL DEFAULT 0 CHECK (total_withdrawals >= 0),
    theoretical_e_balance BIGINT NOT NULL DEFAULT 0,
    e_balance_diff BIGINT NOT NULL DEFAULT 0,
    
    -- Caisse physique
    initial_cash BIGINT NOT NULL DEFAULT 0 CHECK (initial_cash >= 0),
    final_cash BIGINT NOT NULL DEFAULT 0 CHECK (final_cash >= 0),
    earned_commissions BIGINT NOT NULL DEFAULT 0 CHECK (earned_commissions >= 0),
    theoretical_cash BIGINT NOT NULL DEFAULT 0,
    cash_diff BIGINT NOT NULL DEFAULT 0,
    
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Africa/Kinshasa', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Africa/Kinshasa', now()),
    CONSTRAINT unique_daily_report_money_account UNIQUE (daily_report_id, account_id)
);

-- -----------------------------------------------------------------------------
-- 13. TABLE : money_movements (Mouvements détaillés et ajustements exceptionnels)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS money_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    money_report_id UUID NOT NULL REFERENCES money_reports(id) ON DELETE CASCADE,
    movement_type VARCHAR(50) NOT NULL CHECK (movement_type IN ('deposit', 'withdrawal', 'adjustment', 'commission_payout')),
    amount BIGINT NOT NULL CHECK (amount > 0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Africa/Kinshasa', now())
);

-- -----------------------------------------------------------------------------
-- 14. TABLE : publications (Annonces et promotions de la vitrine)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS publications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    establishment_id UUID NOT NULL REFERENCES establishment_settings(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    image_url TEXT,
    category VARCHAR(50) NOT NULL DEFAULT 'promo' CHECK (category IN ('promo', 'announcement', 'service', 'news')),
    price BIGINT CHECK (price IS NULL OR price >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    order_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Africa/Kinshasa', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Africa/Kinshasa', now())
);

-- -----------------------------------------------------------------------------
-- 15. TABLE : public_products (Catalogue et tarifs publics administrables)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    establishment_id UUID NOT NULL REFERENCES establishment_settings(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    indicative_price BIGINT NOT NULL CHECK (indicative_price >= 0),
    unit VARCHAR(50) NOT NULL DEFAULT 'par page',
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    order_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Africa/Kinshasa', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Africa/Kinshasa', now())
);

-- -----------------------------------------------------------------------------
-- 16. TABLE : audit_logs (Journal d'audit immuable des opérations sensibles)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    establishment_id UUID NOT NULL REFERENCES establishment_settings(id) ON DELETE CASCADE,
    user_id UUID,
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    record_id TEXT,
    old_data JSONB,
    new_data JSONB,
    justification TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('Africa/Kinshasa', now()),
    ip_address VARCHAR(50)
);

-- -----------------------------------------------------------------------------
-- INDEX DE PERFORMANCE
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON daily_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_daily_reports_status ON daily_reports(status);
CREATE INDEX IF NOT EXISTS idx_publications_status_dates ON publications(status, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_public_products_available ON public_products(is_available, order_index);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
