import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'

interface PendingSubscription {
  subscription_id: number
  user_id: string
  user_name: string
  user_email: string
  package_id: number
  package_name: string
  amount: number
  status: string
  created_at: string
  payment_id: number | null
  payment_receipt_url: string | null
  notes: string | null
}

export default function AdminSubscriptions() {
  const [subscriptions, setSubscriptions] = useState<PendingSubscription[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')
  const [activatingId, setActivatingId] = useState<number | null>(null)

  const fetchSubscriptions = async () => {
    setLoading(true)
    setError(null)
    try {
      if (filter === 'pending') {
        // جلب الاشتراكات المعلقة فقط
        const { data, error } = await supabase.rpc('admin_get_pending_subscriptions')
        if (error) throw error
        setSubscriptions((data || []) as PendingSubscription[])
      } else {
        // جلب جميع الاشتراكات
        const { data, error } = await supabase.rpc('admin_get_all_subscriptions', {
          p_status_filter: null,
          p_limit_val: 100,
          p_offset_val: 0
        })
        if (error) throw error
        setSubscriptions((data || []) as PendingSubscription[])
      }
    } catch (err: any) {
      console.error('❌ خطأ في جلب الاشتراكات:', err)
      const errorMessage = err?.message || err?.error_description || err?.hint || 'حدث خطأ أثناء جلب الاشتراكات'
      setError(errorMessage)
      
      // Log full error details for debugging
      if (err?.details) {
        console.error('تفاصيل الخطأ:', err.details)
      }
      if (err?.code) {
        console.error('رمز الخطأ:', err.code)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSubscriptions()
  }, [filter])

  const handleActivate = async (subscriptionId: number) => {
    if (!window.confirm('هل أنت متأكد من تفعيل هذا الاشتراك؟')) return

    setActivatingId(subscriptionId)
    setError(null)
    setSuccessMsg(null)

    try {
      const { data, error } = await supabase.rpc('admin_activate_subscription', {
        p_subscription_id: subscriptionId,
        p_payment_id: null  // سيتم إنشاء payment تلقائياً
      })

      if (error) {
        throw error
      }

      setSuccessMsg('✅ تم تفعيل الاشتراك بنجاح!')
      
      // إعادة جلب الاشتراكات بعد التفعيل
      setTimeout(() => {
        fetchSubscriptions()
        setSuccessMsg(null)
      }, 1500)
    } catch (err: any) {
      console.error('❌ خطأ في تفعيل الاشتراك:', err)
      setError(err?.message || 'حدث خطأ أثناء تفعيل الاشتراك')
    } finally {
      setActivatingId(null)
    }
  }

  const handleCancel = async (subscriptionId: number) => {
    const reason = window.prompt('يرجى إدخال سبب الإلغاء (اختياري):')
    if (reason === null) return // المستخدم ألغى

    setError(null)
    setSuccessMsg(null)

    try {
      const { data, error } = await supabase.rpc('admin_cancel_subscription', {
        p_subscription_id: subscriptionId,
        p_reason: reason || null
      })

      if (error) {
        throw error
      }

      setSuccessMsg('✅ تم إلغاء الاشتراك بنجاح!')
      
      // إعادة جلب الاشتراكات بعد الإلغاء
      setTimeout(() => {
        fetchSubscriptions()
        setSuccessMsg(null)
      }, 1500)
    } catch (err: any) {
      console.error('❌ خطأ في إلغاء الاشتراك:', err)
      setError(err?.message || 'حدث خطأ أثناء إلغاء الاشتراك')
    }
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: { bg: '#fff3cd', color: '#856404', border: '#ffc107', text: '⏳ في انتظار التفعيل' },
      active: { bg: '#e8f5e9', color: '#2e7d32', border: '#4CAF50', text: '✅ نشط' },
      expired: { bg: '#ffe0b2', color: '#e65100', border: '#ff9800', text: '⏰ منتهي' },
      cancelled: { bg: '#ffebee', color: '#c62828', border: '#f44336', text: '❌ ملغي' },
      suspended: { bg: '#f3e5f5', color: '#6a1b9a', border: '#9c27b0', text: '⏸️ معلق' },
      completed: { bg: '#e8f5e9', color: '#2e7d32', border: '#4CAF50', text: '✅ مفعّل' },
      failed: { bg: '#ffebee', color: '#c62828', border: '#f44336', text: '⚠️ فاشل' }
    }
    const style = styles[status as keyof typeof styles] || styles.pending
    return (
      <span style={{
        backgroundColor: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
        padding: '0.25rem 0.75rem',
        borderRadius: '12px',
        fontSize: '0.85rem',
        fontWeight: 'bold'
      }}>
        {style.text}
      </span>
    )
  }

  return (
    <div className="container" style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>📋 إدارة الاشتراكات</h1>

      {/* فلاتر */}
      <div className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilter('pending')}
            className={filter === 'pending' ? 'btn primary' : 'btn'}
            style={{ minWidth: '150px' }}
          >
            ⏳ المعلقة ({filter === 'pending' ? subscriptions.length : '...'})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={filter === 'all' ? 'btn primary' : 'btn'}
            style={{ minWidth: '150px' }}
          >
            📋 الكل
          </button>
          <button
            onClick={fetchSubscriptions}
            className="btn"
            style={{ marginRight: 'auto' }}
          >
            🔄 تحديث
          </button>
        </div>
      </div>

      {/* الرسائل */}
      {successMsg && (
        <div style={{
          backgroundColor: '#e8f5e9',
          border: '2px solid #4CAF50',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1rem',
          color: '#2e7d32',
          fontWeight: 'bold'
        }}>
          {successMsg}
        </div>
      )}

      {error && (
        <div style={{
          backgroundColor: '#ffebee',
          border: '2px solid #f44336',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1rem',
          color: '#c62828',
          fontWeight: 'bold'
        }}>
          ❌ {error}
        </div>
      )}

      {/* قائمة الاشتراكات */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <p>جارٍ التحميل...</p>
        </div>
      ) : subscriptions.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          backgroundColor: '#f5f5f5',
          borderRadius: '8px',
          color: '#666'
        }}>
          <p style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
            {filter === 'pending' ? '📭 لا توجد اشتراكات معلقة حالياً' : '📭 لا توجد اشتراكات'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {subscriptions.map((sub) => (
            <div
              key={sub.subscription_id}
              className="card"
              style={{
                padding: '1.5rem',
                border: sub.status === 'pending' ? '2px solid #ffc107' : '1px solid #ddd',
                backgroundColor: sub.status === 'pending' ? '#fffbf0' : '#fff'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ flex: 1, minWidth: '250px' }}>
                  <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>
                    {sub.package_name}
                  </h3>
                  <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.95rem' }}>
                    <p style={{ margin: 0 }}>
                      <strong>👤 المستخدم:</strong> {sub.user_name || 'غير معروف'}
                    </p>
                    {sub.user_email && (
                      <p style={{ margin: 0, color: '#666' }}>
                        <strong>📧 البريد:</strong> {sub.user_email}
                      </p>
                    )}
                    <p style={{ margin: 0 }}>
                      <strong>💰 المبلغ:</strong> {sub.amount} جنيه
                    </p>
                    <p style={{ margin: 0, color: '#666', fontSize: '0.85rem' }}>
                      <strong>📅 تاريخ الطلب:</strong> {new Date(sub.created_at).toLocaleString('ar-EG', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                    {sub.notes && (
                      <p style={{ margin: 0, color: '#666', fontSize: '0.85rem', fontStyle: 'italic' }}>
                        <strong>📝 ملاحظات:</strong> {sub.notes}
                      </p>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'flex-end' }}>
                  {getStatusBadge(sub.status)}
                  
                  {sub.payment_receipt_url && (
                    <a
                      href={sub.payment_receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: '#2196F3',
                        color: 'white',
                        textDecoration: 'none',
                        borderRadius: '6px',
                        fontSize: '0.9rem'
                      }}
                    >
                      📎 عرض الإيصال
                    </a>
                  )}

                  {sub.status === 'pending' && (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => handleActivate(sub.subscription_id)}
                        disabled={activatingId === sub.subscription_id}
                        className="btn primary"
                        style={{
                          backgroundColor: '#4CAF50',
                          color: 'white',
                          minWidth: '120px'
                        }}
                      >
                        {activatingId === sub.subscription_id ? 'جارٍ التفعيل...' : '✅ تفعيل'}
                      </button>
                      <button
                        onClick={() => handleCancel(sub.subscription_id)}
                        className="btn"
                        style={{
                          backgroundColor: '#f44336',
                          color: 'white',
                          minWidth: '120px'
                        }}
                      >
                        ❌ إلغاء
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* معلومات إضافية */}
              <div style={{
                marginTop: '1rem',
                paddingTop: '1rem',
                borderTop: '1px solid #eee',
                fontSize: '0.85rem',
                color: '#666'
              }}>
                <p style={{ margin: 0 }}>
                  <strong>🆔 رقم الاشتراك:</strong> {sub.subscription_id} | 
                  <strong> 🆔 رقم الباقة:</strong> {sub.package_id}
                  {sub.payment_id && <> | <strong> 🆔 رقم الدفعة:</strong> {sub.payment_id}</>}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ملخص */}
      {subscriptions.length > 0 && (
        <div className="card" style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f5f5f5' }}>
          <p style={{ margin: 0, textAlign: 'center', color: '#666' }}>
            إجمالي النتائج: <strong>{subscriptions.length}</strong> اشتراك
          </p>
        </div>
      )}
    </div>
  )
}

