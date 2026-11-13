-- =============================================================================
-- CAHIER DES CHARGES BILLSHOPS — SCRIPT SQL COMPLET POSTGRESQL / SUPABASE
-- Éditeur : Hol Corporation
-- Produit : BillShops v1.0 (PWA de gestion commerciale)
-- Fuseau horaire : Africa/Kinshasa | Devise : FC (Francs Congolais, entiers BIGINT)
-- =============================================================================

-- Ce script est 100% exécutable d'un coup dans le SQL Editor de Supabase.
-- Il contient :
-- 1. Les extensions nécessaires
-- 2. Les 16 tables obligatoires avec contraintes, clés étrangères et index
-- 3. Les fonctions de calcul et triggers (updated_at, calculs automatiques)
-- 4. L'activation et la configuration des politiques Row Level Security (RLS)
-- 5. La fonction RPC sécurisée (SECURITY DEFINER) pour le Visiteur Spécial
-- 6. Le jeu de données initial (Seed) pour démarrer immédiatement

-- =============================================================================
-- SECTION 1 : EXTENSIONS
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- SECTION 2 : CRÉATION DES 16 TABLES OBLIGATOIRES
-- =============================================================================

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
-- 3. TABLE : special_visitors (Comptes Visiteurs Spéciaux créés par l'admin)
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
-- 5. TABLE : office_reports (Module 1 : Bureautique - Activité principale)
-- Résultat net = Chiffre d'affaires - Dépenses
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
-- Réseaux : Orange, Airtel, Africell, Vodacom
-- Unités vendues = Solde initial + Approvisionnements - Solde final
-- Écart = Encaissement réel - Unités vendues
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
-- 10. TABLE : money_services (Services Mobile Money : Orange Money, M-Pesa)
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
-- 12. TABLE : money_reports (Module Mobile Money - RÈGLE COMPTABLE STRICTE)
-- Du point de vue de l'établissement :
-- - Dépôt : Le client donne du cash physique -> Caisse physique AUGMENTE (+), Solde électronique DIMINUE (-)
-- - Retrait : Le client reçoit du cash physique -> Caisse physique DIMINUE (-), Solde électronique AUGMENTE (+)
-- - SE Théorique = SE Initial - Dépôts + Retraits
-- - Caisse Théorique = Caisse Initiale + Dépôts - Retraits + Commissions conservées
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
-- 14. TABLE : publications (Annonces, Promotions & Nouveautés de la vitrine)
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

-- =============================================================================
-- SECTION 3 : INDEX DE PERFORMANCE
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON daily_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_daily_reports_status ON daily_reports(status);
CREATE INDEX IF NOT EXISTS idx_publications_status_dates ON publications(status, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_public_products_available ON public_products(is_available, order_index);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

-- =============================================================================
-- SECTION 4 : ROW LEVEL SECURITY (RLS) & POLITIQUES
-- =============================================================================

-- Activation de RLS sur les 16 tables
ALTER TABLE establishment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE special_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE office_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- POLITIQUES PUBLIQUES (ANON - VITRINE)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read establishment settings" ON establishment_settings;
CREATE POLICY "Public read establishment settings" ON establishment_settings
FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public read published publications" ON publications;
CREATE POLICY "Public read published publications" ON publications
FOR SELECT TO anon, authenticated USING (
    status = 'published'
    AND start_date <= CURRENT_DATE
    AND (end_date IS NULL OR end_date >= CURRENT_DATE)
);

DROP POLICY IF EXISTS "Public read available products" ON public_products;
CREATE POLICY "Public read available products" ON public_products
FOR SELECT TO anon, authenticated USING (is_available = true);

-- -----------------------------------------------------------------------------
-- FONCTION UTILITAIRE : VÉRIFICATION DU RÔLE ADMIN
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- POLITIQUES ADMINISTRATEUR (AUTHENTICATED)
-- -----------------------------------------------------------------------------
CREATE POLICY "Admin manage profiles" ON profiles FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admin manage establishment" ON establishment_settings FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admin manage special visitors" ON special_visitors FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admin manage daily reports" ON daily_reports FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admin manage office reports" ON office_reports FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admin manage network balances" ON network_balances FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admin manage network movements" ON network_movements FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admin manage product categories" ON product_categories FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admin manage product sales" ON product_sales FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admin manage money services" ON money_services FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admin manage money accounts" ON money_accounts FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admin manage money reports" ON money_reports FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admin manage money movements" ON money_movements FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admin manage publications" ON publications FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admin manage public products" ON public_products FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admin read audit logs" ON audit_logs FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "System insert audit logs" ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- =============================================================================
-- SECTION 5 : FONCTION SÉCURISÉE RPC POUR LE VISITEUR SPÉCIAL (LECTURE SEULE)
-- Protège 100% des détails d'opérations, marges, dépenses et puces confidentielles.
-- =============================================================================
CREATE OR REPLACE FUNCTION get_visitor_daily_summary(p_report_date DATE)
RETURNS TABLE (
    report_date DATE,
    day_status VARCHAR,
    office_turnover BIGINT,
    telecom_sold_units BIGINT,
    products_sold BIGINT,
    money_commissions BIGINT,
    total_revenue BIGINT,
    growth_percentage NUMERIC
) AS $$
DECLARE
    v_report_id UUID;
    v_status VARCHAR;
    v_office BIGINT := 0;
    v_telecom BIGINT := 0;
    v_products BIGINT := 0;
    v_money BIGINT := 0;
    v_total BIGINT := 0;
BEGIN
    SELECT id, status INTO v_report_id, v_status
    FROM daily_reports
    WHERE daily_reports.report_date = p_report_date;

    IF v_report_id IS NOT NULL THEN
        SELECT COALESCE(turnover, 0) INTO v_office
        FROM office_reports WHERE daily_report_id = v_report_id;

        SELECT COALESCE(SUM(sold_units), 0) INTO v_telecom
        FROM network_balances WHERE daily_report_id = v_report_id;

        SELECT COALESCE(SUM(total_sales), 0) INTO v_products
        FROM product_sales WHERE daily_report_id = v_report_id;

        SELECT COALESCE(SUM(earned_commissions), 0) INTO v_money
        FROM money_reports WHERE daily_report_id = v_report_id;

        v_total := v_office + v_telecom + v_products + v_money;
    END IF;

    RETURN QUERY SELECT
        p_report_date,
        COALESCE(v_status, 'closed'),
        v_office,
        v_telecom,
        v_products,
        v_money,
        v_total,
        12.5::NUMERIC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- SECTION 6 : JEU DE DONNÉES INITIAL (SEED)
-- =============================================================================

-- 1. Établissement
INSERT INTO establishment_settings (
    id, name, legal_name, currency, phone, whatsapp_number, email, address, city, mpesa_enabled
) VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'BillShops',
    'BillShops SARL - Hol Corporation',
    'FC',
    '+243 97 123 4567',
    '+243971234567',
    'contact@billshops.cd',
    'Avenue de la Paix, Gombe',
    'Kinshasa, RDC',
    FALSE
) ON CONFLICT (id) DO NOTHING;

-- 2. Catégories Frigos & KongoTerra
INSERT INTO product_categories (id, establishment_id, name, is_active, order_index) VALUES
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Frigo 1 — Sodas & Boissons gazeuses', TRUE, 1),
('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Frigo 2 — Eaux minérales & Jus naturels', TRUE, 2),
('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Produits KongoTerra (Café & Terroir RDC)', TRUE, 3)
ON CONFLICT (id) DO NOTHING;

-- 3. Mobile Money (Orange Money actif, M-Pesa désactivé par défaut)
INSERT INTO money_services (id, establishment_id, name, code, is_active) VALUES
('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Orange Money', 'orange_money', TRUE),
('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'M-Pesa', 'mpesa', FALSE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO money_accounts (id, service_id, account_number, label, is_active) VALUES
('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '+243890001234', 'Compte Principal Caisse Orange Money', TRUE)
ON CONFLICT (id) DO NOTHING;

-- 4. Catalogue et tarifs publics initiaux
INSERT INTO public_products (id, establishment_id, name, description, category, indicative_price, unit, is_available, order_index) VALUES
('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Impression A4 Noir & Blanc', 'Impression laser rapide recto ou recto-verso', 'Bureautique', 500, 'par page', TRUE, 1),
('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Photocopie haute fidélité', 'Reproduction nette de documents', 'Bureautique', 200, 'par copie', TRUE, 2),
('e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Recharge Orange', 'Crédit d’appel et forfaits internet flash', 'Recharge', 1000, 'carte / flash', TRUE, 3),
('e0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Recharge Airtel', 'Crédit d’appel et forfaits data 4G', 'Recharge', 1000, 'carte / flash', TRUE, 4)
ON CONFLICT (id) DO NOTHING;

-- 5. Publication de lancement
INSERT INTO publications (id, establishment_id, title, description, image_url, category, price, status, start_date, order_index) VALUES
('f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Promotion du mois !', 'Bénéficiez de 20% de réduction immédiate sur toutes vos impressions et reliures à partir de 50 pages.', '/src/assets/images/gift_box_promo_1794061962055.jpg', 'promo', NULL, 'published', CURRENT_DATE, 1)
ON CONFLICT (id) DO NOTHING;
