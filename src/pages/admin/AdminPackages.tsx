import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

type PackageRow = {
  id: number
  name: string
  price: number
  duration_days: number
  is_active?: boolean
  description?: string
  max_places?: number
  priority_weight?: number
}

export default function AdminPackages() {
  const [items, setItems] = useState<PackageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', price: '', duration_days: '', description: '', max_places: '', priority_weight: '' })
  const [manualSub, setManualSub] = useState<{ user_id: string; package_id: string; amount: string }>({ user_id: '', package_id: '', amount: '' })

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase.from('packages').select('id, name, price, duration_days, is_active, description, max_places, priority_weight, created_at').order('created_at', { ascending: false })
      if (error) throw error
      setItems((data || []) as any)
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const upsertPackage = async (existing?: PackageRow) => {
    const isEdit = !!existing
    const name = isEdit ? existing!.name : form.name.trim()
    if (!name) return alert('يرجى إدخال اسم الباقة')
    const price = isEdit ? existing!.price : (Number(form.price) || 0)
    const duration = isEdit ? existing!.duration_days : (Number(form.duration_days) || 30)
    const isActive = isEdit ? !!existing!.is_active : true
    const description = isEdit ? (existing!.description || null) : (form.description.trim() || null)
    const maxPlaces = isEdit ? (existing!.max_places ?? 1) : (Number(form.max_places) || 1)
    const priorityWeight = isEdit ? (existing!.priority_weight ?? 0) : (Number(form.priority_weight) || 0)

    const { error } = await supabase.rpc('admin_upsert_package', {
      p_id: isEdit ? existing!.id : null,
      p_name: name,
      p_price: price,
      p_duration_days: duration,
      p_is_active: isActive,
      p_description: description,
      p_max_places: maxPlaces,
      p_priority_weight: priorityWeight,
    })
    if (error) return alert('فشل الحفظ: ' + error.message)
    setForm({ name: '', price: '', duration_days: '', description: '', max_places: '', priority_weight: '' })
    fetchData()
  }

  const toggleActive = async (row: PackageRow) => {
    const prev = items
    const updated = { ...row, is_active: !row.is_active }
    setItems(prev => prev.map(p => p.id === row.id ? updated : p))
    const { error } = await supabase.rpc('admin_upsert_package', {
      p_id: row.id,
      p_name: row.name,
      p_price: row.price,
      p_duration_days: row.duration_days,
      p_is_active: !row.is_active,
      p_description: row.description || null,
      p_max_places: row.max_places ?? 1,
      p_priority_weight: row.priority_weight ?? 0,
    })
    if (error) {
      alert('فشل التحديث: ' + error.message)
      setItems(prev)
    }
  }

  const createManualSubscription = async () => {
    if (!manualSub.user_id.trim() || !manualSub.package_id.trim()) return alert('يرجى إدخال user_id و package_id')
    const { error } = await supabase.rpc('admin_create_manual_subscription', {
      p_user_id: manualSub.user_id.trim(),
      p_package_id: Number(manualSub.package_id),
      p_amount: manualSub.amount ? Number(manualSub.amount) : null,
    })
    if (error) return alert('فشل الاشتراك: ' + error.message)
    alert('تم إنشاء الاشتراك اليدوي بنجاح')
    setManualSub({ user_id: '', package_id: '', amount: '' })
  }

  const deletePackage = async (row: PackageRow) => {
    if (!confirm(`هل تريد حذف الباقة "${row.name}"؟`)) return
    const prev = items
    setItems(prev => prev.filter(p => p.id !== row.id))
    const { error } = await supabase.rpc('admin_delete_package', { p_id: row.id })
    if (error) {
      alert('فشل الحذف: ' + error.message)
      setItems(prev)
    } else {
      // تأكيد بالحصول على أحدث بيانات
      fetchData()
    }
  }

  return (
    <div className="container">
      <h1 style={{ marginBottom: '1rem' }}>إدارة الباقات</h1>
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h3>إضافة/حفظ باقة</h3>
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <input placeholder="الاسم" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input placeholder="السعر" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
          <input placeholder="أيام الاشتراك" value={form.duration_days} onChange={e => setForm({ ...form, duration_days: e.target.value })} />
          <input placeholder="الحد الأقصى للأماكن" value={form.max_places} onChange={e => setForm({ ...form, max_places: e.target.value })} />
          <input placeholder="وزن الأولوية" value={form.priority_weight} onChange={e => setForm({ ...form, priority_weight: e.target.value })} />
          <input placeholder="الوصف (اختياري)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <button onClick={() => upsertPackage()} className="btn primary">حفظ</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h3>اشتراك يدوي (إداري)</h3>
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <input placeholder="user_id (UUID)" value={manualSub.user_id} onChange={e => setManualSub({ ...manualSub, user_id: e.target.value })} />
          <input placeholder="package_id" value={manualSub.package_id} onChange={e => setManualSub({ ...manualSub, package_id: e.target.value })} />
          <input placeholder="amount (اختياري)" value={manualSub.amount} onChange={e => setManualSub({ ...manualSub, amount: e.target.value })} />
          <button onClick={createManualSubscription} className="btn">اشتراك</button>
        </div>
      </div>

      {loading ? (
        <div className="loading"><p>جارٍ التحميل...</p></div>
      ) : error ? (
        <p className="error">{error}</p>
      ) : (
        <div className="grid cards">
          {items.map(p => (
            <div key={p.id} className="card">
              <h3>{p.name}</h3>
              <p>السعر: {p.price}</p>
              <p>المدة: {p.duration_days} يوم</p>
              <p>الحد الأقصى للأماكن: {p.max_places ?? 1}</p>
              <p>وزن الأولوية: {p.priority_weight ?? 0}</p>
              {p.description && <p>{p.description}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={() => toggleActive(p)}>
                  {p.is_active ? 'تعطيل' : 'تفعيل'}
                </button>
                <button className="btn ghost" onClick={() => upsertPackage(p)}>حفظ</button>
                <button className="btn danger" onClick={() => deletePackage(p)}>حذف</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


