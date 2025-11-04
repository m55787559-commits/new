-- ========================================
-- إصلاح القيمة الافتراضية لـ role في user_profiles
-- ========================================

-- تعديل القيمة الافتراضية لعمود role ليكون 'user' بدلاً من NULL أو أي قيمة أخرى
ALTER TABLE user_profiles 
ALTER COLUMN role SET DEFAULT 'user';

-- تحديث جميع المستخدمين الذين ليس لديهم role إلى 'user'
UPDATE user_profiles 
SET role = 'user' 
WHERE role IS NULL OR role = '';

-- ملاحظة: إذا كان هناك مستخدمون يجب أن يكونوا 'owner'، يجب تحديثهم يدوياً
-- لا تقم بتحديث المستخدمين الذين لديهم role = 'owner' أو 'admin' إلا إذا كنت متأكداً

