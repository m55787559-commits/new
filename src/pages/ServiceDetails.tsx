import { useParams } from 'react-router-dom'
import { useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useFetchData } from '../hooks/useSupabase'
import type { Service, Provider } from '../types'

export default function ServiceDetails() {
  const { id } = useParams<{ id: string }>()
  const { data: services, loading: servicesLoading, error: servicesError } = useFetchData<Service>('services', '*')
  const { data: providers, loading: providersLoading, error: providersError } = useFetchData<Provider>('providers', 'id, name, city, phone, whatsapp, address')

  // سجل زيارة صفحة الخدمة
  useEffect(() => {
    if (!id) return
    ;(async () => {
      try {
        const page = `/service/${id}`
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

  if (servicesLoading || providersLoading) return <div style={styles.loading}><p>جارٍ التحميل...</p></div>
  if (servicesError || providersError) return <p style={styles.error}>خطأ: {servicesError || providersError}</p>

  const service = services?.find(s => s.id === parseInt(id || '0'))
  if (!service) return <p style={styles.notFound}>الخدمة غير موجودة</p>

  const provider = providers?.find(p => p.id === service.provider_id)

  return (
    <div style={styles.container}>
      <h1>{service.name}</h1>

      <div style={styles.details}>
        <div style={styles.section}>
          <h2>تفاصيل الخدمة</h2>
          <p><strong>الوصف:</strong> {service.description}</p>
          {service.price && <p><strong>السعر:</strong> {service.price} جنيه</p>}
          {service.delivery && <p><strong>التوصيل:</strong> {service.delivery ? 'متاح' : 'غير متاح'}</p>}
          {service.online && <p><strong>متاح عبر الإنترنت:</strong> {service.online ? 'نعم' : 'لا'}</p>}
        </div>

        {provider && (
          <div style={styles.section}>
            <h2>معلومات المزود</h2>
            <p><strong>الاسم:</strong> {provider.name}</p>
            <p><strong>المدينة:</strong> {provider.city}</p>
            {provider.phone && <p><strong>الهاتف:</strong> {provider.phone}</p>}
            {provider.whatsapp && <p><strong>واتساب:</strong> {provider.whatsapp}</p>}
            {provider.address && <p><strong>العنوان:</strong> {provider.address}</p>}
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '2rem',
    fontFamily: 'Arial, sans-serif',
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '200px',
    fontSize: '1.2rem',
  },
  error: {
    color: '#dc3545',
    textAlign: 'center' as const,
    padding: '2rem',
  },
  notFound: {
    textAlign: 'center' as const,
    padding: '2rem',
    color: '#666',
  },
  details: {
    display: 'grid',
    gap: '2rem',
    gridTemplateColumns: '1fr',
  },
  section: {
    background: '#f8f9fa',
    padding: '1.5rem',
    borderRadius: '8px',
    border: '1px solid #e9ecef',
  },
}
