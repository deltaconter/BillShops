-- =============================================================================
-- JEU DE DONNÉES INITIAL (SEED) — BILLSHOPS (HOL CORPORATION)
-- =============================================================================

-- 1. Établissement principal
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

-- 2. Catégories de produits Frigos & KongoTerra
INSERT INTO product_categories (id, establishment_id, name, is_active, order_index) VALUES
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Frigo 1 — Sodas & Boissons gazeuses', TRUE, 1),
('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Frigo 2 — Eaux minérales & Jus naturels', TRUE, 2),
('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Produits KongoTerra (Café & Terroir RDC)', TRUE, 3)
ON CONFLICT (id) DO NOTHING;

-- 3. Services et comptes Mobile Money
INSERT INTO money_services (id, establishment_id, name, code, is_active) VALUES
('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Orange Money', 'orange_money', TRUE),
('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'M-Pesa', 'mpesa', FALSE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO money_accounts (id, service_id, account_number, label, is_active) VALUES
('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '+243890001234', 'Compte Principal Caisse Orange Money', TRUE)
ON CONFLICT (id) DO NOTHING;

-- 4. Produits & Tarifs de base de la vitrine
INSERT INTO public_products (id, establishment_id, name, description, category, indicative_price, unit, is_available, order_index) VALUES
('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Impression A4 Noir & Blanc', 'Impression laser rapide recto ou recto-verso', 'Bureautique', 500, 'par page', TRUE, 1),
('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Photocopie haute fidélité', 'Reproduction nette de documents', 'Bureautique', 200, 'par copie', TRUE, 2),
('e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Recharge Orange', 'Crédit d’appel et forfaits internet flash', 'Recharge', 1000, 'carte / flash', TRUE, 3),
('e0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Recharge Airtel', 'Crédit d’appel et forfaits data 4G', 'Recharge', 1000, 'carte / flash', TRUE, 4)
ON CONFLICT (id) DO NOTHING;

-- 5. Publication initiale
INSERT INTO publications (id, establishment_id, title, description, image_url, category, price, status, start_date, order_index) VALUES
('f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Promotion du mois !', 'Bénéficiez de 20% de réduction immédiate sur toutes vos impressions et reliures à partir de 50 pages.', '/src/assets/images/gift_box_promo_1794061962055.jpg', 'promo', NULL, 'published', CURRENT_DATE, 1)
ON CONFLICT (id) DO NOTHING;
