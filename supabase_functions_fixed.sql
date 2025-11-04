-- ========================================
-- دوال Supabase - النسخة المصححة
-- ========================================
-- نفّذ هذا الملف في SQL Editor
-- ========================================

-- حذف جميع الدوال السابقة أولاً
DROP FUNCTION IF EXISTS get_categories() CASCADE;
DROP FUNCTION IF EXISTS get_providers() CASCADE;
DROP FUNCTION IF EXISTS get_services() CASCADE;
DROP FUNCTION IF EXISTS get_ads() CASCADE;
DROP FUNCTION IF EXISTS add_provider(text, text, text, text, text, text, text, text, text, text, numeric, numeric, text, boolean, text, uuid, bigint, bigint) CASCADE;
DROP FUNCTION IF EXISTS add_service(bigint, text, numeric, text, text, boolean, boolean) CASCADE;

-- ========================================
-- 1) دالة لجلب الأنشطة/الفئات
-- ========================================

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
-- ========================================

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
-- ========================================

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
-- ========================================

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
-- ========================================

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
-- ========================================

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
-- تم الانتهاء
-- ========================================

