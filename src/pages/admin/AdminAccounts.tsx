import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useNavigate } from 'react-router-dom'

interface UserStatsRow {
  user_id: string;
  full_name?: string;
  role?: string;
  email?: string;     // <-- أضف البريد الإلكتروني
  package_name?: string;
  started_at?: string;
  expires_at?: string;
  places_count: number;
  services_count: number;
}

export default function AdminAccounts() {
  const [users, setUsers] = useState<UserStatsRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [actions, setActions] = useState<{ [k: string]: boolean }>({})
  const navigate = useNavigate();

  const fetchUsers = async () => {
    setLoading(true)
    setErr(null)
    try {
      const { data, error } = await supabase.rpc('get_users_with_stats')
      if (error) throw error
      setUsers(data || [])
    } catch (e:any) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(()=>{ fetchUsers() }, [])

  const roles = ['user', 'admin', 'owner', 'affiliate'] // أضف affiliate
  const changeRole = async (userId: string, newRole: string) => {
    if (!window.confirm(`تأكيد تحويل المستخدم إلى: ${newRole}`)) return
    setActions(actions=>({...actions,[userId]:true}))
    const { error } = await supabase.rpc('admin_set_user_role', { p_user_id: userId, p_role: newRole })
    setActions(actions=>({...actions,[userId]:false}))
    if (error) { alert('فشل التغيير: ' + error.message) } else { fetchUsers() }
  }

  // تعريف ألوان الأزرار حسب الدور
  const roleColors: { [role: string]: string } = {
    user: '#89909e', // رمادي
    admin: '#1976d2', // أزرق
    owner: '#23272f', // أسود داكن
    affiliate: '#20a860', // أخضر
  };

  // فلترة النتائج بالاسم فقط
  const filtered = query.trim().length > 0
    ? users.filter(u => (u.full_name||'').toLowerCase().includes(query.trim().toLowerCase()))
    : users

  return (
    <div className="container">
      <h1>إدارة حسابات المستخدمين</h1>
      <div style={{ display:'flex', gap:12, marginBottom:16 }}>
        <input placeholder="بحث بالاسم..." value={query} onChange={e=>setQuery(e.target.value)} />
        <button onClick={fetchUsers}>تحديث</button>
      </div>
      {loading && <div>جاري التحميل...</div>}
      {err && <div style={{color:'red'}}>{err}</div>}
      <div className="grid cards">
        {filtered.map(u=> (
          <div className="card" key={u.user_id} style={{cursor: 'pointer'}} onClick={() => navigate(`/admin/user/${u.user_id}`)}>
            <b style={{textDecoration: 'underline', color: '#1976d2'}}>{u.full_name||u.user_id}</b>
            <div style={{ color: '#2E4053', fontSize: 13, margin: '2px 0 6px 0' }}>
              {u.email && <span>✉️ <b>{u.email}</b></span>}
            </div>
            <div style={{ margin: '4px 0', fontSize: 13, color: '#6b7280' }}>
              الدور: <b>{u.role||'user'}</b>
            </div>
            <div style={{ margin: '4px 0', fontSize: 13, color: '#374151' }}>
              الباقة: <b>{u.package_name || 'مجانية'}</b><br />
              بداية الاشتراك: {u.started_at ? new Date(u.started_at).toLocaleDateString() : '-'}<br />
              نهاية الاشتراك: {u.expires_at ? new Date(u.expires_at).toLocaleDateString() : '-'}
            </div>
            <div style={{ margin: '4px 0', fontSize: 13 }}>
              عدد الأماكن: <b>{u.places_count}</b> | عدد الخدمات: <b>{u.services_count}</b>
            </div>
            <div style={{display:'flex', alignItems:'center', gap:10, margin:'8px 0', flexWrap:'wrap'}} onClick={(e)=>e.stopPropagation()}>
              {roles.map(role => (
                <button
                  key={role}
                  disabled={u.role===role||actions[u.user_id]}
                  className="btn ghost"
                  style={{
                    opacity: u.role===role ? 0.7 : 1,
                    background: u.role===role ? '#eee' : roleColors[role] || '#ccc',
                    color: u.role === 'owner' && role === 'owner' ? '#fff' : '#fff',
                    border: 'none',
                    minWidth: 68
                  }}
                  onClick={()=>changeRole(u.user_id,role)}
                >
                  {role}
                </button>
              ))}
            </div>
            {/* تم إخفاء الـ id بناءً على رغبة العميل */}
          </div>
        ))}
        {filtered.length === 0 && !loading && <div>لا يوجد نتائج مطابقة.</div>}
      </div>
    </div>
  )
}
