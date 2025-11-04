-- ========================================
-- إنشاء جدول الاشتراكات (Subscriptions Table)
-- ========================================

-- إنشاء جدول subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    package_id BIGINT NOT NULL REFERENCES public.packages(id) ON DELETE RESTRICT,
    
    -- معلومات الاشتراك
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'expired', 'cancelled', 'suspended')),
    started_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    
    -- معلومات الدفع
    payment_id BIGINT REFERENCES public.payments(id) ON DELETE SET NULL,
    amount NUMERIC NOT NULL,
    
    -- معلومات إضافية
    auto_renew BOOLEAN DEFAULT FALSE,
    notes TEXT,
    
    -- الطوابع الزمنية
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- فهرس لتحسين الأداء
    CONSTRAINT subscriptions_user_package_unique UNIQUE NULLS NOT DISTINCT (user_id, package_id, status)
);

-- إنشاء الفهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_package_id ON public.subscriptions(package_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expires_at ON public.subscriptions(expires_at);
CREATE INDEX IF NOT EXISTS idx_subscriptions_payment_id ON public.subscriptions(payment_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON public.subscriptions(user_id, status);

-- إنشاء دالة لتحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- إنشاء trigger لتحديث updated_at تلقائياً
DROP TRIGGER IF EXISTS trigger_update_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER trigger_update_subscriptions_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_subscriptions_updated_at();

-- تفعيل RLS (Row Level Security)
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- سياسات RLS للاشتراكات
-- المستخدمون يمكنهم رؤية اشتراكاتهم فقط
CREATE POLICY "Users can view their own subscriptions"
    ON public.subscriptions
    FOR SELECT
    USING (auth.uid() = user_id);

-- المديرون يمكنهم رؤية جميع الاشتراكات
CREATE POLICY "Admins can view all subscriptions"
    ON public.subscriptions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'owner')
        )
    );

-- المستخدمون يمكنهم إنشاء اشتراكات لأنفسهم فقط
CREATE POLICY "Users can create their own subscriptions"
    ON public.subscriptions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- المديرون فقط يمكنهم تحديث الاشتراكات
CREATE POLICY "Only admins can update subscriptions"
    ON public.subscriptions
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'owner')
        )
    );

-- المديرون فقط يمكنهم حذف الاشتراكات
CREATE POLICY "Only admins can delete subscriptions"
    ON public.subscriptions
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'owner')
        )
    );

-- إضافة تعليق على الجدول
COMMENT ON TABLE public.subscriptions IS 'جدول الاشتراكات - يحتوي على معلومات اشتراكات المستخدمين في الباقات';
COMMENT ON COLUMN public.subscriptions.status IS 'حالة الاشتراك: pending (في انتظار)، active (نشط)، expired (منتهي)، cancelled (ملغي)، suspended (معلق)';
COMMENT ON COLUMN public.subscriptions.payment_id IS 'رابط بجدول payments عند تفعيل الدفع الإلكتروني';
COMMENT ON COLUMN public.subscriptions.auto_renew IS 'الاشتراك التلقائي - تجديد تلقائي عند الانتهاء';

