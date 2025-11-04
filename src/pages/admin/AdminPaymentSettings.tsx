import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

interface PaymentSettingsForm {
  bank_name: string
  bank_account: string
  account_name: string
  mobile_wallet: string
  instructions: string
}

export default function AdminPaymentSettings() {
  const [form, setForm] = useState<PaymentSettingsForm>({
    bank_name: '',
    bank_account: '',
    account_name: '',
    mobile_wallet: '',
    instructions: ''
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string>('')

  const loadSettings = async () => {
    setLoading(true)
    setMessage('')
    try {
      const { data, error } = await supabase.rpc('get_payment_settings')
      if (error) {
        setMessage('❌ خطأ في جلب الإعدادات: ' + error.message)
      } else if (data) {
        setForm({
          bank_name: data.bank_name || '',
          bank_account: data.bank_account || '',
          account_name: data.account_name || '',
          mobile_wallet: data.mobile_wallet || '',
          instructions: data.instructions || ''
        })
      }
    } catch (err: any) {
      setMessage('❌ خطأ: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    setLoading(true)
    setMessage('')
    try {
      const { error } = await supabase.rpc('admin_upsert_payment_settings', {
        p_bank_name: form.bank_name,
        p_bank_account: form.bank_account,
        p_account_name: form.account_name,
        p_mobile_wallet: form.mobile_wallet,
        p_instructions: form.instructions
      })
      if (error) {
        setMessage('❌ خطأ في الحفظ: ' + error.message)
      } else {
        setMessage('✅ تم حفظ الإعدادات بنجاح')
        await loadSettings()
      }
    } catch (err: any) {
      setMessage('❌ خطأ: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  return (
    <div className="container" style={{ maxWidth: 720, margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ marginBottom: '1rem' }}>⚙️ إعدادات طرق الدفع</h1>
      <p style={{ marginTop: 0, color: '#666' }}>قم بتحديث بيانات الحساب البنكي والمحفظة الإلكترونية التي تظهر للمستخدم.</p>

      {message && (
        <div className="card" style={{ padding: '1rem', margin: '1rem 0', background: message.includes('✅') ? '#e8f5e9' : '#ffebee', border: `1px solid ${message.includes('✅') ? '#4CAF50' : '#f44336'}` }}>
          <strong>{message}</strong>
        </div>
      )}

      <div className="card" style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: 6 }}>🏦 اسم البنك</label>
          <input
            type="text"
            value={form.bank_name}
            onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
            placeholder="مثال: البنك الأهلي المصري"
            style={{ width: '100%', padding: '0.6rem', border: '1px solid #ddd', borderRadius: 6 }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: 6 }}>💰 رقم الحساب</label>
          <input
            type="text"
            value={form.bank_account}
            onChange={(e) => setForm({ ...form, bank_account: e.target.value })}
            placeholder="1234567890"
            style={{ width: '100%', padding: '0.6rem', border: '1px solid #ddd', borderRadius: 6 }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: 6 }}>👤 اسم صاحب الحساب</label>
          <input
            type="text"
            value={form.account_name}
            onChange={(e) => setForm({ ...form, account_name: e.target.value })}
            placeholder="شركة نيو بان"
            style={{ width: '100%', padding: '0.6rem', border: '1px solid #ddd', borderRadius: 6 }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: 6 }}>📱 رقم المحفظة الإلكترونية</label>
          <input
            type="text"
            value={form.mobile_wallet}
            onChange={(e) => setForm({ ...form, mobile_wallet: e.target.value })}
            placeholder="01012345678"
            style={{ width: '100%', padding: '0.6rem', border: '1px solid #ddd', borderRadius: 6 }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: 6 }}>⚠️ تعليمات إضافية</label>
          <textarea
            value={form.instructions}
            onChange={(e) => setForm({ ...form, instructions: e.target.value })}
            placeholder="يرجى إرسال صورة إيصال الدفع عبر الواتساب..."
            rows={4}
            style={{ width: '100%', padding: '0.6rem', border: '1px solid #ddd', borderRadius: 6 }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
        <button className="btn" onClick={loadSettings} disabled={loading}>↻ إعادة التحميل</button>
        <button className="btn primary" onClick={saveSettings} disabled={loading} style={{ background: '#1976d2', color: '#fff' }}>
          {loading ? 'جارٍ الحفظ...' : '💾 حفظ الإعدادات'}
        </button>
      </div>
    </div>
  )
}
