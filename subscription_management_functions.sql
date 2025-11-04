-- ========================================
-- دوال إدارة الاشتراكات (Subscription Management)
-- ========================================

-- 1. تعديل دالة الاشتراك لإنشاء payment بحالة pending
drop function if exists create_user_subscription(bigint);
create or replace function create_user_subscription(p_package_id bigint)
returns jsonb as $$
declare
  v_user_id uuid;
  v_price numeric;
  v_id bigint;
  v_package_exists boolean;
  v_package_active boolean;
  v_package_name text;
  v_result jsonb;
begin
  -- التحقق من وجود المستخدم المسجل
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'يجب تسجيل الدخول أولاً';
  end if;

  -- التحقق من وجود المستخدم في user_profiles وإنشاؤه إذا لم يكن موجوداً
  if not exists (select 1 from user_profiles where id = v_user_id) then
    insert into user_profiles(id, full_name, role, created_at)
    values (
      v_user_id, 
      'مستخدم جديد',
      'user',
      now()
    )
    on conflict (id) do nothing;
  end if;

  -- التحقق من وجود الباقة وأنها نشطة
  select exists(select 1 from packages where id = p_package_id), 
         coalesce(is_active, false),
         price,
         name
  into v_package_exists, v_package_active, v_price, v_package_name
  from packages 
  where id = p_package_id;

  if not v_package_exists then
    raise exception 'الباقة المحددة غير موجودة';
  end if;

  if not v_package_active then
    raise exception 'الباقة المحددة غير نشطة';
  end if;

  -- إنشاء اشتراك جديد بحالة pending (في انتظار الدفع)
  insert into payments(user_id, package_id, status, amount, created_at)
  values (v_user_id, p_package_id, 'pending', v_price, now())
  returning id into v_id;

  -- إرجاع معلومات الاشتراك مع معلومات حساب الدفع
  v_result := jsonb_build_object(
    'payment_id', v_id,
    'package_id', p_package_id,
    'package_name', v_package_name,
    'amount', v_price,
    'status', 'pending',
    'message', 'تم إنشاء طلب الاشتراك بنجاح. يرجى الدفع ثم انتظار التفعيل من الإدارة.',
    'payment_info', jsonb_build_object(
      'bank_account', '1234567890',
      'bank_name', 'البنك الأهلي المصري',
      'account_name', 'شركة نيو بان',
      'mobile_wallet', '01012345678',
      'instructions', 'يرجى إرسال صورة إيصال الدفع عبر الواتساب على: 01012345678'
    )
  );

  return v_result;
end;
$$ language plpgsql security definer;

-- 2. دالة لجلب جميع الاشتراكات المعلقة (للمدير)
drop function if exists admin_get_pending_subscriptions();
create or replace function admin_get_pending_subscriptions()
returns table (
  payment_id bigint,
  user_id uuid,
  user_name text,
  user_email text,
  package_id bigint,
  package_name text,
  amount numeric,
  status text,
  created_at timestamptz,
  payment_receipt_url text
) as $$
declare
  v_is_admin boolean;
begin
  -- التحقق من صلاحيات المدير
  select exists(select 1 from user_profiles where id = auth.uid() and role in ('admin','owner')) into v_is_admin;
  if not coalesce(v_is_admin, false) then
    raise exception 'forbidden: admin only';
  end if;

  return query
  select 
    p.id as payment_id,
    p.user_id,
    coalesce(up.full_name, 'مستخدم غير معروف') as user_name,
    au.email as user_email,
    p.package_id,
    pkg.name as package_name,
    p.amount,
    p.status,
    p.created_at,
    p.payment_receipt_url
  from payments p
  left join user_profiles up on up.id = p.user_id
  left join auth.users au on au.id = p.user_id
  left join packages pkg on pkg.id = p.package_id
  where p.status = 'pending'
  order by p.created_at desc;
end;
$$ language plpgsql security definer;

-- 3. دالة لتفعيل الاشتراك (تغيير status من pending إلى completed)
drop function if exists admin_activate_subscription(bigint);
create or replace function admin_activate_subscription(p_payment_id bigint)
returns jsonb as $$
declare
  v_is_admin boolean;
  v_payment record;
  v_result jsonb;
begin
  -- التحقق من صلاحيات المدير
  select exists(select 1 from user_profiles where id = auth.uid() and role in ('admin','owner')) into v_is_admin;
  if not coalesce(v_is_admin, false) then
    raise exception 'forbidden: admin only';
  end if;

  -- جلب معلومات الاشتراك
  select * into v_payment
  from payments
  where id = p_payment_id;

  if not found then
    raise exception 'الاشتراك غير موجود';
  end if;

  if v_payment.status != 'pending' then
    raise exception 'الاشتراك ليس في حالة انتظار. الحالة الحالية: %', v_payment.status;
  end if;

  -- تفعيل الاشتراك (تغيير status إلى completed وتعيين completed_at)
  update payments
  set status = 'completed',
      completed_at = now()
  where id = p_payment_id;

  -- إرجاع رسالة النجاح
  v_result := jsonb_build_object(
    'success', true,
    'message', 'تم تفعيل الاشتراك بنجاح',
    'payment_id', p_payment_id,
    'user_id', v_payment.user_id,
    'package_id', v_payment.package_id,
    'activated_at', now()
  );

  return v_result;
end;
$$ language plpgsql security definer;

-- 4. دالة لإلغاء الاشتراك المعلق (للمدير)
drop function if exists admin_cancel_subscription(bigint, text);
create or replace function admin_cancel_subscription(p_payment_id bigint, p_reason text default null)
returns jsonb as $$
declare
  v_is_admin boolean;
  v_payment record;
  v_result jsonb;
begin
  -- التحقق من صلاحيات المدير
  select exists(select 1 from user_profiles where id = auth.uid() and role in ('admin','owner')) into v_is_admin;
  if not coalesce(v_is_admin, false) then
    raise exception 'forbidden: admin only';
  end if;

  -- جلب معلومات الاشتراك
  select * into v_payment
  from payments
  where id = p_payment_id;

  if not found then
    raise exception 'الاشتراك غير موجود';
  end if;

  if v_payment.status != 'pending' then
    raise exception 'لا يمكن إلغاء اشتراك غير معلق. الحالة الحالية: %', v_payment.status;
  end if;

  -- إلغاء الاشتراك
  update payments
  set status = 'cancelled'
  where id = p_payment_id;

  -- إرجاع رسالة النجاح
  v_result := jsonb_build_object(
    'success', true,
    'message', 'تم إلغاء الاشتراك بنجاح',
    'payment_id', p_payment_id,
    'reason', p_reason
  );

  return v_result;
end;
$$ language plpgsql security definer;

-- 5. دالة لجلب جميع الاشتراكات مع التفاصيل (للمدير)
drop function if exists admin_get_all_subscriptions(text, integer, integer);
create or replace function admin_get_all_subscriptions(
  p_status_filter text default null,
  p_limit_val integer default 100,
  p_offset_val integer default 0
)
returns table (
  payment_id bigint,
  user_id uuid,
  user_name text,
  user_email text,
  package_id bigint,
  package_name text,
  amount numeric,
  status text,
  created_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz
) as $$
declare
  v_is_admin boolean;
begin
  -- التحقق من صلاحيات المدير
  select exists(select 1 from user_profiles where id = auth.uid() and role in ('admin','owner')) into v_is_admin;
  if not coalesce(v_is_admin, false) then
    raise exception 'forbidden: admin only';
  end if;

  return query
  select 
    p.id as payment_id,
    p.user_id,
    coalesce(up.full_name, 'مستخدم غير معروف') as user_name,
    au.email as user_email,
    p.package_id,
    pkg.name as package_name,
    p.amount,
    p.status,
    p.created_at,
    p.completed_at,
    case 
      when p.completed_at is not null and pkg.duration_days is not null 
      then p.completed_at + make_interval(days => pkg.duration_days)
      else null
    end as expires_at
  from payments p
  left join user_profiles up on up.id = p.user_id
  left join auth.users au on au.id = p.user_id
  left join packages pkg on pkg.id = p.package_id
  where (p_status_filter is null or p.status = p_status_filter)
  order by p.created_at desc
  limit p_limit_val
  offset p_offset_val;
end;
$$ language plpgsql security definer;

-- ملاحظات:
-- 1. تأكد من أن جدول payments يحتوي على الحقول التالية:
--    - payment_receipt_url (text, nullable) - رابط صورة إيصال الدفع
-- 2. يمكن تخصيص معلومات حساب الدفع في دالة create_user_subscription
-- 3. الدوال تستخدم security definer لضمان تنفيذها بصلاحيات المدير

