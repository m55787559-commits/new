
import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function Navbar() {
  const { user, signOut } = useAuth()
  const [isAdmin, setIsAdmin] = useState<boolean>(false)
  const [showEmail, setShowEmail] = useState(false);
  const emailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (!user) { setIsAdmin(false); return }
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()
        
        if (!mounted) return
        
        if (error) {
          console.warn('⚠️ خطأ في جلب role من user_profiles:', error)
          // في حالة خطأ 406 أو مشاكل RLS، نعتبر المستخدم ليس مسؤولاً
          setIsAdmin(false)
          return
        }
        
        if (data && (data.role === 'admin' || data.role === 'owner')) {
          setIsAdmin(true)
        } else {
          setIsAdmin(false)
        }
      } catch (err) {
        console.warn('⚠️ خطأ غير متوقع في جلب role:', err)
        if (mounted) setIsAdmin(false)
      }
    })()
    return () => { mounted = false }
  }, [user])

  return (
    <nav style={styles.nav} className="navbar">
      <div style={styles.navInner}>
        <Link to="/" style={{ ...styles.brand, color: '#ffffff' }}>BanReact</Link>
        <input type="checkbox" id="nav-toggle" style={{ display: 'none' }} />
        <label htmlFor="nav-toggle" style={styles.burger}>
          ☰
        </label>
        <div style={styles.links}>
          <Link to="/" className="nav-link" style={{ color: '#ffffff' }}>الرئيسية</Link>
          {user ? (
            <>
              <Link to="/add-place" className="nav-link" style={{ color: '#ffffff' }}>إضافة مكان</Link>
              <Link to="/add-service" className="nav-link" style={{ color: '#ffffff' }}>إضافة خدمة</Link>
              <Link to="/profile" className="nav-link" style={{ color: '#ffffff' }}>الملف الشخصي</Link>
              {isAdmin && <Link to="/admin" className="nav-link" style={{ color: '#ffffff' }}>الإدارة</Link>}
              <button onClick={signOut} className="btn danger">تسجيل الخروج</button>
              {/* صورة البريد */}
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <div
                  onClick={() => setShowEmail((v) => !v)}
                  style={{
                    width: 34,
                    height: 34,
                    background: '#1976d2',
                    color: '#fff',
                    borderRadius: '50%',
                    textAlign: 'center',
                    lineHeight: '34px',
                    fontSize: '1.1em',
                    fontWeight: 700,
                    cursor: 'pointer',
                    marginInlineStart: 4,
                    boxShadow: '0 1px 6px rgba(40,80,200,0.10)'
                  }}
                  ref={emailRef}
                  title="عرض البريد الإلكتروني"
                >{user.email?.[0]?.toUpperCase() || <span>@</span>}</div>
                {showEmail && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 38,
                      right: 0,
                      background: '#fff',
                      color: '#111827',
                      border: '1px solid #dde2ec',
                      borderRadius: 8,
                      boxShadow: '0 2px 18px rgba(0,0,0,0.13)',
                      padding: '7px 16px',
                      zIndex: 9999,
                      minWidth: 180,
                      fontSize: 15
                    }}
                  >
                    ✉️ <b style={{ wordBreak:'break-word' }}>{user.email}</b>
                  </div>
                )}
              </div>
            </>
          ) : (
            <Link to="/login" className="btn primary" style={{ textDecoration: 'none', color: '#ffffff' }}>تسجيل الدخول</Link>
          )}
        </div>
      </div>
    </nav>
  )
}

const styles = {
  nav: {
    position: 'sticky' as const,
    top: 0,
    zIndex: 50,
    background: 'rgba(18,25,51,0.8)',
    backdropFilter: 'blur(6px)',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    color: '#fff',
  },
  navInner: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '10px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  brand: {
    fontWeight: 800,
    color: '#e6eaf2',
    textDecoration: 'none',
    letterSpacing: '0.5px',
  },
  links: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  burger: {
    display: 'none',
    marginLeft: 'auto',
    cursor: 'pointer',
  },
}
