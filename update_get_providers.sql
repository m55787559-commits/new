-- ========================================
-- تعديل دالة get_providers لعرض جميع الأماكن
-- ========================================

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
  description text,
  status text,
  priority numeric
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
    p.description,
    p.status,
    provider_priority(p.id) as priority
  FROM providers p
  WHERE coalesce(p.status, 'pending') = 'active'
  ORDER BY provider_priority(p.id) DESC, p.created_at DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

