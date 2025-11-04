-- ========================================
-- التحقق من القيود على جدول payments
-- ========================================

-- عرض جميع القيود على جدول payments
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.payments'::regclass
ORDER BY conname;

-- عرض القيم المحتملة المسموح بها في status
-- إذا كان هناك قيد CHECK، ستظهر هنا

