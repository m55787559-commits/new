import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabaseClient'
import type { Activity } from '../types'
import ImageUploader from '../components/ImageUploader'

export default function AddPlace() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasPhysicalLocation, setHasPhysicalLocation] = useState(true)
  const [mapModalOpen, setMapModalOpen] = useState(false)
  const [locating, setLocating] = useState(false)
  const [mapCoords, setMapCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [searchText, setSearchText] = useState('')
  const [mapSearching, setMapSearching] = useState(false)

  // حاول إظهار خريطة تلقائيًا عند فتح المودال
  useEffect(() => {
    if (!mapModalOpen) return
    let cancelled = false
    const setDefault = () => {
      if (!cancelled) setMapCoords({ lat: 30.0444, lon: 31.2357 }) // Cairo as fallback
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return
          const lat = Number(pos.coords.latitude.toFixed(6))
          const lon = Number(pos.coords.longitude.toFixed(6))
          setMapCoords({ lat, lon })
        },
        () => setDefault(),
        { enableHighAccuracy: true, timeout: 5000 }
      )
    } else {
      setDefault()
    }
    return () => { cancelled = true }
  }, [mapModalOpen])

  // جلب الفئات من قاعدة البيانات
  useEffect(() => {
    const fetchCategories = async () => {
      // محاولة استخدام RPC أولاً
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_categories')
      if (rpcError || !rpcData) {
        console.log('⚠️ RPC get_categories failed, trying direct query...')
        // استخدام استعلام مباشر كبديل
        const { data, error } = await supabase.from('activities').select('*')
        if (error) {
          console.error('Error fetching categories:', error)
        } else {
          setActivities(data || [])
        }
      } else {
        setActivities(rpcData || [])
      }
    }
    fetchCategories()
  }, [])
  const [formData, setFormData] = useState({
    name: '',
    activity_id: '',
    city: '',
    address: '',
    phone: '',
    website: '',
    whatsapp: '',
    map_url: '',
    description: '',
    image_url: ''
  })

  const normalizeUrl = (value: string): string => {
    if (!value) return value
    const trimmed = value.trim()
    if (/^https?:\/\//i.test(trimmed)) return trimmed
    // Allow facebook pages like facebook.com/... without protocol
    if (/^([\w-]+\.)+[\w-]+\//.test(trimmed) || /^facebook\.com\//i.test(trimmed)) {
      return `https://${trimmed}`
    }
    return trimmed
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('User in AddPlace:', user)
    if (!user) {
      alert('يجب تسجيل الدخول أولاً')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // تحقق من الحصة المسموح بها حسب الباقة
      try {
        const { data: canAdd, error: canErr } = await supabase.rpc('can_add_provider', { p_user_id: user.id })
        if (!canErr && Array.isArray(canAdd) && canAdd.length > 0) {
          const row = canAdd[0] as any
          if (row.allowed === false) {
            if (window.confirm(`لقد وصلت إلى الحد الأقصى من الأماكن (${row.current_count}/${row.max_places}) ضمن باقة: ${row.tier}. برجاء ترقية الباقة لإضافة المزيد.\nاضغط موافق للانتقال إلى صفحة الباقات.`)) {
              navigate('/packages')
            }
            setLoading(false)
            return
          }
        }
      } catch (_) {
        // لو فشل التحقق لا نمنع المستخدم، نسمح بالمتابعة كتجربة مرنة
      }

      const normalizedWebsite = normalizeUrl(formData.website)
      // استخدام دالة RPC add_provider حسب القواعد
      const { data, error: rpcError } = await supabase.rpc('add_provider', {
        p_name: formData.name,
        p_category: formData.activity_id ? activities.find(a => a.id === parseInt(formData.activity_id))?.name : null,
        p_city: formData.city || null,
        p_address: hasPhysicalLocation ? (formData.address || null) : 'اون لاين',
        p_phone: formData.phone || null,
        p_website: normalizedWebsite || null,
        p_whatsapp: formData.whatsapp || null,
        p_map_url: hasPhysicalLocation ? (formData.map_url || null) : null,
        p_description: formData.description || null,
        p_image_url: formData.image_url || null,
        p_lat: null,
        p_lng: null,
        p_type: hasPhysicalLocation ? 'place' : 'اون لاين',
        p_delivery: false,
        p_area: null,
        p_user_id: user.id,
        p_activity_id: formData.activity_id ? parseInt(formData.activity_id) : null,
        p_package_id: null
      })

      if (rpcError) {
        console.error('RPC Error:', rpcError)
        console.error('Error details:', JSON.stringify(rpcError, null, 2))
        throw rpcError
      }

      console.log('RPC Result:', data)
      
      // إرسال حدث لإعادة تحميل البيانات في الصفحة الرئيسية
      window.dispatchEvent(new Event('data-refresh'))
      
      alert('تم إضافة المكان بنجاح!')
      navigate('/')
    } catch (err: unknown) {
      console.error('Error adding place:', err)
      const errorMessage = err instanceof Error ? err.message : 'حدث خطأ غير متوقع'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return <p>يجب تسجيل الدخول لإضافة مكان</p>
  }

  return (
    <div className="container">
      <h1>إضافة مكان جديد</h1>
      <form onSubmit={handleSubmit} style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.25rem' }}>نوع المكان</label>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <label>
              <input
                type="radio"
                name="place_type"
                checked={hasPhysicalLocation}
                onChange={() => setHasPhysicalLocation(true)}
                style={{ marginInlineEnd: '0.4rem' }}
              />
              بمكان (عنوان فعلي)
            </label>
            <label>
              <input
                type="radio"
                name="place_type"
                checked={!hasPhysicalLocation}
                onChange={() => setHasPhysicalLocation(false)}
                style={{ marginInlineEnd: '0.4rem' }}
              />
              بدون مكان (أونلاين)
            </label>
          </div>
        </div>
        <div className="field" style={{ marginBottom: '1rem' }}>
          <label>اسم المكان *</label>
          <input className="input"
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>
        <div className="field" style={{ marginBottom: '1rem' }}>
          <label>الفئة</label>
          <select className="select"
            name="activity_id"
            value={formData.activity_id}
            onChange={handleChange}
          >
            <option value="">اختر الفئة</option>
            {activities.map((activity: Activity) => (
              <option key={activity.id} value={activity.id}>
                {activity.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ marginBottom: '1rem' }}>
          <label>المدينة</label>
          <input className="input"
            type="text"
            name="city"
            value={formData.city}
            onChange={handleChange}
          />
        </div>
        {hasPhysicalLocation && (
          <div className="field" style={{ marginBottom: '1rem' }}>
            <label>العنوان</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input className="input"
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder={'اكتب العنوان' }
                style={{ flex: 1 }}
              />
              <button className="btn"
                type="button"
                onClick={() => setMapModalOpen(true)}
                style={{ padding: '0.4rem 0.8rem' }}
              >
                تحديد على الخريطة
              </button>
            </div>
          </div>
        )}
        <div className="field" style={{ marginBottom: '1rem' }}>
          <label>الهاتف</label>
          <input className="input"
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
          />
        </div>
        <div className="field" style={{ marginBottom: '1rem' }}>
        <label>الموقع الإلكتروني / صفحة فيسبوك</label>
          <input className="input"
            type="url"
            name="website"
            value={formData.website}
            onChange={handleChange}
            placeholder="مثال: https://example.com أو https://facebook.com/yourpage"
          />
        </div>
        <div className="field" style={{ marginBottom: '1rem' }}>
          <label>واتساب</label>
          <input className="input"
            type="tel"
            name="whatsapp"
            value={formData.whatsapp}
            onChange={handleChange}
          />
        </div>
        {/* تم إخفاء حقل رابط الخريطة حسب الطلب */}
        <div className="field" style={{ marginBottom: '1rem' }}>
          <label>وصف المكان</label>
          <textarea className="textarea"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={4}
          />
        </div>
        <ImageUploader
          label="صورة المكان"
          onUploadSuccess={(imageUrl) => setFormData({ ...formData, image_url: imageUrl })}
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={loading} className="btn primary" style={{ marginTop: '0.5rem' }}>
          {loading ? 'جارٍ الإضافة...' : 'إضافة المكان'}
        </button>
      </form>

      {/* Map Picker Modal (بسيط يعتمد على تحديد الموقع الحالي + Reverse Geocoding) */}
      {mapModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', width: '90%', maxWidth: 520, borderRadius: 8, padding: '1rem', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginTop: 0 }}>تحديد الموقع</h3>
            <p style={{ color: '#555' }}>اختر موقعك. سنعرض خريطة على موقعك الحالي أو نتيجة بحثك، ثم نحول الموقع لعنوان تلقائيًا. يمكنك تعديل العنوان يدويًا بعد ذلك.</p>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="ابحث بعنوان/منطقة (مثال: مدينة نصر، القاهرة)"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ flex: 1, minWidth: 220, padding: '0.4rem 0.6rem' }}
              />
              <button
                type="button"
                disabled={mapSearching || !searchText.trim()}
                onClick={async () => {
                  try {
                    setMapSearching(true)
                    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(searchText)}`)
                    const results = await res.json()
                    if (Array.isArray(results) && results.length > 0) {
                      const r = results[0]
                      const lat = Number(Number(r.lat).toFixed(6))
                      const lon = Number(Number(r.lon).toFixed(6))
                      setMapCoords({ lat, lon })
                      const coords = `${lat}, ${lon}`
                      const mapLink = `https://www.google.com/maps?q=${lat},${lon}`
                      setFormData(prev => ({ ...prev, address: r.display_name || prev.address || `إحداثيات: ${coords}`, map_url: mapLink }))
                    } else {
                      alert('لم يتم العثور على نتائج لهذا البحث')
                    }
                  } catch (_) {
                    alert('حدث خطأ في البحث')
                  } finally {
                    setMapSearching(false)
                  }
                }}
                style={{ padding: '0.4rem 0.8rem' }}
              >
                {mapSearching ? 'يجري البحث...' : 'بحث'}
              </button>
            </div>
            {/* Map preview */}
            <div style={{ width: '100%', height: 300, borderRadius: 6, overflow: 'hidden', border: '1px solid #e5e7eb', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
              {mapCoords ? (
                <iframe
                  title="map"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  src={`https://www.openstreetmap.org/export/embed.html?layer=mapnik&marker=${mapCoords.lat},${mapCoords.lon}&zoom=15`}
                />
              ) : (
                <small style={{ color: '#666' }}>لم يتم تحديد الموقع بعد</small>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={locating}
                onClick={async () => {
                  if (!navigator.geolocation) { alert('المتصفح لا يدعم تحديد الموقع'); return }
                  setLocating(true)
                  navigator.geolocation.getCurrentPosition(async (pos) => {
                    try {
                      const { latitude, longitude } = pos.coords
                      const coords = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
                      const mapLink = `https://www.google.com/maps?q=${coords}`
                      setMapCoords({ lat: Number(latitude.toFixed(6)), lon: Number(longitude.toFixed(6)) })
                      // Reverse geocoding via Nominatim
                      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`)
                      const js = await res.json()
                      const display = js?.display_name || `إحداثيات: ${coords}`
                      setFormData(prev => ({ ...prev, address: display, map_url: mapLink }))
                    } catch (e) {
                      alert('تعذر جلب العنوان تلقائيًا')
                    } finally {
                      setLocating(false)
                    }
                  }, () => { alert('تعذر تحديد الموقع'); setLocating(false) })
                }}
                style={{ padding: '0.6rem 1rem' }}
              >
                {locating ? 'جاري التحديد...' : 'استخدم موقعي الحالي'}
              </button>
              {mapCoords && (
                <button
                  type="button"
                  onClick={() => {
                    const q = `${mapCoords.lat},${mapCoords.lon}`
                    window.open(`https://www.google.com/maps?q=${q}`, '_blank', 'noopener,noreferrer')
                  }}
                  style={{ padding: '0.6rem 1rem' }}
                >
                  فتح في خرائط جوجل
                </button>
              )}
              <button type="button" onClick={() => setMapModalOpen(false)} style={{ padding: '0.6rem 1rem', background: '#eee', border: '1px solid #ddd' }}>تم</button>
              <button type="button" onClick={() => setMapModalOpen(false)} style={{ padding: '0.6rem 1rem', background: '#eee', border: '1px solid #ddd' }}>إلغاء</button>
            </div>
            <small style={{ display: 'block', marginTop: '0.5rem', color: '#777' }}>ملاحظة: يمكنك فتح خرائط جوجل لتعديل الموقع يدويًا بعد الحفظ.</small>
          </div>
        </div>
      )}
    </div>
  )
}
