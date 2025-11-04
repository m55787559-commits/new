-- ========================================
-- تحديث دوال packages_workflow لاستخدام جدول subscriptions
-- ========================================

-- حذف الـ views التي تعتمد على الدوال القديمة
DROP VIEW IF EXISTS v_user_summary CASCADE;
DROP VIEW IF EXISTS v_user_active_package CASCADE;

-- تحديث دالة get_user_package لاستخدام subscriptions بدلاً من payments
DROP FUNCTION IF EXISTS get_user_package(uuid);
CREATE OR REPLACE FUNCTION get_user_package(p_user_id uuid)
RETURNS TABLE (
  package_id bigint,
  package_name text,
  duration_days integer,
  started_at timestamptz,
  expires_at timestamptz,
  is_active boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.package_id,
    pkg.name AS package_name,
    pkg.duration_days,
    s.started_at,
    s.expires_at,
    (s.status = 'active' AND (s.expires_at IS NULL OR s.expires_at > NOW())) AS is_active
  FROM subscriptions s
  JOIN packages pkg ON pkg.id = s.package_id
  WHERE s.user_id = p_user_id
    AND s.status = 'active'
    AND (s.expires_at IS NULL OR s.expires_at > NOW())
  ORDER BY s.started_at DESC
  LIMIT 1;
  
  -- إذا لم يوجد اشتراك نشط، إرجاع null
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      NULL::bigint, 
      NULL::text, 
      NULL::integer, 
      NULL::timestamptz, 
      NULL::timestamptz, 
      FALSE::boolean;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- تحديث دالة get_latest_active_payment للبحث في subscriptions
DROP FUNCTION IF EXISTS get_latest_active_payment(uuid);
CREATE OR REPLACE FUNCTION get_latest_active_payment(p_user_id uuid)
RETURNS TABLE (
  payment_id bigint,
  package_id bigint,
  completed_at timestamptz,
  expires_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.payment_id AS payment_id,
    s.package_id,
    s.started_at AS completed_at,
    s.expires_at
  FROM subscriptions s
  WHERE s.user_id = p_user_id
    AND s.status = 'active'
    AND (s.expires_at IS NULL OR s.expires_at > NOW())
  ORDER BY s.started_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- تحديث دالة get_user_place_quota لاستخدام subscriptions
DROP FUNCTION IF EXISTS get_user_place_quota(uuid);
CREATE OR REPLACE FUNCTION get_user_place_quota(p_user_id uuid)
RETURNS TABLE (
  max_places integer,
  tier text
) AS $$
DECLARE
  v_pkg record;
BEGIN
  -- البحث عن اشتراك نشط في subscriptions مع معلومات الباقة
  SELECT pkg.max_places, pkg.name
  INTO v_pkg
  FROM subscriptions s
  JOIN packages pkg ON pkg.id = s.package_id
  WHERE s.user_id = p_user_id
    AND s.status = 'active'
    AND (s.expires_at IS NULL OR s.expires_at > NOW())
  ORDER BY s.started_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 1::integer AS max_places, 'free'::text AS tier;
    RETURN;
  END IF;

  RETURN QUERY SELECT 
    COALESCE(v_pkg.max_places, 1)::integer, 
    COALESCE(v_pkg.name, 'custom')::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- تحديث دالة provider_priority لاستخدام subscriptions
DROP FUNCTION IF EXISTS provider_priority(bigint);
CREATE OR REPLACE FUNCTION provider_priority(p_provider_id bigint)
RETURNS numeric AS $$
DECLARE
  v_user uuid;
  v_created timestamptz;
  v_sub record;
  v_pkg record;
  v_weight int := 0;
  v_recency numeric := 0;
BEGIN
  SELECT user_id, created_at INTO v_user, v_created 
  FROM providers 
  WHERE id = p_provider_id;
  
  IF v_user IS NULL THEN 
    RETURN 0; 
  END IF;

  -- البحث عن اشتراك نشط
  SELECT pkg.priority_weight
  INTO v_pkg
  FROM subscriptions s
  JOIN packages pkg ON pkg.id = s.package_id
  WHERE s.user_id = v_user
    AND s.status = 'active'
    AND (s.expires_at IS NULL OR s.expires_at > NOW())
  ORDER BY s.started_at DESC
  LIMIT 1;
  
  IF FOUND THEN
    v_weight := COALESCE(v_pkg.priority_weight, 0);
  END IF;

  IF v_created IS NOT NULL THEN
    v_recency := GREATEST(0, 30 - EXTRACT(DAY FROM NOW() - v_created));
  END IF;
  
  RETURN v_weight + v_recency;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- إعادة إنشاء view v_user_active_package باستخدام subscriptions
DROP VIEW IF EXISTS v_user_active_package CASCADE;
CREATE OR REPLACE VIEW v_user_active_package AS
WITH users AS (
  SELECT DISTINCT user_id FROM providers WHERE user_id IS NOT NULL
  UNION
  SELECT DISTINCT user_id FROM subscriptions WHERE user_id IS NOT NULL
)
SELECT 
  u.user_id,
  s.package_id,
  pkg.name AS package_name,
  s.started_at,
  s.expires_at,
  (s.status = 'active' AND (s.expires_at IS NULL OR s.expires_at > NOW())) AS is_active
FROM users u
LEFT JOIN LATERAL (
  SELECT s.*
  FROM subscriptions s
  WHERE s.user_id = u.user_id
    AND s.status = 'active'
    AND (s.expires_at IS NULL OR s.expires_at > NOW())
  ORDER BY s.started_at DESC
  LIMIT 1
) s ON TRUE
LEFT JOIN packages pkg ON pkg.id = s.package_id;

-- إعادة إنشاء view v_user_summary (يعتمد على v_user_active_package)
DROP VIEW IF EXISTS v_user_summary CASCADE;
CREATE OR REPLACE VIEW v_user_summary AS
SELECT
  up.id AS user_id,
  up.full_name,
  up.role,
  up.email,
  v.package_id,
  v.package_name,
  v.started_at,
  v.expires_at,
  COALESCE((SELECT count(*) FROM providers p WHERE p.user_id = up.id), 0) AS places_count,
  COALESCE((SELECT count(*) FROM services s 
            JOIN providers p2 ON s.provider_id = p2.id 
            WHERE p2.user_id = up.id), 0) AS services_count
FROM user_profiles up
LEFT JOIN v_user_active_package v ON v.user_id = up.id;
