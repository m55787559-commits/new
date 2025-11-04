import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../hooks/useAuth'

export default function AdminDashboard() {
  const { user } = useAuth()
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)
  const [stats, setStats] = useState<{ total_providers: number; pending_providers: number; active_providers: number; total_users: number; total_payments_completed: number } | null>(null)
  const [byPackage, setByPackage] = useState<Array<{ package_name: string; providers_count: number }>>([])
  const [loading, setLoading] = useState<boolean>(true)

  // التحقق من الصلاحيات كطبقة أمان إضافية
  useEffect(() => {
    if (!user) {
      setIsAuthorized(false)
      return
    }
    
    let mounted = true
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()
        
        if (!mounted) return
        
        if (error || !data || !data.role) {
          setIsAuthorized(false)
        } else {
          setIsAuthorized(data.role === 'admin' || data.role === 'owner')
        }
      } catch (err) {
        setIsAuthorized(false)
      }
    })()
    
    return () => { mounted = false }
  }, [user])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        const [{ data: s }, { data: p }] = await Promise.all([
          supabase.rpc('get_admin_site_stats'),
          supabase.rpc('get_providers_per_package')
        ])
        if (!mounted) return
        const first = Array.isArray(s) && s.length > 0 ? s[0] : null
        setStats(first ? {
          total_providers: first.total_providers || 0,
          pending_providers: first.pending_providers || 0,
          active_providers: first.active_providers || 0,
          total_users: first.total_users || 0,
          total_payments_completed: first.total_payments_completed || 0,
        } : { total_providers: 0, pending_providers: 0, active_providers: 0, total_users: 0, total_payments_completed: 0 })
        setByPackage((p as any) || [])
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  // طبقة حماية إضافية - لا تعرض المحتوى إذا لم يكن المستخدم مسؤولاً
  if (isAuthorized === null) {
    return (
      <div className="loading" style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '50vh' 
      }}>
        <p>جارٍ التحقق من الصلاحيات...</p>
      </div>
    )
  }
  
  if (isAuthorized === false) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="container">
      <h1 style={{ marginBottom: '1rem' }}>لوحة التحكم</h1>
      {loading ? (
        <div className="loading"><p>جارٍ التحميل...</p></div>
      ) : (
        <div className="grid cards" style={{ marginBottom: '1rem' }}>
          <div className="card"><h3>إجمالي الأماكن</h3><p>{stats?.total_providers ?? 0}</p></div>
          <div className="card"><h3>قيد الانتظار</h3><p>{stats?.pending_providers ?? 0}</p></div>
          <div className="card"><h3>نشطة</h3><p>{stats?.active_providers ?? 0}</p></div>
          <div className="card"><h3>إجمالي المستخدمين</h3><p>{stats?.total_users ?? 0}</p></div>
          <div className="card"><h3>مدفوعات مكتملة</h3><p>{stats?.total_payments_completed ?? 0}</p></div>
        </div>
      )}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h3>الأماكن لكل باقة</h3>
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {byPackage.map((r, idx) => (
            <div key={idx} className="card">
              <strong>{r.package_name}</strong>
              <div>{r.providers_count} مكان</div>
            </div>
          ))}
          {byPackage.length === 0 && <div>لا توجد بيانات</div>}
        </div>
      </div>
      <div className="grid cards">
        <Link to="/admin/providers" className="card" style={{ textDecoration: 'none' }}>
          <h3>إدارة الأماكن</h3>
          <p>مراجعة وتفعيل الأماكن المعلّقة وتغيير الحالة.</p>
        </Link>
        <Link to="/admin/packages" className="card" style={{ textDecoration: 'none' }}>
          <h3>إدارة الباقات</h3>
          <p>عرض، إضافة، وتفعيل/تعطيل الباقات.</p>
        </Link>
        <Link to="/admin/accounts" className="card" style={{ textDecoration: 'none' }}>
          <h3>إدارة الحسابات</h3>
          <p>عرض المستخدمين وإدارة الصلاحيات (admin/owner/user).</p>
        </Link>
        <Link to="/admin/subscriptions" className="card" style={{ textDecoration: 'none', border: '2px solid #ffc107' }}>
          <h3>📋 إدارة الاشتراكات</h3>
          <p>عرض الاشتراكات المعلقة وتفعيلها بعد التأكد من الدفع.</p>
        </Link>
        <Link to="/admin/payment-settings" className="card" style={{ textDecoration: 'none', border: '2px solid #1976d2' }}>
          <h3>💳 إعدادات طرق الدفع</h3>
          <p>تحديث بيانات البنك والمحفظة التي تظهر للمستخدم.</p>
        </Link>
        <Link to="/admin/database-checker" className="card" style={{ textDecoration: 'none', border: '2px solid #4CAF50' }}>
          <h3>🔍 فاحص قاعدة البيانات</h3>
          <p>التحقق من حالة قاعدة البيانات وإضافة باقات تلقائياً.</p>
        </Link>
      </div>
    </div>
  )
}


