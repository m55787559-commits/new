import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

type ProviderRow = {
  id: number
  name: string
  city?: string
  category?: string
  status?: string
  created_at?: string
}

export default function AdminProviders() {
  const [providers, setProviders] = useState<ProviderRow[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'pending' | 'active' | 'all'>('pending')
  const [q, setQ] = useState('')

  const fetchProviders = async () => {
    setLoading(true)
    setError(null)
    try {
      let query = supabase.from('providers').select('id, name, city, category, status, created_at').order('created_at', { ascending: false }).limit(200)
      if (filter !== 'all') query = query.eq('status', filter)
      if (q.trim()) query = query.ilike('name', `%${q.trim()}%`)
      const { data, error } = await query
      if (error) throw error
      setProviders(data || [])
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProviders() }, [filter])

  const updateStatus = async (id: number, status: 'active' | 'pending') => {
    const prev = providers
    setProviders(prev => prev.map(p => p.id === id ? { ...p, status } : p))
    const { error } = await supabase.rpc('admin_set_provider_status', { p_provider_id: id, p_status: status })
    if (error) {
      alert('فشل التحديث: ' + error.message)
      setProviders(prev)
    }
  }

  return (
    <div className="container">
      <h1 style={{ marginBottom: '1rem' }}>إدارة الأماكن</h1>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', flexWrap: 'wrap' as const }}>
        <select value={filter} onChange={e => setFilter(e.target.value as any)}>
          <option value="pending">قيد الانتظار</option>
          <option value="active">نشطة</option>
          <option value="all">الكل</option>
        </select>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث بالاسم" />
        <button onClick={fetchProviders}>تحديث</button>
      </div>
      {loading ? (
        <div className="loading"><p>جارٍ التحميل...</p></div>
      ) : error ? (
        <p className="error">{error}</p>
      ) : (
        <div className="grid cards">
          {providers.map(p => (
            <div key={p.id} className="card">
              <h3>{p.name}</h3>
              <p>{p.category} • {p.city}</p>
              <p>الحالة: <b>{p.status || '—'}</b></p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={() => updateStatus(p.id, 'active')}>تفعيل</button>
                <button className="btn ghost" onClick={() => updateStatus(p.id, 'pending')}>تعليق</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


