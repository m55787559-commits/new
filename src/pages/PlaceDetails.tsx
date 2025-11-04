import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import ServiceCard from '../components/ServiceCard'
import type { Service } from '../types'
import { useFetchData } from '../hooks/useSupabase'
import { useAuth } from '../hooks/useAuth'

interface Provider {
  id: number
  name: string
  category: string
  city: string
  address: string
  phone: string
  website: string
  whatsapp: string
  map_url: string
  description: string
  image_url: string
  user_id?: string
}

export default function PlaceDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: provider, loading, error } = useFetchData<Provider>('providers', '*')
  const [services, setServices] = useState<Service[]>([])
  const [servicesLoading, setServicesLoading] = useState<boolean>(false)
  const [sortBy, setSortBy] = useState<'latest' | 'price_asc' | 'price_desc'>('latest')
  const [filterBy, setFilterBy] = useState<'all' | 'delivery' | 'online'>('all')

  // سجل زيارة الصفحة
  useEffect(() => {
    if (!id) return
    ;(async () => {
      try {
        const page = `/place/${id}`
        await supabase.rpc('record_visit', { p_page: page })
        // حدّث عداد الجلسة لعرضه في الهيدر
        try {
          const raw = sessionStorage.getItem('session_pages') || '[]'
          const arr = JSON.parse(raw) as string[]
          if (!arr.includes(page)) {
            arr.push(page)
            sessionStorage.setItem('session_pages', JSON.stringify(arr))
          }
          window.dispatchEvent(new Event('data-refresh'))
        } catch (_) {}
      } catch (_) {
        // ignore
      }
    })()
  }, [id])

  // جلب خدمات المكان
  useEffect(() => {
    const pid = parseInt(id || '0')
    if (!pid) return
    ;(async () => {
      try {
        setServicesLoading(true)
        const { data, error } = await supabase
          .from('services')
          .select('id, provider_id, name, description, price, image_url, delivery, online')
          .eq('provider_id', pid)
          .order('created_at', { ascending: false })
        if (!error && data) setServices(data as Service[])
      } finally {
        setServicesLoading(false)
      }
    })()
  }, [id])

  if (loading) return <div className="loading"><p>جارٍ التحميل...</p></div>
  if (error) return <p className="error">خطأ: {error}</p>
  const place = provider.find(p => p.id === parseInt(id || '0'))
  if (!place) return <p>المكان غير موجود</p>

  const isOwner = user && provider.find(p => p.id === parseInt(id || '0'))?.user_id === user.id

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1>{place.name}</h1>
        {isOwner && (
          <button 
            onClick={() => navigate(`/edit-place/${id}`)}
            style={{ 
              background: '#007bff', 
              color: 'white', 
              border: 'none', 
              padding: '0.5rem 1rem', 
              borderRadius: '5px', 
              cursor: 'pointer' 
            }}
          >
            ✏️ تعديل
          </button>
        )}
      </div>
      {place.image_url && (
        <img src={place.image_url} alt={place.name} style={{ width: '100%', maxWidth: '600px', borderRadius: '8px' }} />
      )}
      <p><strong>الفئة:</strong> {place.category}</p>
      <p><strong>المدينة:</strong> {place.city}</p>
      <p><strong>العنوان:</strong> {place.address}</p>
      <p><strong>الهاتف:</strong> {place.phone}</p>
      {place.website && <p><strong>الموقع:</strong> <a href={place.website} target="_blank" rel="noopener noreferrer">{place.website}</a></p>}
      {place.whatsapp && <p><strong>واتساب:</strong> {place.whatsapp}</p>}
      {place.map_url && <p><strong>الخريطة:</strong> <a href={place.map_url} target="_blank" rel="noopener noreferrer">عرض على الخريطة</a></p>}
      <p><strong>الوصف:</strong> {place.description}</p>

      {/* الخدمات التابعة للمكان */}
      <div style={{ marginTop: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0 }}>الخدمات ({services.length})</h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '0.9rem' }}>ترتيب:</label>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} style={{ padding: '0.3rem 0.5rem' }}>
              <option value="latest">الأحدث</option>
              <option value="price_asc">السعر: من الأقل للأعلى</option>
              <option value="price_desc">السعر: من الأعلى للأقل</option>
            </select>
            <label style={{ fontSize: '0.9rem', marginInlineStart: '0.75rem' }}>فلتر:</label>
            <select value={filterBy} onChange={e => setFilterBy(e.target.value as any)} style={{ padding: '0.3rem 0.5rem' }}>
              <option value="all">الكل</option>
              <option value="delivery">التوصيل فقط</option>
              <option value="online">أونلاين فقط</option>
            </select>
          </div>
        </div>

        {servicesLoading ? (
          <p>جارٍ تحميل الخدمات...</p>
        ) : (() => {
          let list = [...services]
          if (filterBy === 'delivery') list = list.filter(s => !!s.delivery)
          if (filterBy === 'online') list = list.filter(s => !!s.online)
          if (sortBy === 'price_asc') list.sort((a, b) => (Number(a.price || 0) - Number(b.price || 0)))
          if (sortBy === 'price_desc') list.sort((a, b) => (Number(b.price || 0) - Number(a.price || 0)))
          // latest: يُحافظ على ترتيب الجلب (الأحدث أولاً)
          return list.length === 0 ? (
            <p>لا توجد خدمات بهذه المعايير.</p>
          ) : (
            <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
              {list.map(s => (
                <div key={s.id} style={{ position: 'relative' }}>
                  {typeof s.price === 'number' && (
                    <span style={{ position: 'absolute', top: '8px', left: '8px', background: '#fff3cd', color: '#856404', border: '1px solid #ffeeba', borderRadius: '12px', padding: '2px 8px', fontSize: '0.8rem' }}>
                      {s.price} ج.م
                    </span>
                  )}
                  <ServiceCard service={s} />
                </div>
              ))}
            </div>
          )
        })()}
      </div>
    </div>
  )
}
