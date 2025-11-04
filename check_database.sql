-- ========================================
-- أوامر SQL للتحقق من البيانات
-- ========================================

-- 1) عرض أول 10 مزودين
SELECT 
  id,
  name,
  category,
  city,
  address,
  phone,
  status,
  image_url,
  description,
  type,
  created_at,
  user_id
FROM providers
ORDER BY created_at DESC
LIMIT 10;

-- ========================================

-- 2) عرض أول 10 خدمات
SELECT 
  id,
  provider_id,
  name,
  description,
  price,
  image_url,
  delivery,
  online,
  created_at
FROM services
ORDER BY created_at DESC
LIMIT 10;

-- ========================================

-- 3) عرض أول 10 إعلانات
SELECT 
  id,
  provider_id,
  service_id,
  title,
  description,
  status,
  created_at
FROM ads
ORDER BY created_at DESC
LIMIT 10;

-- ========================================

-- 4) عدد السجلات في كل جدول
SELECT 
  'providers' AS table_name,
  COUNT(*) AS total_records
FROM providers
UNION ALL
SELECT 
  'services',
  COUNT(*)
FROM services
UNION ALL
SELECT 
  'ads',
  COUNT(*)
FROM ads
UNION ALL
SELECT 
  'activities',
  COUNT(*)
FROM activities;

-- ========================================

-- 5) عرض بيانات مستخدم واحد من providers (للمشاهدة)
SELECT 
  id,
  name,
  status,
  user_id,
  created_at,
  category,
  city
FROM providers
WHERE user_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;

-- ========================================

