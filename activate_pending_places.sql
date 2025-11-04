-- ========================================
-- تفعيل الأماكن المنتظرة (pending)
-- ========================================

-- تفعيل جميع الأماكن المنتظرة
UPDATE providers
SET status = 'active'
WHERE status = 'pending';

-- التحقق من النتيجة
SELECT 
  id,
  name,
  status,
  category,
  city,
  created_at
FROM providers
ORDER BY created_at DESC
LIMIT 10;

