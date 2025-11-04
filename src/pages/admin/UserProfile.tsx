import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

interface UserProfileData {
  user_id: string;
  full_name?: string;
  role?: string;
  email?: string;
  package_name?: string;
  started_at?: string;
  expires_at?: string;
  places_count: number;
  services_count: number;
}

export default function UserProfile() {
  const { id } = useParams();
  const [user, setUser] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string|null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setErr(null);
    supabase.rpc('get_users_with_stats')
      .then(({ data, error }) => {
        if (error) throw error;
        const found = (data || []).find((u:any) => u.user_id === id);
        setUser(found || null);
      })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div>جاري التحميل...</div>;
  if (err) return <div style={{ color:'red' }}>{err}</div>;
  if (!user) return <div>لم يتم العثور على هذا الحساب</div>;

  return (
    <div className="container" style={{ maxWidth: 580, margin: '0 auto', marginTop: 32 }}>
      <h2 style={{ marginBottom: 0 }}>{user.full_name || user.user_id}</h2>
      <div style={{ color: '#2E4053', fontSize: 15, margin: '6px 0 10px 0' }}>
        {user.email && (<span>✉️ <b>{user.email}</b></span>)}
      </div>
      <div style={{ margin: '7px 0', fontSize: 15 }}>
        <b>الـID:</b> {user.user_id}
      </div>
      <div style={{ fontSize: 15, color: '#4B5563', margin: '7px 0' }}>
        <b>الدور:</b> {user.role||'user'}
      </div>
      <div style={{ fontSize: 15, margin: '7px 0' }}>
        <b>الباقة:</b> <span style={{ color:'#1976d2' }}>{user.package_name || 'مجانية'}</span><br />
        <b>بداية الاشتراك:</b> {user.started_at ? new Date(user.started_at).toLocaleDateString() : '-'}<br />
        <b>نهاية الاشتراك:</b> {user.expires_at ? new Date(user.expires_at).toLocaleDateString() : '-'}
      </div>
      <div style={{ fontSize: 15, margin: '7px 0' }}>
        <b>عدد الأماكن:</b> {user.places_count} <b>عدد الخدمات:</b> {user.services_count}
      </div>
      {/* يمكنك إضافة أزرار إدارية أو سجل العمليات لاحقاً */}
    </div>
  );
}
