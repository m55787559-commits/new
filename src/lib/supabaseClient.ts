import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ خطأ: لم يتم تحميل مفاتيح Supabase من ملف .env')
  console.error('URL:', supabaseUrl)
  console.error('Key:', supabaseAnonKey ? 'Present' : 'Missing')
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// ✅ للتأكد أن الاتصال تم
console.log('🔗 Supabase client connected:', supabaseUrl)

// اختبار الاتصال
supabase
  .from('providers')
  .select('count')
  .single()
  .then(({ data, error }) => {
    if (error) {
      console.error('❌ Supabase connection test failed:', error)
    } else {
      console.log('✅ Supabase connection test successful')
    }
  })
  .catch((err) => {
    console.error('❌ Supabase connection error:', err)
  })