import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useFetchData } from '../hooks/useSupabase'
import { supabase } from '../lib/supabaseClient'
import ImageUploader from '../components/ImageUploader'
import type { Provider, Service, Ad } from '../types'

export default function Profile() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { data: providers, loading: providersLoading, error: providersError } = useFetchData<Provider>('providers', 'id, name, category, city, image_url, description, user_id')
  const { data: services, loading: servicesLoading, error: servicesError } = useFetchData<Service>('services', 'id, name, description, price, image_url, provider_id')
  const { data: ads, loading: adsLoading, error: adsError } = useFetchData<Ad>('ads', 'id, title, description, provider_id, status')
  const [pkgInfo, setPkgInfo] = useState<any>(null)
  const [pkgLoading, setPkgLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    let mounted = true
    ;(async () => {
      setPkgLoading(true)
      const { data, error } = await supabase.rpc('get_user_package', { p_user_id: user.id })
      if (mounted && Array.isArray(data) && data.length) setPkgInfo(data[0])
      setPkgLoading(false)
    })()
    return () => { mounted = false }
  }, [user?.id])

  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [actionLoading, setActionLoading] = useState<boolean>(false)
  const [serviceForm, setServiceForm] = useState<{ name: string; description: string; price: string; image_url: string } | null>(null)

  if (!user) {
    return <p>يجب تسجيل الدخول</p>
  }

  const userProviders = providers?.filter(provider => provider.user_id === user.id) || []
  const userServices = services?.filter(service => userProviders.some(provider => provider.id === service.provider_id)) || []
  const userAds = ads?.filter(ad => userProviders.some(provider => provider.id === ad.provider_id)) || []

  return (
    <div style={styles.container}>
      <h1>الملف الشخصي</h1>
      <div style={styles.userInfo}>
        <p><strong>الاسم:</strong> {user.full_name}</p>
        <p><strong>البريد الإلكتروني:</strong> {user.email}</p>
        <button onClick={signOut} style={styles.signOutButton}>تسجيل الخروج</button>
      </div>

      {/* تبويب الباقات والخطط */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h2>الباقات والخطط</h2>
        {pkgLoading ? <p>جارٍ التحميل...</p> : pkgInfo && pkgInfo.is_active ? (
          <>
            <p><strong>باقتك الحالية:</strong> {pkgInfo.package_name || 'مجانية' }</p>
            <p><strong>تاريخ بدء الاشتراك:</strong> {pkgInfo.started_at ? new Date(pkgInfo.started_at).toLocaleDateString() : 'غير محدد'}</p>
            <p><strong>تاريخ الانتهاء:</strong> {pkgInfo.expires_at ? new Date(pkgInfo.expires_at).toLocaleDateString() : 'غير محدد'}</p>
            <button className="btn" onClick={()=>navigate('/packages')}>ترقية أو تغيير الباقة</button>
          </>
        ) : (
          <>
            <p>أنت على الباقة المجانية (Free tier).</p>
            <button className="btn primary" onClick={()=>navigate('/packages')}>اشترك في باقة أفضل</button>
          </>
        )}
      </div>

      <h2>أماكني ({userProviders.length})</h2>
      {providersLoading && <p>جارٍ التحميل...</p>}
      {providersError && <p style={styles.error}>{providersError}</p>}
      <div style={styles.grid}>
        {userProviders.map(provider => (
          <button key={provider.id} style={styles.cardButton} onClick={() => setSelectedProvider(provider)}>
            {provider.image_url && (
              <img
                src={provider.image_url}
                alt={provider.name}
                style={styles.avatar}
                decoding="async"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const t = e.currentTarget as HTMLImageElement
                  t.onerror = null
                  t.src = 'https://placehold.co/200x200?text=No+Image'
                }}
              />
            )}
            <h3 style={{ marginTop: '0.5rem' }}>{provider.name}</h3>
            <p><strong>الفئة:</strong> {provider.category}</p>
            <p><strong>المدينة:</strong> {provider.city}</p>
          </button>
        ))}
      </div>

      <h2>خدماتي ({userServices.length})</h2>
      {servicesLoading && <p>جارٍ التحميل...</p>}
      {servicesError && <p style={styles.error}>{servicesError}</p>}
      <div style={styles.grid}>
        {userServices.map(service => (
          <button key={service.id} style={styles.cardButton} onClick={() => setSelectedService(service)}>
            {service.image_url && (
              <img
                src={service.image_url}
                alt={service.name}
                style={styles.avatar}
                decoding="async"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const t = e.currentTarget as HTMLImageElement
                  t.onerror = null
                  t.src = 'https://placehold.co/200x200?text=No+Image'
                }}
              />
            )}
            <h3 style={{ marginTop: '0.5rem' }}>{service.name}</h3>
            <p style={{ minHeight: 40 }}>{service.description}</p>
            {typeof service.price === 'number' && <p><strong>السعر:</strong> {service.price} جنيه</p>}
          </button>
        ))}
      </div>

      <h2>إعلاناتي ({userAds.length})</h2>
      {adsLoading && <p>جارٍ التحميل...</p>}
      {adsError && <p style={styles.error}>{adsError}</p>}
      <div style={styles.grid}>
        {userAds.map(ad => (
          <div key={ad.id} style={styles.card}>
            <h3>{ad.title}</h3>
            <p>{ad.description}</p>
            <p><strong>الحالة:</strong> {ad.status}</p>
          </div>
        ))}
      </div>
      {/* Provider Modal */}
      {selectedProvider && (
        <div className="modal-overlay" onClick={() => !actionLoading && setSelectedProvider(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{selectedProvider.name}</h3>
            {selectedProvider.image_url && (
              <img src={selectedProvider.image_url} alt={selectedProvider.name} style={styles.modalImage} onError={(e) => { const t = e.currentTarget as HTMLImageElement; t.onerror = null; t.src = 'https://placehold.co/400x300?text=No+Image' }} />
            )}
            {selectedProvider.description && <p>{selectedProvider.description}</p>}
            <div className="actions">
              <button onClick={() => navigate(`/place/${selectedProvider.id}`)} disabled={actionLoading} className="btn">فتح التفاصيل</button>
              <button onClick={() => navigate(`/edit-place/${selectedProvider.id}`)} disabled={actionLoading} className="btn primary">تعديل المكان</button>
              <button
                onClick={async () => {
                  if (!confirm('هل أنت متأكد من حذف هذا المكان؟ سيؤدي ذلك إلى إزالته من القوائم.')) return
                  try {
                    setActionLoading(true)
                    const { error } = await supabase.rpc('delete_provider', { p_id: selectedProvider.id, p_user_id: user.id })
                    if (error) throw error
                    setSelectedProvider(null)
                    // تحديث بسيط: إعادة تحميل الصفحة أو يمكن تحسينه بحذف العنصر محليًا
                    window.dispatchEvent(new Event('data-refresh'))
                  } catch (err) {
                    alert('فشل حذف المكان')
                  } finally {
                    setActionLoading(false)
                  }
                }}
                disabled={actionLoading}
                className="btn danger"
              >
                حذف المكان
              </button>
              <button onClick={() => setSelectedProvider(null)} disabled={actionLoading} className="btn">إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {/* Service Modal */}
      {selectedService && (
        <div className="modal-overlay" onClick={() => !actionLoading && setSelectedService(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{selectedService.name}</h3>
            {(serviceForm?.image_url || selectedService.image_url) && (
              <img src={serviceForm?.image_url || selectedService.image_url!} alt={selectedService.name} style={styles.modalImage} onError={(e) => { const t = e.currentTarget as HTMLImageElement; t.onerror = null; t.src = 'https://placehold.co/400x300?text=No+Image' }} />
            )}
            <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.5rem' }}>
              <label>
                اسم الخدمة
                <input
                  type="text"
                  value={serviceForm?.name ?? selectedService.name}
                  onChange={(e) => setServiceForm(prev => ({
                    name: e.target.value,
                    description: prev?.description ?? (selectedService.description || ''),
                    price: prev?.price ?? (typeof selectedService.price === 'number' ? String(selectedService.price) : ''),
                    image_url: prev?.image_url ?? (selectedService.image_url || '')
                  }))}
                  style={{ width: '100%' }}
                />
              </label>
              <label>
                وصف الخدمة
                <textarea
                  rows={3}
                  value={serviceForm?.description ?? (selectedService.description || '')}
                  onChange={(e) => setServiceForm(prev => ({
                    name: prev?.name ?? selectedService.name,
                    description: e.target.value,
                    price: prev?.price ?? (typeof selectedService.price === 'number' ? String(selectedService.price) : ''),
                    image_url: prev?.image_url ?? (selectedService.image_url || '')
                  }))}
                  style={{ width: '100%' }}
                />
              </label>
              <label>
                السعر
                <input
                  type="number"
                  step="0.01"
                  value={serviceForm?.price ?? (typeof selectedService.price === 'number' ? String(selectedService.price) : '')}
                  onChange={(e) => setServiceForm(prev => ({
                    name: prev?.name ?? selectedService.name,
                    description: prev?.description ?? (selectedService.description || ''),
                    price: e.target.value,
                    image_url: prev?.image_url ?? (selectedService.image_url || '')
                  }))}
                  style={{ width: '100%' }}
                />
              </label>
              <div>
                <ImageUploader
                  label="صورة الخدمة"
                  currentImageUrl={serviceForm?.image_url || selectedService.image_url || ''}
                  onUploadSuccess={(imageUrl) => setServiceForm(prev => ({
                    name: prev?.name ?? selectedService.name,
                    description: prev?.description ?? (selectedService.description || ''),
                    price: prev?.price ?? (typeof selectedService.price === 'number' ? String(selectedService.price) : ''),
                    image_url: imageUrl
                  }))}
                />
              </div>
            </div>
            <div className="actions">
              <button onClick={() => navigate(`/service/${selectedService.id}`)} disabled={actionLoading} className="btn">فتح التفاصيل</button>
              <button
                onClick={async () => {
                  try {
                    setActionLoading(true)
                    const payload = {
                      p_id: selectedService.id,
                      p_name: serviceForm?.name ?? selectedService.name,
                      p_description: serviceForm?.description ?? selectedService.description ?? null,
                      p_price: serviceForm?.price ? parseFloat(serviceForm.price) : selectedService.price ?? null,
                      p_image_url: serviceForm?.image_url ?? selectedService.image_url ?? null
                    }
                    const { error } = await supabase.rpc('update_service', payload as any)
                    if (error) throw error
                    setSelectedService(null)
                    setServiceForm(null)
                    window.dispatchEvent(new Event('data-refresh'))
                  } catch (err) {
                    alert('فشل حفظ التعديلات')
                  } finally {
                    setActionLoading(false)
                  }
                }}
                disabled={actionLoading}
                className="btn primary"
              >
                حفظ التعديلات
              </button>
              <button
                onClick={async () => {
                  if (!confirm('هل أنت متأكد من حذف هذه الخدمة؟')) return
                  try {
                    setActionLoading(true)
                    const { error } = await supabase.rpc('delete_service', { p_id: selectedService.id })
                    if (error) throw error
                    setSelectedService(null)
                    setServiceForm(null)
                    window.dispatchEvent(new Event('data-refresh'))
                  } catch (err) {
                    alert('فشل حذف الخدمة')
                  } finally {
                    setActionLoading(false)
                  }
                }}
                disabled={actionLoading}
                className="btn danger"
              >
                حذف الخدمة
              </button>
              <button onClick={() => { setSelectedService(null); setServiceForm(null) }} disabled={actionLoading} className="btn">إغلاق</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '2rem',
    fontFamily: 'Arial, sans-serif',
  },
  userInfo: {
    background: '#f8f9fa',
    padding: '1.5rem',
    borderRadius: '8px',
    marginBottom: '2rem',
  },
  signOutButton: {
    background: '#dc3545',
    color: 'white',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    cursor: 'pointer',
    marginTop: '1rem',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '1rem',
    marginBottom: '2rem',
  },
  cardButton: {
    background: 'white',
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '1rem',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    textAlign: 'center' as const,
    cursor: 'pointer',
  },
  avatar: {
    width: 90,
    height: 90,
    objectFit: 'cover' as const,
    borderRadius: '50%',
    display: 'block',
    margin: '0 auto',
    background: '#f2f2f2',
  },
  error: {
    color: '#dc3545',
    background: '#f8d7da',
    padding: '0.5rem',
    borderRadius: '4px',
    marginBottom: '1rem',
  },
  modalOverlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '1rem',
  },
  modal: {
    background: '#fff',
    borderRadius: 8,
    padding: '1rem',
    width: '100%',
    maxWidth: 520,
    boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
  },
  modalImage: {
    width: '100%',
    height: 240,
    objectFit: 'cover' as const,
    borderRadius: 8,
    background: '#f2f2f2',
  },
}
