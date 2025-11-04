-- ========================================
-- دالة الاشتراك للمستخدمين العاديين
-- ========================================

-- دالة تسمح للمستخدمين العاديين بالاشتراك في الباقات بأنفسهم
drop function if exists create_user_subscription(bigint);
create or replace function create_user_subscription(p_package_id bigint)
returns bigint as $$
declare
  v_user_id uuid;
  v_price numeric;
  v_id bigint;
  v_package_exists boolean;
  v_package_active boolean;
begin
  -- التحقق من وجود المستخدم المسجل
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'يجب تسجيل الدخول أولاً';
  end if;

  -- التحقق من وجود المستخدم في user_profiles وإنشاؤه إذا لم يكن موجوداً
  if not exists (select 1 from user_profiles where id = v_user_id) then
    -- إنشاء المستخدم في user_profiles
    -- ملاحظة: نستخدم اسم افتراضي ونعين role = 'user' كمستخدم عادي
    insert into user_profiles(id, full_name, role, created_at)
    values (
      v_user_id, 
      'مستخدم جديد',
      'user', -- تأكد من أن المستخدمين الجدد يكونوا 'user' وليس 'owner'
      now()
    )
    on conflict (id) do nothing; -- إذا كان موجوداً بالفعل، لا تفعل شيء
  end if;

  -- التحقق من وجود الباقة وأنها نشطة
  select exists(select 1 from packages where id = p_package_id), 
         coalesce(is_active, false)
  into v_package_exists, v_package_active
  from packages 
  where id = p_package_id;

  if not v_package_exists then
    raise exception 'الباقة المحددة غير موجودة';
  end if;

  if not v_package_active then
    raise exception 'الباقة المحددة غير نشطة';
  end if;

  -- جلب سعر الباقة
  select price into v_price from packages where id = p_package_id;

  -- إنشاء اشتراك جديد (payment)
  -- ملاحظة: يجب استخدام 'completed' لأن دالة get_latest_active_payment تبحث عن status = 'completed'
  -- هذا مهم جداً لضمان أن الباقة تظهر للمستخدم بعد الاشتراك
  insert into payments(user_id, package_id, status, completed_at, amount)
  values (v_user_id, p_package_id, 'completed', now(), v_price)
  returning id into v_id;

  return v_id;
end;
$$ language plpgsql security definer;

-- ملاحظة: هذه الدالة تسمح للمستخدمين العاديين بالاشتراك في أي باقة نشطة
-- في نظام حقيقي، يجب إضافة:
-- 1. التحقق من الدفع (paymob, stripe, etc.)
-- 2. معالجة الأخطاء بشكل أفضل
-- 3. إمكانية إلغاء الاشتراك الحالي قبل إنشاء آخر

