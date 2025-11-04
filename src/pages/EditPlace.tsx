import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabaseClient'
import type { Activity } from '../types'
import ImageUploader from '../components/ImageUploader'

export default function EditPlace() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  // جلب بيانات المزود
  useEffect(() => {
    const fetchProvider = async () => {
      try {
        const { data, error: fetchError } = await supabase.rpc('get_provider_by_id', {
          p_id: parseInt(id || '0')
        })
        
        if (fetchError) {
          console.error('Error fetching provider:', fetchError)
          setError('فشل في جلب البيانات')
          return
        }

        if (data && data.length > 0) {
          const provider = data[0]
          setFormData({
            name: provider.name || '',
            activity_id: provider.activity_id?.toString() || '',
            city: provider.city || '',
            address: provider.address || '',
            phone: provider.phone || '',
            website: provider.website || '',
            whatsapp: provider.whatsapp || '',
            map_url: provider.map_url || '',
            description: provider.description || '',
            image_url: provider.image_url || ''
          })
        }
      } catch (err) {
        console.error('Error:', err)
        setError('حدث خطأ غير متوقع')
      } finally {
        setFetching(false)
      }
    }

    fetchProvider()
  }, [id])

  // جلب الفئات
  useEffect(() => {
    const fetchCategories = async () => {
      const { data, error } = await supabase.from('activities').select('*')
      if (error) {
        console.error('Error fetching categories:', error)
      } else {
        setActivities(data || [])
      }
    }
    fetchCategories()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      alert('يجب تسجيل الدخول أولاً')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const normalizeUrl = (value: string): string => {
        if (!value) return value
        const trimmed = value.trim()
        if (/^https?:\/\//i.test(trimmed)) return trimmed
        if (/^([\w-]+\.)+[\w-]+\//.test(trimmed) || /^facebook\.com\//i.test(trimmed)) {
          return `https://${trimmed}`
        }
        return trimmed
      }
      const normalizedWebsite = normalizeUrl(formData.website)
      const { data, error: updateError } = await supabase.rpc('update_provider', {
        p_id: parseInt(id || '0'),
        p_name: formData.name,
        p_category: formData.activity_id ? activities.find(a => a.id === parseInt(formData.activity_id))?.name : null,
        p_city: formData.city || null,
        p_address: formData.address || null,
        p_phone: formData.phone || null,
        p_website: normalizedWebsite || null,
        p_whatsapp: formData.whatsapp || null,
        p_map_url: formData.map_url || null,
        p_description: formData.description || null,
        p_image_url: formData.image_url || null,
        p_user_id: user.id
      })

      if (updateError) {
        console.error('Update Error:', updateError)
        throw updateError
      }

      alert('تم تعديل المكان بنجاح!')
      
      // إرسال حدث لإعادة تحميل البيانات
      window.dispatchEvent(new Event('data-refresh'))
      
      navigate('/')
    } catch (err: unknown) {
      console.error('Error updating place:', err)
      const errorMessage = err instanceof Error ? err.message : 'حدث خطأ غير متوقع'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!user || !confirm('هل أنت متأكد من حذف هذا المكان؟')) {
      return
    }

    try {
      const { error: deleteError } = await supabase.rpc('delete_provider', {
        p_id: parseInt(id || '0'),
        p_user_id: user.id
      })

      if (deleteError) {
        console.error('Delete Error:', deleteError)
        throw deleteError
      }

      alert('تم حذف المكان بنجاح!')
      
      // إرسال حدث لإعادة تحميل البيانات
      window.dispatchEvent(new Event('data-refresh'))
      
      navigate('/')
    } catch (err) {
      console.error('Error deleting place:', err)
      const errorMessage = err instanceof Error ? err.message : 'حدث خطأ غير متوقع'
      setError(errorMessage)
    }
  }

  if (!user) {
    return <p>يجب تسجيل الدخول لتعديل مكان</p>
  }

  if (fetching) {
    return <div style={{ textAlign: 'center', padding: '2rem' }}>جارٍ التحميل...</div>
  }

  return (
    <div className="container" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>تعديل المكان</h1>
        <button onClick={handleDelete} style={{ background: 'red', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '5px', cursor: 'pointer' }}>
          🗑️ حذف المكان
        </button>
      </div>

      <form onSubmit={handleSubmit}>
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

        <div className="field" style={{ marginBottom: '1rem' }}>
          <label>العنوان</label>
          <input className="input"
            type="text"
            name="address"
            value={formData.address}
            onChange={handleChange}
          />
        </div>

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

        <div className="field" style={{ marginBottom: '1rem' }}>
          <label>رابط الخريطة</label>
          <input className="input"
            type="url"
            name="map_url"
            value={formData.map_url}
            onChange={handleChange}
          />
        </div>

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
          currentImageUrl={formData.image_url}
          onUploadSuccess={(imageUrl) => setFormData({ ...formData, image_url: imageUrl })}
        />

        {error && <p className="error">{error}</p>}

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <button type="submit" disabled={loading} className="btn primary" style={{ flex: 1 }}>
            {loading ? 'جارٍ التعديل...' : 'حفظ التعديلات'}
          </button>
          <button type="button" onClick={() => navigate('/')} className="btn" style={{ flex: 1 }}>
            إلغاء
          </button>
        </div>
      </form>
    </div>
  )
}

