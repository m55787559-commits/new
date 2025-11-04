import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'

interface Package {
  id: number;
  name: string;
  price: number;
  duration_days: number;
  description?: string;
  max_places?: number;
  priority_weight?: number;
  is_active?: boolean;
}

interface UserPackage {
  package_id: number
  package_name: string
  duration_days: number
  started_at: string
  expires_at: string
  is_active: boolean
}

interface PaymentInfo {
  bank_account: string
  bank_name: string
  account_name: string
  mobile_wallet: string
  instructions: string
}

interface SubscriptionResponse {
  subscription_id: number
  package_id: number
  package_name: string
  amount: number
  status: string
  message: string
  payment_info: PaymentInfo
  places_warning?: {
    has_warning: boolean
    current_places?: number
    max_places_allowed?: number
    excess_places?: number
    message?: string
  }
}

export default function PackagesPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [userPackage, setUserPackage] = useState<UserPackage | null>(null)
  const [pkgLoading, setPkgLoading] = useState(false)
  const [paymentInfo, setPaymentInfo] = useState<SubscriptionResponse | null>(null)
  const [openInfoPackageId, setOpenInfoPackageId] = useState<number | null>(null)
  const [pendingSubscriptions, setPendingSubscriptions] = useState<number[]>([]) // Array of package IDs with pending subscriptions

  // جلب معلومات باقة المستخدم
  useEffect(() => {
    if (!user) {
      setUserPackage(null)
      return
    }

    let mounted = true
    setPkgLoading(true)
    
    ;(async () => {
      try {
        const { data, error } = await supabase.rpc('get_user_package', { 
          p_user_id: user.id 
        })
        
        if (!mounted) return
        
        if (error) {
          console.warn('⚠️ خطأ في جلب باقة المستخدم:', error)
          setUserPackage(null)
        } else if (data && Array.isArray(data) && data.length > 0) {
          setUserPackage(data[0])
        } else {
          setUserPackage(null)
        }
      } catch (err: any) {
        console.warn('⚠️ خطأ غير متوقع:', err)
        setUserPackage(null)
      } finally {
        if (mounted) setPkgLoading(false)
      }
    })()

    return () => { mounted = false }
  }, [user?.id])

  // جلب الاشتراكات المعلقة للمستخدم
  useEffect(() => {
    if (!user) {
      setPendingSubscriptions([])
      return
    }

    let mounted = true
    
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('subscriptions')
          .select('package_id')
          .eq('user_id', user.id)
          .eq('status', 'pending')
        
        if (!mounted) return
        
        if (error) {
          console.warn('⚠️ خطأ في جلب الاشتراكات المعلقة:', error)
          setPendingSubscriptions([])
        } else if (data && Array.isArray(data)) {
          const pendingPackageIds = data.map(sub => sub.package_id)
          setPendingSubscriptions(pendingPackageIds)
        } else {
          setPendingSubscriptions([])
        }
      } catch (err: any) {
        console.warn('⚠️ خطأ غير متوقع في جلب الاشتراكات المعلقة:', err)
        setPendingSubscriptions([])
      }
    })()

    return () => { mounted = false }
  }, [user?.id])

  // جلب جميع الباقات
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true)
      setError(null)
      try {
        const { data, error } = await supabase
          .from('packages')
          .select('*')
          .eq('is_active', true)
          .order('price', { ascending: true })
        
        if (error) {
          console.error('❌ خطأ في جلب الباقات:', error)
          throw error
        }
        
        if (mounted) {
          setItems((data || []) as any)
          if (!data || data.length === 0) {
            setError('لا توجد باقات متاحة حالياً. يرجى التواصل مع الإدارة لإضافة باقات جديدة.')
          }
          setLoading(false)
        }
      } catch (err: any) {
        if (mounted) {
          console.error('💥 خطأ في تحميل الباقات:', err)
          setError(err?.message || 'حدث خطأ أثناء تحميل الباقات. يرجى المحاولة مرة أخرى.')
          setLoading(false)
        }
      }
    })()
    return () => { mounted = false }
  }, [])

  const handleSubscribe = async (pkg: Package) => {
    if (!user) {
      alert('يجب تسجيل الدخول للاشتراك')
      return;
    }
    if (!window.confirm(`هل تريد الاشتراك في باقة "${pkg.name}" بسعر ${pkg.price} جنيه؟`)) return
    
    setSubmitting(true)
    setError(null)
    setSuccessMsg('')
    setPaymentInfo(null)
    
    try {
      // استدعاء دالة الاشتراك للمستخدمين العاديين (ترجع jsonb الآن)
      const { data, error } = await supabase.rpc('create_user_subscription', {
        p_package_id: pkg.id
      })
      
      if (error) {
        console.error('❌ خطأ في الاشتراك:', error)
        
        let errorMessage = 'حدث خطأ أثناء الاشتراك. '
        if (error.message.includes('permission') || error.message.includes('RLS')) {
          errorMessage += 'يبدو أنك لا تملك الصلاحيات اللازمة. يرجى التواصل مع الدعم الفني.'
        } else if (error.message.includes('duplicate') || error.message.includes('already exists')) {
          errorMessage += 'لديك اشتراك نشط بالفعل في هذه الباقة أو باقة أخرى.'
        } else {
          errorMessage += error.message || 'يرجى المحاولة مرة أخرى أو التواصل مع الدعم.'
        }
        
        setError(errorMessage)
      } else if (data) {
        // تحويل البيانات إلى SubscriptionResponse
        const subscriptionData = data as unknown as SubscriptionResponse & {
          has_active_subscription?: boolean
          current_package_name?: string
        }
        setPaymentInfo(subscriptionData)
        
        // استخدام الرسالة من السيرفر مباشرة (تحتوي على التحذيرات)
        setSuccessMsg(subscriptionData.message || 'تم إنشاء طلب الاشتراك بنجاح. يرجى إتمام عملية الدفع.')
        
        // تحديث قائمة الاشتراكات المعلقة (إزالة القديمة وإضافة الجديدة)
        // لأن الطلبات القديمة تم إلغاؤها تلقائياً
        setPendingSubscriptions([pkg.id])
        
        // التمرير إلى قسم معلومات الدفع
        setTimeout(() => {
          document.getElementById('payment-info-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 100)
      }
    } catch (err: any) {
      console.error('💥 خطأ غير متوقع في الاشتراك:', err)
      setError('حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى أو التواصل مع الدعم الفني.')
    } finally {
      setSubmitting(false)
    }
  }

  // عرض معلومات الدفع دون إنشاء اشتراك
  const showPaymentInfo = async (pkg: Package) => {
    setError(null)
    setSuccessMsg('')
    setPaymentInfo(null)

    try {
      const { data, error } = await supabase.rpc('get_payment_instructions', {
        p_package_id: pkg.id
      })

      if (error) {
        console.error('❌ خطأ في جلب معلومات الدفع:', error)
        setError(error.message || 'تعذر جلب معلومات الدفع حالياً')
        return
      }

      if (data) {
        setPaymentInfo(data as any)
        setOpenInfoPackageId(pkg.id)
      }
    } catch (err: any) {
      console.error('💥 خطأ غير متوقع في معلومات الدفع:', err)
      setError('حدث خطأ غير متوقع أثناء جلب معلومات الدفع')
    }
  }

  // التحقق إذا كان المستخدم مشترك في باقة معينة
  const isUserSubscribed = (packageId: number) => {
    if (!userPackage || !userPackage.package_id) return false
    // تأكد من أن package_id موجود ونشط
    return userPackage.package_id === packageId && userPackage.is_active === true
  }
  
  // إعادة جلب معلومات الباقة (للاستخدام بعد الاشتراك)
  const refreshUserPackage = async () => {
    if (!user) return
    
    try {
      const { data, error } = await supabase.rpc('get_user_package', { p_user_id: user.id })
      
      if (error) {
        console.warn('⚠️ خطأ في جلب الباقة:', error)
        return
      }
      
      if (data && Array.isArray(data) && data.length > 0 && data[0].package_id) {
        setUserPackage(data[0])
        console.log('✅ تم تحديث معلومات الباقة:', data[0])
      } else {
        setUserPackage(null)
      }
    } catch (err) {
      console.warn('⚠️ خطأ غير متوقع:', err)
    }
  }

  return (
    <div className="container" style={{ maxWidth: 680, margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>الباقات والخطط</h1>
      
      {/* عرض باقتك الحالية */}
      {user && userPackage && userPackage.package_id && userPackage.is_active && (
        <div style={{
          backgroundColor: '#e8f5e9',
          border: '2px solid #4CAF50',
          borderRadius: '8px',
          padding: '1.5rem',
          marginBottom: '2rem',
          textAlign: 'center'
        }}>
          <h2 style={{ marginTop: 0, color: '#2e7d32' }}>✅ باقتك الحالية</h2>
          <p style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: '0.5rem 0' }}>
            {userPackage.package_name || 'باقة نشطة'}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginTop: '1rem', fontSize: '0.95rem' }}>
            <div>
              <strong>تاريخ البدء:</strong><br />
              {userPackage.started_at ? new Date(userPackage.started_at).toLocaleDateString('ar-EG') : 'غير محدد'}
            </div>
            <div>
              <strong>تاريخ الانتهاء:</strong><br />
              {userPackage.expires_at ? new Date(userPackage.expires_at).toLocaleDateString('ar-EG') : 'غير محدد'}
            </div>
            <div>
              <strong>المدة:</strong><br />
              {userPackage.duration_days || 30} يوم
            </div>
          </div>
          <button
            onClick={refreshUserPackage}
            className="btn"
            style={{ 
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              fontSize: '0.9rem',
              backgroundColor: '#1976d2',
              color: 'white'
            }}
          >
            🔄 تحديث معلومات الباقة
          </button>
        </div>
      )}
      
      {/* رسالة عند عدم وجود باقة نشطة */}
      {user && userPackage === null && !pkgLoading && (
        <div style={{
          backgroundColor: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '2rem',
          textAlign: 'center'
        }}>
          <p style={{ margin: 0, color: '#856404' }}>
            ⚠️ لا يوجد اشتراك نشط حالياً. اختر باقة للاشتراك.
          </p>
        </div>
      )}

      {successMsg && (
        <div style={{
          color: '#2e7d32',
          backgroundColor: '#e8f5e9',
          border: '2px solid #4CAF50',
          borderRadius: '8px',
          padding: '1.5rem',
          marginBottom: 20,
          textAlign: 'center',
          fontWeight: 'bold',
          fontSize: '1.1rem',
          boxShadow: '0 2px 8px rgba(76, 175, 80, 0.2)'
        }}>
          <p style={{ margin: 0, fontSize: '1.2rem' }}>{successMsg}</p>
          {userPackage && userPackage.package_id && (
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.95rem', color: '#2e7d32' }}>
              باقتك: <strong>{userPackage.package_name}</strong> - سارية حتى {userPackage.expires_at ? new Date(userPackage.expires_at).toLocaleDateString('ar-EG') : 'غير محدد'}
            </p>
          )}
        </div>
      )}

      {/* عرض معلومات الدفع العام (يظهر فقط عند إنشاء اشتراك فعلي) */}
      {paymentInfo && openInfoPackageId === null && (
        <div 
          id="payment-info-section"
          style={{
            backgroundColor: '#e3f2fd',
            border: '2px solid #2196F3',
            borderRadius: '8px',
            padding: '2rem',
            marginBottom: '2rem',
            direction: 'rtl'
          }}
        >
          <h2 style={{ marginTop: 0, color: '#1976d2', textAlign: 'center' }}>
            💳 معلومات الدفع
          </h2>
          
          {/* تحذير الأماكن الزائدة */}
          {paymentInfo.places_warning?.has_warning && (
            <div style={{
              backgroundColor: '#fff3cd',
              border: '2px solid #ff9800',
              borderRadius: '8px',
              padding: '1.5rem',
              marginBottom: '1rem',
              direction: 'rtl'
            }}>
              <h3 style={{ marginTop: 0, color: '#856404', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                ⚠️ تحذير مهم
              </h3>
              <div style={{ marginTop: '1rem' }}>
                <p style={{ margin: '0.5rem 0', fontSize: '1rem', fontWeight: 'bold', color: '#856404' }}>
                  لديك {paymentInfo.places_warning.current_places} أماكن نشطة حالياً
                </p>
                <p style={{ margin: '0.5rem 0', fontSize: '1rem', color: '#856404' }}>
                  الباقة الجديدة ({paymentInfo.package_name}) تسمح بـ <strong>{paymentInfo.places_warning.max_places_allowed} أماكن فقط</strong>
                </p>
                <div style={{
                  backgroundColor: '#fff',
                  padding: '1rem',
                  borderRadius: '6px',
                  marginTop: '1rem',
                  border: '1px solid #ffc107'
                }}>
                  <p style={{ margin: 0, fontSize: '1rem', fontWeight: 'bold', color: '#f57c00' }}>
                    ⚠️ سيتم تعطيل {paymentInfo.places_warning.excess_places} مكان تلقائياً عند التفعيل
                  </p>
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', color: '#666' }}>
                    سيتم تعطيل الأماكن الأقدم أولاً. يمكنك إعادة تفعيلها لاحقاً إذا قمت بترقية باقاتك.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '8px',
            padding: '1.5rem',
            marginBottom: '1rem',
            border: '1px solid #ddd'
          }}>
            <h3 style={{ marginTop: 0, color: '#1565c0' }}>تفاصيل الباقة:</h3>
            <p><strong>اسم الباقة:</strong> {paymentInfo.package_name}</p>
            <p><strong>المبلغ:</strong> {paymentInfo.amount} جنيه</p>
            <p><strong>الحالة:</strong>{' '}
              {paymentInfo.status === 'pending' ? (
                <span style={{ color: '#FF9800', fontWeight: 'bold' }}>⏳ في انتظار التفعيل</span>
              ) : (
                <span style={{ color: '#1976d2', fontWeight: 'bold' }}>ℹ️ معلومات فقط (لم يتم إنشاء اشتراك)</span>
              )}
            </p>
            <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666' }}>
              {paymentInfo.message}
            </p>
          </div>

          <div style={{
            backgroundColor: '#fff3cd',
            borderRadius: '8px',
            padding: '1.5rem',
            marginBottom: '1rem',
            border: '1px solid #ffc107'
          }}>
            <h3 style={{ marginTop: 0, color: '#856404' }}>📋 معلومات حساب الدفع:</h3>
            
            <div style={{ marginBottom: '1rem' }}>
              <p style={{ margin: '0.5rem 0' }}>
                <strong>🏦 اسم البنك:</strong> {paymentInfo.payment_info.bank_name}
              </p>
              <p style={{ margin: '0.5rem 0' }}>
                <strong>💰 رقم الحساب:</strong> 
                <span style={{ 
                  fontFamily: 'monospace', 
                  fontSize: '1.1rem', 
                  backgroundColor: '#f5f5f5', 
                  padding: '0.3rem 0.6rem',
                  borderRadius: '4px',
                  marginRight: '0.5rem',
                  fontWeight: 'bold',
                  color: '#1976d2'
                }}>
                  {paymentInfo.payment_info.bank_account}
                </span>
              </p>
              <p style={{ margin: '0.5rem 0' }}>
                <strong>👤 اسم صاحب الحساب:</strong> {paymentInfo.payment_info.account_name}
              </p>
            </div>

            <div style={{ 
              backgroundColor: '#e8f5e9', 
              padding: '1rem', 
              borderRadius: '6px',
              marginTop: '1rem',
              border: '1px solid #4CAF50'
            }}>
              <p style={{ margin: '0.5rem 0' }}>
                <strong>📱 المحفظة الإلكترونية:</strong>
                <span style={{ 
                  fontFamily: 'monospace', 
                  fontSize: '1.1rem', 
                  backgroundColor: '#fff', 
                  padding: '0.3rem 0.6rem',
                  borderRadius: '4px',
                  marginRight: '0.5rem',
                  fontWeight: 'bold',
                  color: '#2e7d32'
                }}>
                  {paymentInfo.payment_info.mobile_wallet}
                </span>
              </p>
            </div>

            <div style={{
              backgroundColor: '#ffebee',
              padding: '1rem',
              borderRadius: '6px',
              marginTop: '1rem',
              border: '1px solid #f44336'
            }}>
              <p style={{ margin: 0, color: '#c62828', fontWeight: 'bold' }}>
                ⚠️ {paymentInfo.payment_info.instructions}
              </p>
            </div>
          </div>

          {paymentInfo.status === 'pending' && (
            <div style={{
              backgroundColor: '#f3e5f5',
              borderRadius: '8px',
              padding: '1rem',
              textAlign: 'center',
              border: '1px solid #9c27b0'
            }}>
              <p style={{ margin: 0, color: '#7b1fa2', fontWeight: 'bold' }}>
                ⏰ سيتم تفعيل اشتراكك خلال دقائق بعد التأكد من إتمام الدفع من قبل الإدارة
              </p>
            </div>
          )}
        </div>
      )}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p>جارٍ تحميل الباقات...</p>
        </div>
      ) : error ? (
        <div className="error" style={{ 
          color: '#d32f2f', 
          backgroundColor: '#ffebee',
          border: '1px solid #f44336',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: 20,
          textAlign: 'center' 
        }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>⚠️ {error}</p>
          {error.includes('RLS') || error.includes('permission') || error.includes('row-level') ? (
            <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
              يبدو أن هناك مشكلة في الصلاحيات. يرجى التأكد من تسجيل الدخول بشكل صحيح.
            </p>
          ) : null}
        </div>
      ) : items.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '2rem',
          backgroundColor: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '8px',
          color: '#856404'
        }}>
          <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold' }}>
            📦 لا توجد باقات متاحة حالياً
          </p>
          <p style={{ marginTop: '1rem', fontSize: '0.95rem' }}>
            لا توجد باقات نشطة متاحة للاشتراك حالياً. يرجى المحاولة لاحقاً أو التواصل مع الدعم الفني.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 18 }}>
          {items.map(pkg => {
            const isSubscribed = isUserSubscribed(pkg.id)
            const isCurrentPackage = userPackage?.package_id === pkg.id && !userPackage.is_active
            const hasPendingSubscription = pendingSubscriptions.includes(pkg.id)
            
            return (
              <div 
                key={pkg.id} 
                className="card" 
                style={{ 
                  padding: 20, 
                  borderRadius: 8, 
                  border: isSubscribed ? '3px solid #4CAF50' : '1px solid #eee', 
                  background: isSubscribed ? '#f1f8f4' : '#fff',
                  position: 'relative'
                }}
              >
                {isSubscribed && (
                  <div style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    padding: '0.5rem 1rem',
                    borderRadius: '20px',
                    fontSize: '0.85rem',
                    fontWeight: 'bold'
                  }}>
                    ✓ مشترك حالياً
                  </div>
                )}
                
                <h3 style={{ marginTop: isSubscribed ? '2.5rem' : '0' }}>{pkg.name}</h3>
                <p><strong>السعر:</strong> {pkg.price} جنيه / {pkg.duration_days} يوم</p>
                <p><strong>الحد الأقصى للأماكن:</strong> {pkg.max_places ?? 1}</p>
                {pkg.description && <p>{pkg.description}</p>}
                
                {isSubscribed ? (
                  <div style={{
                    marginTop: '1rem',
                    padding: '1rem',
                    backgroundColor: '#e8f5e9',
                    border: '1px solid #4CAF50',
                    borderRadius: '8px',
                    textAlign: 'center'
                  }}>
                    <p style={{ margin: 0, fontWeight: 'bold', color: '#2e7d32' }}>
                      ✅ أنت مشترك حالياً في هذه الباقة
                    </p>
                    {userPackage?.expires_at && (
                      <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', color: '#666' }}>
                        تنتهي في: {new Date(userPackage.expires_at).toLocaleDateString('ar-EG')}
                      </p>
                    )}
                  </div>
                ) : hasPendingSubscription ? (
                  <div style={{
                    marginTop: '1rem',
                    padding: '1rem',
                    backgroundColor: '#fff3cd',
                    border: '1px solid #ffc107',
                    borderRadius: '8px',
                    textAlign: 'center'
                  }}>
                    <p style={{ margin: 0, fontWeight: 'bold', color: '#856404' }}>
                      ⏳ في انتظار التفعيل
                    </p>
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', color: '#666' }}>
                      اشتراكك في هذه الباقة قيد المراجعة. سيتم التفعيل قريباً بعد التأكد من الدفع.
                    </p>
                  </div>
                ) : isCurrentPackage ? (
                  <div style={{
                    marginTop: '1rem',
                    padding: '1rem',
                    backgroundColor: '#fff3cd',
                    border: '1px solid #FF9800',
                    borderRadius: '8px',
                    textAlign: 'center'
                  }}>
                    <p style={{ margin: 0, fontWeight: 'bold', color: '#856404' }}>
                      ⚠️ انتهت صلاحية هذه الباقة
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '0.5rem', marginTop: '1rem' }}>
                    <button 
                      className="btn primary" 
                      onClick={()=>handleSubscribe(pkg)} 
                      disabled={submitting || !user || hasPendingSubscription}
                      style={{ 
                        width: '100%',
                        opacity: hasPendingSubscription ? 0.6 : 1,
                        cursor: hasPendingSubscription ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {submitting ? 'جارٍ المعالجة...' : !user ? 'يجب تسجيل الدخول' : 'اشترك الآن'}
                    </button>
                    <button
                      className="btn"
                      onClick={()=>showPaymentInfo(pkg)}
                      style={{ width: '100%', backgroundColor: '#e3f2fd', border: '1px solid #2196F3', color: '#1976d2' }}
                    >
                      💳 عرض معلومات الدفع (بدون اشتراك)
                    </button>
                    {openInfoPackageId === pkg.id && paymentInfo && (
                      <div 
                        className="card"
                        style={{ backgroundColor: '#e3f2fd', border: '2px solid #2196F3', borderRadius: 8, padding: '1rem' }}
                      >
                        <h4 style={{ marginTop: 0, color: '#1976d2' }}>💳 معلومات الدفع</h4>
                        <div style={{ fontSize: '0.95rem' }}>
                          <p style={{ margin: '0.25rem 0' }}><strong>اسم الباقة:</strong> {paymentInfo.package_name}</p>
                          <p style={{ margin: '0.25rem 0' }}>
                            <strong>المبلغ:</strong> {paymentInfo.amount} جنيه
                            {paymentInfo.status === 'pending' ? (
                              <span style={{ marginInlineStart: 8, color: '#FF9800', fontWeight: 'bold' }}>⏳ في انتظار التفعيل</span>
                            ) : (
                              <span style={{ marginInlineStart: 8, color: '#1976d2', fontWeight: 'bold' }}>ℹ️ معلومات فقط</span>
                            )}
                          </p>
                          <p style={{ margin: '0.5rem 0', color: '#666' }}>{paymentInfo.message}</p>

                          <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 6, padding: '0.75rem' }}>
                            <p style={{ margin: '0.25rem 0' }}><strong>🏦 البنك:</strong> {paymentInfo.payment_info.bank_name}</p>
                            <p style={{ margin: '0.25rem 0' }}><strong>💰 الحساب:</strong> <span style={{ fontFamily: 'monospace' }}>{paymentInfo.payment_info.bank_account}</span></p>
                            <p style={{ margin: '0.25rem 0' }}><strong>👤 الاسم:</strong> {paymentInfo.payment_info.account_name}</p>
                            <p style={{ margin: '0.25rem 0' }}><strong>📱 المحفظة:</strong> <span style={{ fontFamily: 'monospace' }}>{paymentInfo.payment_info.mobile_wallet}</span></p>
                            <p style={{ margin: '0.5rem 0', color: '#c62828' }}><strong>⚠️</strong> {paymentInfo.payment_info.instructions}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
