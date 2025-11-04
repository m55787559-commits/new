-- ========================================
-- دوال التعديل والحذف
-- ========================================

-- 1) دالة لتعديل مزود
CREATE OR REPLACE FUNCTION update_provider(
  p_id bigint,
  p_name text DEFAULT NULL,
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
  p_delivery boolean DEFAULT NULL,
  p_area text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS boolean AS $$
BEGIN
  UPDATE providers
  SET 
    name = COALESCE(p_name, name),
    category = COALESCE(p_category, category),
    city = COALESCE(p_city, city),
    address = COALESCE(p_address, address),
    phone = COALESCE(p_phone, phone),
    website = COALESCE(p_website, website),
    whatsapp = COALESCE(p_whatsapp, whatsapp),
    map_url = COALESCE(p_map_url, map_url),
    description = COALESCE(p_description, description),
    image_url = COALESCE(p_image_url, image_url),
    lat = COALESCE(p_lat, lat),
    lng = COALESCE(p_lng, lng),
    type = COALESCE(p_type, type),
    delivery = COALESCE(p_delivery, delivery),
    area = COALESCE(p_area, area),
    updated_at = NOW()
  WHERE id = p_id
    AND (p_user_id IS NULL OR user_id = p_user_id);
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================

-- 2) دالة لحذف مزود
CREATE OR REPLACE FUNCTION delete_provider(
  p_id bigint,
  p_user_id uuid DEFAULT NULL
)
RETURNS boolean AS $$
BEGIN
  DELETE FROM providers
  WHERE id = p_id
    AND (p_user_id IS NULL OR user_id = p_user_id);
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================

-- 3) دالة لتعديل خدمة
CREATE OR REPLACE FUNCTION update_service(
  p_id bigint,
  p_name text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_price numeric DEFAULT NULL,
  p_image_url text DEFAULT NULL,
  p_delivery boolean DEFAULT NULL,
  p_online boolean DEFAULT NULL
)
RETURNS boolean AS $$
BEGIN
  UPDATE services
  SET 
    name = COALESCE(p_name, name),
    description = COALESCE(p_description, description),
    price = COALESCE(p_price, price),
    image_url = COALESCE(p_image_url, image_url),
    delivery = COALESCE(p_delivery, delivery),
    online = COALESCE(p_online, online)
  WHERE id = p_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================

-- 4) دالة لحذف خدمة
CREATE OR REPLACE FUNCTION delete_service(
  p_id bigint
)
RETURNS boolean AS $$
BEGIN
  DELETE FROM services WHERE id = p_id;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================

-- 5) دالة لجلب مزود واحد (للتعديل)
CREATE OR REPLACE FUNCTION get_provider_by_id(
  p_id bigint
)
RETURNS TABLE (
  id bigint,
  name text,
  category text,
  city text,
  address text,
  phone text,
  website text,
  whatsapp text,
  map_url text,
  description text,
  image_url text,
  lat numeric,
  lng numeric,
  type text,
  delivery boolean,
  area text,
  user_id uuid,
  activity_id bigint,
  status text,
  created_at timestamptz,
  updated_at timestamptz
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
    p.whatsapp,
    p.map_url,
    p.description,
    p.image_url,
    p.lat,
    p.lng,
    p.type,
    p.delivery,
    p.area,
    p.user_id,
    p.activity_id,
    p.status,
    p.created_at,
    p.updated_at
  FROM providers p
  WHERE p.id = p_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================

-- 6) دالة لجلب خدمة واحدة (للتعديل)
CREATE OR REPLACE FUNCTION get_service_by_id(
  p_id bigint
)
RETURNS TABLE (
  id bigint,
  provider_id bigint,
  name text,
  description text,
  price numeric,
  image_url text,
  delivery boolean,
  online boolean,
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
    s.image_url,
    s.delivery,
    s.online,
    s.created_at
  FROM services s
  WHERE s.id = p_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================

