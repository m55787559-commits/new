-- ========================================
-- دوال Supabase المطلوبة للمشروع
-- ========================================

-- 7) دالة لإرجاع ملخص الجداول (اسم الجدول + تقدير عدد الصفوف)
DROP FUNCTION IF EXISTS get_tables_overview() CASCADE;

CREATE OR REPLACE FUNCTION get_tables_overview()
RETURNS TABLE (
  table_name text,
  row_count bigint
) AS $$
  SELECT c.relname::text AS table_name,
         GREATEST(pg_stat.n_live_tup::bigint, 0) AS row_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_stat_all_tables pg_stat ON pg_stat.relid = c.oid
  WHERE n.nspname = 'public'
    AND c.relkind = 'r' -- tables only
    AND c.relname IN (
      'activities','ads','ads_images','ads_videos','affiliates','areas','branches',
      'cities','commissions','dashboard_stats','discount_codes','favorites',
      'interactions','malls','offers','packages','payments','price_history',
      'products','providers','reports','reviews','services','user_profiles','visits'
    )
  ORDER BY c.relname;
$$ LANGUAGE sql SECURITY DEFINER;

-- ========================================

-- 8) دالة لإرجاع قائمة بالدوال العامة المتاحة (الاسم + الوسائط + نوع الإرجاع)
DROP FUNCTION IF EXISTS list_database_functions() CASCADE;

CREATE OR REPLACE FUNCTION list_database_functions()
RETURNS TABLE (
  name text,
  schema text,
  arguments text,
  return_type text
) AS $$
  SELECT
    p.proname::text AS name,
    n.nspname::text AS schema,
    pg_get_function_arguments(p.oid)::text AS arguments,
    pg_get_function_result(p.oid)::text AS return_type
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prokind = 'f' -- functions only
  ORDER BY p.proname;
$$ LANGUAGE sql SECURITY DEFINER;

-- ========================================

-- 9) دالة عامة لمعاينة أي جدول كـ JSON (مع حد أقصى للحجم)
DROP FUNCTION IF EXISTS get_table_preview(text, integer) CASCADE;

CREATE OR REPLACE FUNCTION get_table_preview(
  p_table text,
  p_limit integer DEFAULT 100
)
RETURNS TABLE (item jsonb) AS $$
DECLARE
  v_limit integer;
  v_sql text;
BEGIN
  -- تحديد حد أقصى آمن
  v_limit := LEAST(GREATEST(p_limit, 0), 500);

  -- توليد استعلام آمن بأسماء جداول مقتبسة كمعرّف (%I)
  v_sql := format('SELECT to_jsonb(t) AS item FROM %I t LIMIT %s', p_table, v_limit);

  RETURN QUERY EXECUTE v_sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ملاحظة: يُنصح بتقييد الوصول لهذه الدالة حسب أدوار المسؤولين فقط عبر RLS/Policies.

-- ========================================

-- 1) إسقاط الدالة القديمة إن وجدت وإنشاؤها من جديد
DROP FUNCTION IF EXISTS get_categories CASCADE;

CREATE OR REPLACE FUNCTION get_categories()
RETURNS TABLE (
  id bigint,
  name text,
  description text,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.name,
    a.description,
    a.created_at
  FROM activities a
  ORDER BY a.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================

-- 2) دالة لجلب المزودين
DROP FUNCTION IF EXISTS get_providers CASCADE;

CREATE OR REPLACE FUNCTION get_providers()
RETURNS TABLE (
  id bigint,
  name text,
  category text,
  city text,
  address text,
  phone text,
  website text,
  image_url text,
  description text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.category,
    p.city,
    p.address,
    p.phone,
    p.website,
    p.image_url,
    p.description
  FROM providers p
  WHERE p.status = 'active' OR p.status IS NULL
  ORDER BY p.created_at DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================

-- 3) دالة لجلب الخدمات
DROP FUNCTION IF EXISTS get_services CASCADE;

CREATE OR REPLACE FUNCTION get_services()
RETURNS TABLE (
  id bigint,
  provider_id bigint,
  name text,
  description text,
  price numeric,
  online boolean,
  delivery boolean,
  image_url text,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.provider_id,
    s.name,
    s.description,
    s.price,
    s.online,
    s.delivery,
    s.image_url,
    s.created_at
  FROM services s
  ORDER BY s.created_at DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================

-- 4) دالة لجلب الإعلانات
DROP FUNCTION IF EXISTS get_ads CASCADE;

CREATE OR REPLACE FUNCTION get_ads()
RETURNS TABLE (
  id bigint,
  provider_id bigint,
  service_id bigint,
  title text,
  description text,
  start_date timestamptz,
  end_date timestamptz,
  created_at timestamptz,
  status text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.provider_id,
    a.service_id,
    a.title,
    a.description,
    a.start_date,
    a.end_date,
    a.created_at,
    a.status
  FROM ads a
  WHERE a.status = 'active'
  ORDER BY a.created_at DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================

-- 5) دالة لإضافة مزود جديد
-- إسقاط جميع إصدارات add_provider
DROP FUNCTION IF EXISTS add_provider() CASCADE;
DROP FUNCTION IF EXISTS add_provider(text) CASCADE;
DROP FUNCTION IF EXISTS add_provider(text, text, text, text, text, text, text, text, text, text, numeric, numeric, text, boolean, text, uuid, bigint, bigint) CASCADE;

CREATE OR REPLACE FUNCTION add_provider(
  p_name text,
  p_category text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_website text DEFAULT NULL,
  p_whatsapp text DEFAULT NULL,
  p_map_url text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_image_url text DEFAULT NULL,
  p_lat numeric DEFAULT NULL,
  p_lng numeric DEFAULT NULL,
  p_type text DEFAULT NULL,
  p_delivery boolean DEFAULT false,
  p_area text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_activity_id bigint DEFAULT NULL,
  p_package_id bigint DEFAULT NULL
)
RETURNS bigint AS $$
DECLARE
  v_id bigint;
BEGIN
  INSERT INTO providers (
    name,
    category,
    city,
    address,
    phone,
    website,
    whatsapp,
    map_url,
    description,
    image_url,
    lat,
    lng,
    type,
    delivery,
    area,
    user_id,
    activity_id,
    package_id,
    status,
    created_at
  ) VALUES (
    p_name,
    p_category,
    p_city,
    p_address,
    p_phone,
    p_website,
    p_whatsapp,
    p_map_url,
    p_description,
    p_image_url,
    p_lat,
    p_lng,
    p_type,
    p_delivery,
    p_area,
    p_user_id,
    p_activity_id,
    p_package_id,
    'pending',
    NOW()
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================

-- 6) دالة لإضافة خدمة جديدة
-- إسقاط جميع إصدارات add_service
DROP FUNCTION IF EXISTS add_service() CASCADE;
DROP FUNCTION IF EXISTS add_service(bigint, text, numeric, text, text, boolean, boolean) CASCADE;

CREATE OR REPLACE FUNCTION add_service(
  p_provider_id bigint,
  p_name text,
  p_price numeric DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_image_url text DEFAULT NULL,
  p_delivery boolean DEFAULT false,
  p_online boolean DEFAULT false
)
RETURNS bigint AS $$
DECLARE
  v_id bigint;
BEGIN
  INSERT INTO services (
    provider_id,
    name,
    description,
    price,
    image_url,
    delivery,
    online,
    created_at
  ) VALUES (
    p_provider_id,
    p_name,
    p_description,
    p_price,
    p_image_url,
    p_delivery,
    p_online,
    NOW()
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
