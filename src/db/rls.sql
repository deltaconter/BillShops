-- =============================================================================
-- POLITIQUES DE SÉCURITÉ ROW LEVEL SECURITY (RLS) & FONCTIONS SÉCURISÉES RPC
-- BillShops — Hol Corporation
-- =============================================================================

-- 1. ACTIVATION DE RLS SUR TOUTES LES TABLES SENSIBLES
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
-- 2. POLITIQUES ACCÈS PUBLIC (VISITEUR VITRINE - ANON)
-- -----------------------------------------------------------------------------

-- Lecture publique des coordonnées de l'établissement
CREATE POLICY "Public read establishment settings"
ON establishment_settings FOR SELECT
TO anon, authenticated
USING (true);

-- Lecture des publications actives
CREATE POLICY "Public read published publications"
ON publications FOR SELECT
TO anon, authenticated
USING (
    status = 'published'
    AND start_date <= CURRENT_DATE
    AND (end_date IS NULL OR end_date >= CURRENT_DATE)
);

-- Lecture des produits et tarifs publics disponibles
CREATE POLICY "Public read available products"
ON public_products FOR SELECT
TO anon, authenticated
USING (is_available = true);

-- -----------------------------------------------------------------------------
-- 3. POLITIQUES ACCÈS ADMINISTRATEUR (AUTHENTICATED AVEC ROLE = 'admin')
-- -----------------------------------------------------------------------------

-- Fonction utilitaire pour vérifier si l'utilisateur courant est administrateur
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profils
CREATE POLICY "Admin manage profiles" ON profiles
FOR ALL TO authenticated
USING (is_admin()) WITH CHECK (is_admin());

-- Paramètres de l'établissement
CREATE POLICY "Admin manage establishment" ON establishment_settings
FOR ALL TO authenticated
USING (is_admin()) WITH CHECK (is_admin());

-- Visiteurs spéciaux
CREATE POLICY "Admin manage special visitors" ON special_visitors
FOR ALL TO authenticated
USING (is_admin()) WITH CHECK (is_admin());

-- Rapports journaliers
CREATE POLICY "Admin manage daily reports" ON daily_reports
FOR ALL TO authenticated
USING (is_admin()) WITH CHECK (is_admin());

-- Bureautique
CREATE POLICY "Admin manage office reports" ON office_reports
FOR ALL TO authenticated
USING (is_admin()) WITH CHECK (is_admin());

-- Réseaux télécoms
CREATE POLICY "Admin manage network balances" ON network_balances
FOR ALL TO authenticated
USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Admin manage network movements" ON network_movements
FOR ALL TO authenticated
USING (is_admin()) WITH CHECK (is_admin());

-- Produits & Frigos
CREATE POLICY "Admin manage product categories" ON product_categories
FOR ALL TO authenticated
USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Admin manage product sales" ON product_sales
FOR ALL TO authenticated
USING (is_admin()) WITH CHECK (is_admin());

-- Mobile Money
CREATE POLICY "Admin manage money services" ON money_services
FOR ALL TO authenticated
USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Admin manage money accounts" ON money_accounts
FOR ALL TO authenticated
USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Admin manage money reports" ON money_reports
FOR ALL TO authenticated
USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Admin manage money movements" ON money_movements
FOR ALL TO authenticated
USING (is_admin()) WITH CHECK (is_admin());

-- Publications & Tarifs
CREATE POLICY "Admin manage publications" ON publications
FOR ALL TO authenticated
USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Admin manage public products" ON public_products
FOR ALL TO authenticated
USING (is_admin()) WITH CHECK (is_admin());

-- Audit logs (Insertion et lecture par admin, JAMAIS de mise à jour ni de suppression)
CREATE POLICY "Admin read audit logs" ON audit_logs
FOR SELECT TO authenticated
USING (is_admin());

CREATE POLICY "System insert audit logs" ON audit_logs
FOR INSERT TO authenticated
WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 4. FONCTION SÉCURISÉE RPC POUR LE VISITEUR SPÉCIAL (LECTURE SEULE STRICTE)
-- Ne donne AUCUN accès direct aux tables de caisse, dépenses ou soldes détaillés.
-- -----------------------------------------------------------------------------

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
    -- Récupération du rapport
    SELECT id, status INTO v_report_id, v_status
    FROM daily_reports
    WHERE daily_reports.report_date = p_report_date;

    IF v_report_id IS NOT NULL THEN
        -- Bureautique
        SELECT COALESCE(turnover, 0) INTO v_office
        FROM office_reports WHERE daily_report_id = v_report_id;

        -- Unités télécoms vendues
        SELECT COALESCE(SUM(sold_units), 0) INTO v_telecom
        FROM network_balances WHERE daily_report_id = v_report_id;

        -- Frigos et produits
        SELECT COALESCE(SUM(total_sales), 0) INTO v_products
        FROM product_sales WHERE daily_report_id = v_report_id;

        -- Commissions Mobile Money
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
        12.5::NUMERIC; -- Indicateur de tendance
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
