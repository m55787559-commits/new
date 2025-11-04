-- ========================================
-- دوال إدارة الاشتراكات (Subscriptions Management Functions)
-- تستخدم جدول subscriptions الجديد
-- ========================================

-- إضافة عمود payment_receipt_url إلى جدول payments إذا لم يكن موجوداً
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS payment_receipt_url text;

-- 1. دالة إنشاء اشتراك جديد (للمستخدمين العاديين)
DROP FUNCTION IF EXISTS create_user_subscription(bigint);
CREATE OR REPLACE FUNCTION create_user_subscription(p_package_id bigint)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_price numeric;
  v_duration_days integer;
  v_subscription_id bigint;
  v_package_exists boolean;
  v_package_active boolean;
  v_package_name text;
  v_result jsonb;
  v_has_active_subscription boolean;
  v_current_package_name text;
  v_current_places_count integer;
  v_new_max_places integer;
  v_excess_places integer;
BEGIN
  -- إعدادات الدفع العامة (موحّدة) - عدّل القيم هنا وسيتم تطبيقها في كل المواضع
  -- أو بدلاً من ذلك، أنشئ جدولاً باسم payment_settings واقرأ منه
  -- للاختصار هنا نستخدم jsonb ثابت ويمكنك تعديل القيم أدناه
  -- تنبيه: نفس القيم تُستخدم أيضاً في get_payment_instructions
  -- إذا رغبت بفصلها لكل باقة، يمكن توسيع هذه القيم بناءً على p_package_id
  -- مثال: SELECT ... INTO v_payment_info FROM payment_settings WHERE package_id = p_package_id
  -- القيم الحالية:
  -- bank_name: اسم البنك
  -- bank_account: رقم الحساب
  -- account_name: اسم صاحب الحساب
  -- mobile_wallet: رقم المحفظة الإلكترونية
  -- instructions: تعليمات إضافية للمستخدم
  
  
  -- التحقق من وجود المستخدم المسجل
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'يجب تسجيل الدخول أولاً';
  END IF;

  -- التحقق من وجود المستخدم في user_profiles وإنشاؤه إذا لم يكن موجوداً
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = v_user_id) THEN
    INSERT INTO user_profiles(id, full_name, role, created_at)
    VALUES (
      v_user_id, 
      'مستخدم جديد',
      'user',
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- التحقق من وجود الباقة وأنها نشطة
  SELECT 
    EXISTS(SELECT 1 FROM packages WHERE id = p_package_id), 
    COALESCE(is_active, false),
    price,
    duration_days,
    name
  INTO 
    v_package_exists, 
    v_package_active, 
    v_price,
    v_duration_days,
    v_package_name
  FROM packages 
  WHERE id = p_package_id;

  IF NOT v_package_exists THEN
    RAISE EXCEPTION 'الباقة المحددة غير موجودة';
  END IF;

  IF NOT v_package_active THEN
    RAISE EXCEPTION 'الباقة المحددة غير نشطة';
  END IF;

  -- التحقق من عدم وجود اشتراك معلق للباقة نفسها
  IF EXISTS (
    SELECT 1 FROM subscriptions 
    WHERE user_id = v_user_id 
    AND package_id = p_package_id 
    AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'لديك اشتراك معلق بالفعل في هذه الباقة';
  END IF;

  -- إلغاء جميع الطلبات المعلقة الأخرى (إذا أراد المستخدم باقة مختلفة)
  -- هذا منطقي لأن المستخدم يبدو أنه غير رأيه أو يريد باقة أخرى
  UPDATE subscriptions
  SET status = 'cancelled',
      notes = COALESCE(notes || E'\n', '') || 'تم الإلغاء تلقائياً عند إنشاء طلب اشتراك جديد في باقة أخرى.'
  WHERE user_id = v_user_id
    AND status = 'pending'
    AND package_id != p_package_id;

  -- التحقق من وجود اشتراك نشط في باقة أخرى
  -- نسمح بالاشتراك لكن سنضيف ملاحظة في الرسالة
  SELECT EXISTS(
    SELECT 1 FROM subscriptions 
    WHERE user_id = v_user_id 
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > NOW())
  ) INTO v_has_active_subscription;
  
  IF v_has_active_subscription THEN
    SELECT pkg.name INTO v_current_package_name
    FROM subscriptions s
    JOIN packages pkg ON pkg.id = s.package_id
    WHERE s.user_id = v_user_id 
    AND s.status = 'active'
    AND (s.expires_at IS NULL OR s.expires_at > NOW())
    ORDER BY s.started_at DESC
    LIMIT 1;
  ELSE
    v_current_package_name := NULL;
  END IF;

  -- التحقق من عدد الأماكن الحالية والحد الأقصى في الباقة الجديدة
  SELECT COUNT(*) INTO v_current_places_count
  FROM providers
  WHERE user_id = v_user_id AND status = 'active';

  -- جلب الحد الأقصى المسموح في الباقة الجديدة
  SELECT COALESCE(max_places, 1) INTO v_new_max_places
  FROM packages
  WHERE id = p_package_id;

  -- حساب عدد الأماكن الزائدة (إن وجدت)
  IF v_current_places_count > v_new_max_places THEN
    v_excess_places := v_current_places_count - v_new_max_places;
  ELSE
    v_excess_places := 0;
  END IF;

  -- إنشاء اشتراك جديد بحالة pending
  INSERT INTO subscriptions(
    user_id, 
    package_id, 
    status, 
    amount,
    created_at
  )
  VALUES (
    v_user_id, 
    p_package_id, 
    'pending', 
    v_price,
    NOW()
  )
  RETURNING id INTO v_subscription_id;
  
  -- إرجاع معلومات الاشتراك مع معلومات حساب الدفع
  v_result := jsonb_build_object(
    'subscription_id', v_subscription_id,
    'package_id', p_package_id,
    'package_name', v_package_name,
    'amount', v_price,
    'status', 'pending',
    'has_active_subscription', COALESCE(v_has_active_subscription, false),
    'current_package_name', COALESCE(v_current_package_name, NULL),
    'message', CASE 
      WHEN v_excess_places > 0 THEN 
        'تم إنشاء طلب الاشتراك بنجاح. ⚠️ تحذير: لديك ' || v_current_places_count || ' أماكن نشطة حالياً، والباقة الجديدة (' || v_package_name || ') تسمح بـ ' || v_new_max_places || ' أماكن فقط. سيتم تعطيل ' || v_excess_places || ' مكان تلقائياً عند التفعيل (الأقدم أولاً).'
      WHEN COALESCE(v_has_active_subscription, false) THEN 
        'تم إنشاء طلب الاشتراك بنجاح. لديك باقة نشطة حالياً (' || COALESCE(v_current_package_name, 'باقة نشطة') || '). عند التفعيل، سيتم تقييم الباقة الجديدة.'
      ELSE 
        'تم إنشاء طلب الاشتراك بنجاح. يرجى الدفع ثم انتظار التفعيل من الإدارة.'
    END,
    'places_warning', CASE 
      WHEN v_excess_places > 0 THEN 
        jsonb_build_object(
          'has_warning', true,
          'current_places', v_current_places_count,
          'max_places_allowed', v_new_max_places,
          'excess_places', v_excess_places,
          'message', 'سيتم تعطيل ' || v_excess_places || ' مكان تلقائياً عند التفعيل'
        )
      ELSE 
        jsonb_build_object('has_warning', false)
    END,
    'payment_info', get_payment_settings()
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. دالة لجلب جميع الاشتراكات المعلقة (للمدير)
DROP FUNCTION IF EXISTS admin_get_pending_subscriptions();
CREATE OR REPLACE FUNCTION admin_get_pending_subscriptions()
RETURNS TABLE (
  subscription_id bigint,
  user_id uuid,
  user_name text,
  user_email text,
  package_id bigint,
  package_name text,
  amount numeric,
  status text,
  created_at timestamptz,
  payment_id bigint,
  payment_receipt_url text,
  notes text
) AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  -- التحقق من صلاحيات المدير
  SELECT EXISTS(
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() AND role IN ('admin','owner')
  ) INTO v_is_admin;
  
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;

  RETURN QUERY
  SELECT 
    s.id AS subscription_id,
    s.user_id,
    COALESCE(up.full_name, 'مستخدم غير معروف') AS user_name,
    COALESCE(
      (SELECT email::text FROM auth.users WHERE id = s.user_id LIMIT 1),
      NULL
    ) AS user_email,
    s.package_id,
    pkg.name AS package_name,
    s.amount,
    s.status,
    s.created_at,
    s.payment_id,
    p.payment_receipt_url,
    s.notes
  FROM subscriptions s
  LEFT JOIN user_profiles up ON up.id = s.user_id
  LEFT JOIN packages pkg ON pkg.id = s.package_id
  LEFT JOIN payments p ON p.id = s.payment_id
  WHERE s.status = 'pending'
  ORDER BY s.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1-bis. دالة إرشادات الدفع بدون إنشاء اشتراك (متاحة للجميع)
DROP FUNCTION IF EXISTS get_payment_instructions(bigint);
CREATE OR REPLACE FUNCTION get_payment_instructions(p_package_id bigint)
RETURNS jsonb AS $$
DECLARE
  v_price numeric;
  v_package_name text;
  v_exists boolean;
  v_is_active boolean;
  v_result jsonb;
BEGIN
  SELECT EXISTS(SELECT 1 FROM packages WHERE id = p_package_id), COALESCE(is_active, false), price, name
  INTO v_exists, v_is_active, v_price, v_package_name
  FROM packages
  WHERE id = p_package_id;

  IF NOT v_exists THEN
    RAISE EXCEPTION 'الباقة غير موجودة';
  END IF;

  IF NOT v_is_active THEN
    RAISE EXCEPTION 'الباقة غير نشطة';
  END IF;

  v_result := jsonb_build_object(
    'package_id', p_package_id,
    'package_name', v_package_name,
    'amount', v_price,
    'status', 'info',
    'message', 'هذه معلومات دفع فقط. لن يتم إنشاء اشتراك إلا بعد الضغط على "اشترك الآن" ثم إتمام الدفع. بعد الدفع، سيتم التفعيل بواسطة الإدارة.',
    'payment_info', get_payment_settings()
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- دالة موحّدة لإرجاع إعدادات الدفع (عدّل القيم هنا)
DROP FUNCTION IF EXISTS get_payment_settings();
CREATE OR REPLACE FUNCTION get_payment_settings()
RETURNS jsonb AS $$
DECLARE
  v_row record;
BEGIN
  -- قراءة من جدول الإعدادات إن وُجد
  IF to_regclass('public.payment_settings') IS NOT NULL THEN
    SELECT * INTO v_row
    FROM payment_settings
    ORDER BY updated_at DESC
    LIMIT 1;
  END IF;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'bank_account', v_row.bank_account,
      'bank_name', v_row.bank_name,
      'account_name', v_row.account_name,
      'mobile_wallet', v_row.mobile_wallet,
      'instructions', v_row.instructions
    );
  ELSE
    -- قيم افتراضية كاحتياط
    RETURN jsonb_build_object(
      'bank_account', '1234567890',
      'bank_name', 'البنك الأهلي المصري',
      'account_name', 'شركة نيو بان',
      'mobile_wallet', '01012345678',
      'instructions', 'يرجى إرسال صورة إيصال الدفع عبر الواتساب على: 01012345678'
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- إنشاء جدول payment_settings إن لم يكن موجوداً
CREATE TABLE IF NOT EXISTS public.payment_settings (
  id bigserial primary key,
  bank_name text,
  bank_account text,
  account_name text,
  mobile_wallet text,
  instructions text,
  updated_at timestamptz default now()
);

-- تفعيل RLS وإضافة سياسات مبسطة
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payment_settings' AND policyname='Admins can manage payment settings'
  ) THEN
    CREATE POLICY "Admins can manage payment settings"
      ON public.payment_settings
      FOR ALL
      USING (
        EXISTS(SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','owner'))
      )
      WITH CHECK (
        EXISTS(SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','owner'))
      );
  END IF;
END $$;

-- دالة مدير لتحديث الإعدادات (Upsert آخر سجل)
DROP FUNCTION IF EXISTS admin_upsert_payment_settings(text, text, text, text, text);
CREATE OR REPLACE FUNCTION admin_upsert_payment_settings(
  p_bank_name text,
  p_bank_account text,
  p_account_name text,
  p_mobile_wallet text,
  p_instructions text
)
RETURNS jsonb AS $$
DECLARE
  v_is_admin boolean;
  v_id bigint;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','owner')
  ) INTO v_is_admin;

  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;

  INSERT INTO payment_settings (
    bank_name, bank_account, account_name, mobile_wallet, instructions, updated_at
  ) VALUES (
    p_bank_name, p_bank_account, p_account_name, p_mobile_wallet, p_instructions, NOW()
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. دالة لتفعيل الاشتراك (للمدير)
DROP FUNCTION IF EXISTS admin_activate_subscription(bigint, bigint);
CREATE OR REPLACE FUNCTION admin_activate_subscription(
  p_subscription_id bigint,
  p_payment_id bigint DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_is_admin boolean;
  v_subscription record;
  v_package record;
  v_payment_id bigint;
  v_result jsonb;
  v_current_places_count integer;
  v_max_places_allowed integer;
  v_excess_places integer;
  v_deactivated_count integer := 0;
  v_warning_message text := '';
BEGIN
  -- التحقق من صلاحيات المدير
  SELECT EXISTS(
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() AND role IN ('admin','owner')
  ) INTO v_is_admin;
  
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;

  -- جلب معلومات الاشتراك
  SELECT s.*, pkg.duration_days
  INTO v_subscription
  FROM subscriptions s
  JOIN packages pkg ON pkg.id = s.package_id
  WHERE s.id = p_subscription_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الاشتراك غير موجود';
  END IF;

  IF v_subscription.status != 'pending' THEN
    RAISE EXCEPTION 'الاشتراك ليس في حالة انتظار. الحالة الحالية: %', v_subscription.status;
  END IF;

  -- إذا تم تمرير payment_id، استخدمه. وإلا أنشئ payment جديد
  IF p_payment_id IS NOT NULL THEN
    -- التحقق من وجود payment
    IF NOT EXISTS (SELECT 1 FROM payments WHERE id = p_payment_id) THEN
      RAISE EXCEPTION 'دفعة غير موجودة';
    END IF;
    v_payment_id := p_payment_id;
  ELSE
    -- إنشاء payment جديد
    INSERT INTO payments(
      user_id, 
      package_id, 
      status, 
      amount, 
      completed_at
    )
    VALUES (
      v_subscription.user_id, 
      v_subscription.package_id, 
      'completed', 
      v_subscription.amount, 
      NOW()
    )
    RETURNING id INTO v_payment_id;
  END IF;

  -- تفعيل الاشتراك
  UPDATE subscriptions
  SET 
    status = 'active',
    payment_id = v_payment_id,
    started_at = NOW(),
    expires_at = NOW() + make_interval(days => COALESCE(v_subscription.duration_days, 30))
  WHERE id = p_subscription_id;

  -- تحديث payment بالاشتراك إذا لم يكن مربوطاً
  UPDATE payments
  SET status = 'completed',
      completed_at = NOW()
  WHERE id = v_payment_id;

  -- إلغاء أي اشتراكات معلقة أخرى لنفس المستخدم والباقة
  UPDATE subscriptions
  SET status = 'cancelled',
      notes = COALESCE(notes || E'\n', '') || 'تم الإلغاء تلقائياً عند تفعيل اشتراك آخر.'
  WHERE user_id = v_subscription.user_id
    AND package_id = v_subscription.package_id
    AND status = 'pending'
    AND id != p_subscription_id;

  -- إذا كان لديه باقة نشطة أخرى، إلغاؤها تلقائياً عند تفعيل الباقة الجديدة
  UPDATE subscriptions
  SET status = 'cancelled',
      expires_at = NOW(),
      notes = COALESCE(notes || E'\n', '') || 'تم الإلغاء تلقائياً عند تفعيل باقة جديدة (' || (SELECT name FROM packages WHERE id = v_subscription.package_id) || ').'
  WHERE user_id = v_subscription.user_id
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > NOW())
    AND id != p_subscription_id;

  -- التحقق من عدد الأماكن والحد الأقصى المسموح به في الباقة الجديدة
  -- جلب عدد الأماكن الحالية للمستخدم
  SELECT COUNT(*) INTO v_current_places_count
  FROM providers
  WHERE user_id = v_subscription.user_id;

  -- جلب الحد الأقصى المسموح في الباقة الجديدة
  SELECT COALESCE(max_places, 1) INTO v_max_places_allowed
  FROM packages
  WHERE id = v_subscription.package_id;

  -- إذا كان لديه أماكن أكثر من المسموح
  IF v_current_places_count > v_max_places_allowed THEN
    v_excess_places := v_current_places_count - v_max_places_allowed;
    
    -- تعطيل الأماكن الإضافية (الأقدم أولاً)
    UPDATE providers
    SET status = 'pending',
        updated_at = NOW()
    WHERE user_id = v_subscription.user_id
      AND status = 'active'
      AND id IN (
        SELECT id FROM providers
        WHERE user_id = v_subscription.user_id
          AND status = 'active'
        ORDER BY created_at ASC  -- الأقدم أولاً
        LIMIT v_excess_places
      );
    
    GET DIAGNOSTICS v_deactivated_count = ROW_COUNT;
    
    -- إضافة ملاحظة للاشتراك
    UPDATE subscriptions
    SET notes = COALESCE(notes || E'\n', '') || 
                E'⚠️ تنبيه: تم تعطيل ' || v_deactivated_count || 
                ' مكان تلقائياً لأن الباقة الجديدة تسمح بـ ' || v_max_places_allowed || 
                ' أماكن فقط، وكان لديه ' || v_current_places_count || ' أماكن نشطة.'
    WHERE id = p_subscription_id;
    
    v_warning_message := ' تم تعطيل ' || v_deactivated_count || ' مكان تلقائياً (كان لديه ' || 
                         v_current_places_count || ' أماكن والباقة الجديدة تسمح بـ ' || 
                         v_max_places_allowed || ' فقط).';
  END IF;

  -- إرجاع رسالة النجاح
  v_result := jsonb_build_object(
    'success', true,
    'message', 'تم تفعيل الاشتراك بنجاح.' || COALESCE(v_warning_message, ''),
    'subscription_id', p_subscription_id,
    'payment_id', v_payment_id,
    'user_id', v_subscription.user_id,
    'package_id', v_subscription.package_id,
    'started_at', NOW(),
    'expires_at', NOW() + make_interval(days => COALESCE(v_subscription.duration_days, 30)),
    'places_deactivated', COALESCE(v_deactivated_count, 0),
    'warning', CASE WHEN v_deactivated_count > 0 THEN v_warning_message ELSE NULL END
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. دالة لإلغاء الاشتراك المعلق (للمدير)
DROP FUNCTION IF EXISTS admin_cancel_subscription(bigint, text);
CREATE OR REPLACE FUNCTION admin_cancel_subscription(
  p_subscription_id bigint, 
  p_reason text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_is_admin boolean;
  v_subscription record;
  v_result jsonb;
BEGIN
  -- التحقق من صلاحيات المدير
  SELECT EXISTS(
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() AND role IN ('admin','owner')
  ) INTO v_is_admin;
  
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;

  -- جلب معلومات الاشتراك
  SELECT * INTO v_subscription
  FROM subscriptions
  WHERE id = p_subscription_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الاشتراك غير موجود';
  END IF;

  IF v_subscription.status NOT IN ('pending', 'active') THEN
    RAISE EXCEPTION 'لا يمكن إلغاء اشتراك بهذه الحالة. الحالة الحالية: %', v_subscription.status;
  END IF;

  -- إلغاء الاشتراك
  UPDATE subscriptions
  SET 
    status = 'cancelled',
    notes = COALESCE(notes || E'\n', '') || COALESCE('سبب الإلغاء: ' || p_reason, 'تم الإلغاء من قبل المدير')
  WHERE id = p_subscription_id;

  -- إلغاء payment المرتبط إن وجد
  IF v_subscription.payment_id IS NOT NULL THEN
    UPDATE payments
    SET status = 'cancelled'
    WHERE id = v_subscription.payment_id;
  END IF;

  -- إرجاع رسالة النجاح
  v_result := jsonb_build_object(
    'success', true,
    'message', 'تم إلغاء الاشتراك بنجاح',
    'subscription_id', p_subscription_id,
    'reason', p_reason
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. دالة لجلب جميع الاشتراكات مع التفاصيل (للمدير)
DROP FUNCTION IF EXISTS admin_get_all_subscriptions(text, integer, integer);
CREATE OR REPLACE FUNCTION admin_get_all_subscriptions(
  p_status_filter text DEFAULT NULL,
  p_limit_val integer DEFAULT 100,
  p_offset_val integer DEFAULT 0
)
RETURNS TABLE (
  subscription_id bigint,
  user_id uuid,
  user_name text,
  user_email text,
  package_id bigint,
  package_name text,
  amount numeric,
  status text,
  started_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz,
  payment_id bigint,
  auto_renew boolean,
  notes text
) AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  -- التحقق من صلاحيات المدير
  SELECT EXISTS(
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() AND role IN ('admin','owner')
  ) INTO v_is_admin;
  
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;

  RETURN QUERY
  SELECT 
    s.id AS subscription_id,
    s.user_id,
    COALESCE(up.full_name, 'مستخدم غير معروف') AS user_name,
    COALESCE(
      (SELECT email::text FROM auth.users WHERE id = s.user_id LIMIT 1),
      NULL
    ) AS user_email,
    s.package_id,
    pkg.name AS package_name,
    s.amount,
    s.status,
    s.started_at,
    s.expires_at,
    s.created_at,
    s.payment_id,
    s.auto_renew,
    s.notes
  FROM subscriptions s
  LEFT JOIN user_profiles up ON up.id = s.user_id
  LEFT JOIN packages pkg ON pkg.id = s.package_id
  WHERE (p_status_filter IS NULL OR s.status = p_status_filter)
  ORDER BY s.created_at DESC
  LIMIT p_limit_val
  OFFSET p_offset_val;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. دالة للحصول على اشتراك المستخدم النشط
DROP FUNCTION IF EXISTS get_user_active_subscription(uuid);
CREATE OR REPLACE FUNCTION get_user_active_subscription(p_user_id uuid)
RETURNS TABLE (
  subscription_id bigint,
  package_id bigint,
  package_name text,
  duration_days integer,
  started_at timestamptz,
  expires_at timestamptz,
  is_active boolean,
  status text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id AS subscription_id,
    s.package_id,
    pkg.name AS package_name,
    pkg.duration_days,
    s.started_at,
    s.expires_at,
    (s.status = 'active' AND (s.expires_at IS NULL OR s.expires_at > NOW())) AS is_active,
    s.status
  FROM subscriptions s
  JOIN packages pkg ON pkg.id = s.package_id
  WHERE s.user_id = p_user_id
    AND s.status = 'active'
    AND (s.expires_at IS NULL OR s.expires_at > NOW())
  ORDER BY s.started_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. دالة لتحديث حالة الاشتراكات المنتهية تلقائياً (يمكن تشغيلها كـ cron job)
DROP FUNCTION IF EXISTS update_expired_subscriptions();
CREATE OR REPLACE FUNCTION update_expired_subscriptions()
RETURNS integer AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE subscriptions
  SET status = 'expired'
  WHERE status = 'active'
    AND expires_at IS NOT NULL
    AND expires_at < NOW();
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. دالة لربط payment موجود بالاشتراك (للاستخدام مع الدفع الإلكتروني)
DROP FUNCTION IF EXISTS link_payment_to_subscription(bigint, bigint);
CREATE OR REPLACE FUNCTION link_payment_to_subscription(
  p_subscription_id bigint,
  p_payment_id bigint
)
RETURNS jsonb AS $$
DECLARE
  v_subscription record;
  v_payment record;
  v_user_id uuid;
  v_result jsonb;
BEGIN
  -- التحقق من وجود الاشتراك
  SELECT * INTO v_subscription
  FROM subscriptions
  WHERE id = p_subscription_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الاشتراك غير موجود';
  END IF;

  -- التحقق من وجود payment
  SELECT * INTO v_payment
  FROM payments
  WHERE id = p_payment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الدفعة غير موجودة';
  END IF;

  -- التحقق من أن payment مكتمل
  IF v_payment.status != 'completed' THEN
    RAISE EXCEPTION 'الدفعة ليست مكتملة. الحالة: %', v_payment.status;
  END IF;

  -- التحقق من أن الاشتراك والدفعة لنفس المستخدم
  IF v_subscription.user_id != v_payment.user_id THEN
    RAISE EXCEPTION 'الاشتراك والدفعة ليسا لنفس المستخدم';
  END IF;

  -- ربط payment بالاشتراك
  UPDATE subscriptions
  SET payment_id = p_payment_id
  WHERE id = p_subscription_id;

  v_result := jsonb_build_object(
    'success', true,
    'message', 'تم ربط الدفعة بالاشتراك بنجاح',
    'subscription_id', p_subscription_id,
    'payment_id', p_payment_id
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ملاحظات:
-- 1. جدول subscriptions منفصل عن payments ويمكن ربطه بـ payment عند الحاجة
-- 2. عند تفعيل الدفع الإلكتروني، يمكن إنشاء payment أولاً ثم ربطه بالاشتراك
-- 3. دالة update_expired_subscriptions يمكن تشغيلها كـ cron job لتحديث الاشتراكات المنتهية تلقائياً
-- 4. جميع الدوال تستخدم security definer لضمان التنفيذ الآمن

