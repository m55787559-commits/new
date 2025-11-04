import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useInsertData } from '../hooks/useSupabase'
import ImageUploader from '../components/ImageUploader'
import { supabase } from '../lib/supabaseClient'

interface Provider {
  id: number
  name: string
}

export default function AddService() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { insert, loading, error } = useInsertData('services')
  const [providers, setProviders] = useState<Provider[]>([])
  const [providersLoading, setProvidersLoading] = useState<boolean>(true)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    provider_id: '',
    image_url: ''
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  useEffect(() => {
    const loadProviders = async () => {
      if (!user) return
      setProvidersLoading(true)
      const { data, error: provErr } = await supabase
        .from('providers')
        .select('id, name')
        .eq('user_id', user.id)
      if (provErr) {
        console.error('Error fetching providers for user:', provErr)
        setProviders([])
      } else {
        setProviders(data || [])
      }
      setProvidersLoading(false)
    }
    loadProviders()
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      alert('يجب تسجيل الدخول أولاً')
      return
    }
    // كلاسيكي: إدخال الخدمة بمزود مطلوب
    const dataToInsert = {
      name: formData.name,
      description: formData.description || null,
      price: parseFloat(formData.price) || null,
      provider_id: parseInt(formData.provider_id),
      image_url: formData.image_url || null,
      created_at: new Date().toISOString()
    }
    const result = await insert(dataToInsert)
    if (result) {
      alert('تم إضافة الخدمة بنجاح!')
      navigate('/')
    }
  }

  if (!user) {
    return <p>يجب تسجيل الدخول لإضافة خدمة</p>
  }

  return (
    <div className="container">
      <h1>إضافة خدمة جديدة</h1>
      <form onSubmit={handleSubmit} style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div className="field" style={{ marginBottom: '1rem' }}>
          <label>اسم الخدمة *</label>
          <input className="input"
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>
        <div className="field" style={{ marginBottom: '1rem' }}>
          <label>المزود</label>
          <select className="select"
            name="provider_id"
            value={formData.provider_id}
            onChange={handleChange}
            required
            disabled={providersLoading || providers.length === 0}
          >
            <option value="">اختر المزود</option>
            {providers.map(provider => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
          {!providersLoading && providers.length === 0 && (
            <small style={{ display: 'block', marginTop: '0.5rem', color: '#9aa4c7' }}>
              لا يوجد لديك أماكن بعد. قم بإضافة مكان أولاً ثم أضف الخدمة.
            </small>
          )}
        </div>
        <div className="field" style={{ marginBottom: '1rem' }}>
          <label>وصف الخدمة</label>
          <textarea className="textarea"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={4}
          />
        </div>
        <div className="field" style={{ marginBottom: '1rem' }}>
          <label>السعر</label>
          <input className="input"
            type="number"
            name="price"
            value={formData.price}
            onChange={handleChange}
            step="0.01"
          />
        </div>
        <ImageUploader
          label="صورة الخدمة"
          onUploadSuccess={(imageUrl) => setFormData({ ...formData, image_url: imageUrl })}
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={loading} className="btn primary" style={{ marginTop: '0.5rem' }}>
          {loading ? 'جارٍ الإضافة...' : 'إضافة الخدمة'}
        </button>
      </form>
    </div>
  )
}
