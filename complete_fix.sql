-- ========================================
-- الحل الكامل لمشكلة status في payments
-- ========================================

-- الخيار 1: تعديل القيد ليشمل 'completed' (موصى به)
-- أولاً: التحقق من القيد الموجود
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.payments'::regclass
    AND conname LIKE '%status%';

-- حذف القيد القديم إذا كان موجوداً
ALTER TABLE payments 
DROP CONSTRAINT IF EXISTS payments_status_check;

-- إنشاء قيد جديد يسمح بقيم أكثر شمولاً
ALTER TABLE payments 
ADD CONSTRAINT payments_status_check 
CHECK (status IS NULL OR status IN ('pending', 'paid', 'completed', 'failed', 'cancelled', 'success', 'confirmed', 'processing'));

-- بعد هذا التعديل، يمكن استخدام 'completed' في الدالة create_user_subscription
-- والدالة get_latest_active_payment ستعمل بشكل صحيح

