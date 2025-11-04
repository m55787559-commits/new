-- ========================================
-- إصلاح مشكلة status في جدول payments
-- ========================================

-- أولاً: التحقق من القيد الموجود
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.payments'::regclass
    AND conname LIKE '%status%';

-- إذا كان القيد يسمح فقط بقيم معينة (مثل 'pending', 'paid', 'failed')
-- يجب استخدام إحدى هذه القيم

-- خيار 1: تعديل القيد ليتضمن 'completed'
ALTER TABLE payments 
DROP CONSTRAINT IF EXISTS payments_status_check;

-- إنشاء قيد جديد يسمح بقيم أكثر
ALTER TABLE payments 
ADD CONSTRAINT payments_status_check 
CHECK (status IS NULL OR status IN ('pending', 'paid', 'completed', 'failed', 'cancelled', 'success', 'confirmed'));

-- ملاحظة: بعد هذا التعديل، يمكن استخدام 'completed' أو 'paid' في الدالة

