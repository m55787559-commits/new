-- ========================================
-- إصلاح RLS للباقات: السماح لجميع المستخدمين بمشاهدة الباقات النشطة
-- ========================================

-- إضافة سياسة جديدة للسماح لجميع المستخدمين (المسجلين وغير المسجلين) بمشاهدة الباقات النشطة
do $$
begin
  -- إنشاء سياسة للسماح لجميع المستخدمين بمشاهدة الباقات النشطة فقط
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'packages' 
    and policyname = 'public_can_select_active_packages'
  ) then
    create policy public_can_select_active_packages on public.packages
      for select
      using (is_active = true);
  end if;
end $$;

-- ملاحظة: هذه السياسة تسمح لجميع المستخدمين (بما في ذلك غير المسجلين) بمشاهدة الباقات النشطة فقط
-- المسؤولون سيظلون يستطيعون رؤية جميع الباقات بسبب السياسة admin_can_select_packages

