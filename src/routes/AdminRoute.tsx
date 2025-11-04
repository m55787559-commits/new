import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabaseClient'

export default function AdminRoute({ children }: { children: JSX.Element }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      // إذا لم يكن هناك مستخدم، تأكد من أن loading = false و isAdmin = false
      if (!user) { 
        if (mounted) { 
          setIsAdmin(false)
          setLoading(false)
        }
        return 
      }
      
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()
        
        if (!mounted) return
        
        if (error) {
          console.warn('⚠️ خطأ في جلب role من user_profiles:', error)
          // في حالة خطأ أو مشاكل RLS، نعتبر المستخدم ليس مسؤولاً لأسباب أمنية
          setIsAdmin(false)
        } else if (data && data.role) {
          // تأكد من أن role موجود وقيمته بالضبط 'admin' أو 'owner'
          const role = String(data.role).toLowerCase().trim()
          if (role === 'admin' || role === 'owner') {
            setIsAdmin(true)
          } else {
            // role موجود لكن ليس admin أو owner
            console.warn('⚠️ المستخدم ليس مسؤولاً. Role:', role)
            setIsAdmin(false)
          }
        } else {
          // لا يوجد role أو data غير موجود
          console.warn('⚠️ لا يوجد role للمستخدم')
          setIsAdmin(false)
        }
      } catch (err) {
        console.warn('⚠️ خطأ غير متوقع في جلب role:', err)
        // في حالة أي خطأ، نعتبر المستخدم ليس مسؤولاً لأسباب أمنية
        setIsAdmin(false)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [user])

  // لا تعرض أي محتوى حتى يتم التحقق من الصلاحيات
  if (!user) {
    return <Navigate to="/login" replace />
  }
  
  if (loading) {
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
  
  // إذا لم يكن مسؤولاً، أعد التوجيه فوراً
  if (!isAdmin) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '50vh',
        textAlign: 'center',
        padding: '2rem'
      }}>
        <h2 style={{ color: '#d32f2f' }}>⚠️ غير مصرح بالوصول</h2>
        <p style={{ marginTop: '1rem', color: '#666' }}>
          الصفحة متاحة فقط للمسؤولين. سيتم توجيهك إلى الصفحة الرئيسية...
        </p>
        <Navigate to="/" replace />
      </div>
    )
  }
  
  // فقط بعد التأكد الكامل من الصلاحيات، اعرض المحتوى
  return children
}


