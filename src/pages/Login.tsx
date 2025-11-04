import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [debugMsg, setDebugMsg] = useState<string>('') // لإظهار رسائل التتبع
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false) // تبديل بين تسجيل الدخول والتسجيل
  const [showResend, setShowResend] = useState(false) // إظهار زر إعادة الإرسال
  const navigate = useNavigate()

  // ✅ إذا كان المستخدم مسجل بالفعل → انتقل للصفحة الرئيسية
  // ملاحظة: هذا التحقق تم نقله إلى AuthProvider لتجنب التكرار

  // 🔑 تسجيل الدخول باستخدام البريد الإلكتروني وكلمة المرور
  async function handleEmailAuth() {
    try {
      setLoading(true)
      setErrorMsg(null)
      setDebugMsg(isSignUp ? '🔄 جارٍ إنشاء حساب جديد...' : '🔄 جارٍ تسجيل الدخول...')

      const { data, error } = isSignUp
        ? await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: email.split('@')[0] // استخدام الجزء قبل @ كاسم افتراضي
              }
            }
          })
        : await supabase.auth.signInWithPassword({
            email,
            password
          })

      if (error) {
        console.error('❌ خطأ في المصادقة:', error)
        
        // معالجة الأخطاء وإعطاء رسائل واضحة للمستخدم
        let userFriendlyMessage = ''
        
        if (error.message.includes('Invalid login credentials') || error.message.includes('invalid_credentials')) {
          userFriendlyMessage = 'البريد الإلكتروني أو كلمة المرور غير صحيحة. يرجى التحقق من البيانات والمحاولة مرة أخرى.'
        } else if (error.message.includes('Email not confirmed') || error.message.includes('email_not_confirmed')) {
          userFriendlyMessage = 'يرجى التحقق من بريدك الإلكتروني أولاً. تحقق من صندوق الوارد والنقر على رابط التفعيل.'
        } else if (error.message.includes('User already registered') || error.message.includes('already_registered')) {
          userFriendlyMessage = 'هذا البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول بدلاً من إنشاء حساب جديد.'
        } else if (error.message.includes('Password should be at least')) {
          userFriendlyMessage = 'كلمة المرور قصيرة جداً. يجب أن تكون على الأقل 6 أحرف.'
        } else if (error.message.includes('Invalid email')) {
          userFriendlyMessage = 'البريد الإلكتروني المدخل غير صحيح. يرجى التحقق من صحة البريد الإلكتروني.'
        } else {
          userFriendlyMessage = 'حدث خطأ أثناء تسجيل الدخول. يرجى المحاولة مرة أخرى أو التواصل مع الدعم الفني.'
        }
        
        setErrorMsg(userFriendlyMessage)
        setDebugMsg('❌ فشل في المصادقة')
        setLoading(false)
        return
      }

      if (isSignUp) {
        if (data.user && !data.session) {
          // المستخدم تم إنشاؤه لكن يحتاج للتحقق من البريد الإلكتروني
          setDebugMsg('✅ تم إنشاء الحساب! تحقق من بريدك الإلكتروني لتفعيل الحساب')
          setShowResend(true)
          setErrorMsg('يرجى التحقق من بريدك الإلكتروني والنقر على رابط التفعيل قبل تسجيل الدخول')
        } else {
          setDebugMsg('✅ تم إنشاء الحساب وتسجيل الدخول بنجاح!')
          navigate('/')
        }
      } else {
        setDebugMsg('✅ تم تسجيل الدخول بنجاح!')
        navigate('/')
      }

      console.log('🔗 Auth successful:', data)

    } catch (err: unknown) {
      console.error('💥 خطأ عام في المصادقة:', err)
      
      // معالجة الأخطاء غير المتوقعة
      let userFriendlyMessage = ''
      
      if (err instanceof Error) {
        if (err.message.includes('Invalid login credentials') || err.message.includes('invalid_credentials')) {
          userFriendlyMessage = 'البريد الإلكتروني أو كلمة المرور غير صحيحة. يرجى التحقق من البيانات والمحاولة مرة أخرى.'
        } else if (err.message.includes('Email not confirmed')) {
          userFriendlyMessage = 'يرجى التحقق من بريدك الإلكتروني أولاً. تحقق من صندوق الوارد والنقر على رابط التفعيل.'
        } else if (err.message.includes('network') || err.message.includes('fetch')) {
          userFriendlyMessage = 'حدث خطأ في الاتصال بالإنترنت. يرجى التحقق من اتصالك والمحاولة مرة أخرى.'
        } else {
          userFriendlyMessage = 'حدث خطأ غير متوقع أثناء تسجيل الدخول. يرجى المحاولة مرة أخرى.'
        }
      } else {
        userFriendlyMessage = 'حدث خطأ أثناء تسجيل الدخول. يرجى المحاولة مرة أخرى.'
      }
      
      setErrorMsg(userFriendlyMessage)
      setDebugMsg('❌ فشل في المصادقة')
    } finally {
      setLoading(false)
    }
  }

  // 🔑 تسجيل الدخول باستخدام Google
  async function handleGoogleSignIn() {
    try {
      setLoading(true)
      setErrorMsg(null)
      setDebugMsg('🔄 جارٍ الاتصال بـ Google...')

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          },
          skipBrowserRedirect: false
        }
      })

      if (error) {
        console.error('❌ خطأ في OAuth:', error)
        throw error
      }

      setDebugMsg('✅ تم توجيهك إلى Google، انتظر...')
      console.log('🔗 OAuth initiated successfully:', data)

    } catch (err: unknown) {
      console.error('💥 خطأ عام في تسجيل الدخول:', err)
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setErrorMsg(`خطأ: ${errorMessage}`)
      setDebugMsg('❌ فشل في الاتصال بـ Google')
    } finally {
      setLoading(false)
    }
  }

  // ملاحظة: معالجة حالة المصادقة تم نقلها إلى AuthProvider لتجنب التكرار

  // 🔄 إعادة إرسال رسالة التحقق من البريد الإلكتروني
  async function resendVerification() {
    try {
      setLoading(true)
      setErrorMsg(null)
      setDebugMsg('🔄 جارٍ إرسال رسالة التحقق...')

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email
      })

      if (error) {
        console.error('❌ خطأ في إعادة الإرسال:', error)
        throw error
      }

      setDebugMsg('✅ تم إرسال رسالة التحقق مرة أخرى! تحقق من بريدك الإلكتروني')

    } catch (err: unknown) {
      console.error('💥 خطأ في إعادة الإرسال:', err)
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setErrorMsg(`خطأ في إعادة الإرسال: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  // 🧪 زر اختبار الإدخال (اختياري - لأغراض التطوير فقط)
  async function testDatabaseInsert() {
    try {
      setDebugMsg('🧪 اختبار الإدخال في قاعدة البيانات...')
      
      const testUserId = crypto.randomUUID()
      const { data, error } = await supabase
        .from('user_profiles')
        .insert([{
          id: testUserId,
          full_name: 'مستخدم تجريبي',
          created_at: new Date().toISOString(),
          role: 'user'
        }])
        .select()

      if (error) {
        console.error('💥 خطأ في الاختبار:', error)
        setErrorMsg(`خطأ في الاختبار: ${error.message}`)
        setDebugMsg('❌ فشل اختبار قاعدة البيانات')
      } else {
        console.log('✅ نجح اختبار الإدخال:', data)
        setDebugMsg('✅ اختبار قاعدة البيانات نجح!')
        
        // حذف البيانات التجريبية بعد الاختبار
        await supabase
          .from('user_profiles')
          .delete()
          .eq('id', testUserId)
      }
    } catch (err: unknown) {
      console.error('💥 خطأ في الاختبار:', err)
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setErrorMsg(`خطأ في الاختبار: ${errorMessage}`)
    }
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>{isSignUp ? 'إنشاء حساب جديد' : 'تسجيل الدخول'}</h2>

      {/* رسائل الحالة */}
      {debugMsg && (
        <div style={styles.debugBox}>
          <p>{debugMsg}</p>
        </div>
      )}

      {/* رسائل الخطأ */}
      {errorMsg && (
        <div style={styles.errorBox}>
          <p>{errorMsg}</p>
        </div>
      )}

      {/* نموذج البريد الإلكتروني وكلمة المرور */}
      <form onSubmit={(e) => { e.preventDefault(); handleEmailAuth(); }} style={styles.form}>
        <input
          type="email"
          placeholder="البريد الإلكتروني"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={styles.input}
          disabled={loading}
        />
        <input
          type="password"
          placeholder="كلمة المرور"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={styles.input}
          disabled={loading}
          minLength={6}
        />
        <button
          type="submit"
          disabled={loading || !email || !password}
          style={{
            ...styles.button,
            backgroundColor: loading || !email || !password ? '#ccc' : '#4CAF50'
          }}
        >
          {loading ? 'جارٍ المعالجة...' : (isSignUp ? 'إنشاء حساب' : 'تسجيل الدخول')}
        </button>
      </form>

      {/* فاصل */}
      <div style={styles.divider}>
        <span>أو</span>
      </div>

      {/* زر تسجيل الدخول بـ Google */}
      <button
        onClick={handleGoogleSignIn}
        disabled={loading}
        style={{
          ...styles.button,
          backgroundColor: loading ? '#ccc' : '#4285F4'
        }}
      >
        {loading ? 'جارٍ الاتصال بـ Google…' : 'تسجيل الدخول بحساب Google'}
      </button>

      {/* زر إعادة إرسال التحقق */}
      {showResend && (
        <button
          onClick={resendVerification}
          disabled={loading}
          style={{
            ...styles.button,
            backgroundColor: loading ? '#ccc' : '#FF9800',
            marginTop: '1rem'
          }}
        >
          {loading ? 'جارٍ الإرسال...' : 'إعادة إرسال رسالة التحقق'}
        </button>
      )}

      {/* تبديل بين تسجيل الدخول والتسجيل */}
      <button
        onClick={() => {
          setIsSignUp(!isSignUp)
          setShowResend(false) // إخفاء زر إعادة الإرسال عند التبديل
          setErrorMsg(null)
          setDebugMsg('')
        }}
        style={styles.switchButton}
        disabled={loading}
      >
        {isSignUp ? 'لديك حساب بالفعل؟ تسجيل الدخول' : 'لا تمتلك حساب؟ إنشاء حساب جديد'}
      </button>

      {/* أزرار التطوير (يمكن إزالتها في الإنتاج) */}
      <div style={styles.devButtons}>
        <button onClick={testDatabaseInsert} style={styles.testButton}>
          🧪 اختبار قاعدة البيانات
        </button>
        
        <button 
          onClick={() => {
            console.clear()
            setDebugMsg('')
            setErrorMsg(null)
          }} 
          style={styles.clearButton}
        >
          🧹 مسح الرسائل
        </button>
      </div>

      {/* معلومات إضافية */}
      <div style={styles.info}>
        <p>💡 إذا واجهت مشاكل، تحقق من وحدة التحكم (F12) لرؤية التفاصيل</p>
      </div>
    </div>
  )
}

// 🎨 الأنماط
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    gap: '1rem',
    padding: '2rem',
    fontFamily: 'Arial, sans-serif'
  },
  title: { 
    fontSize: '32px', 
    marginBottom: '2rem',
    color: '#333'
  },
  button: {
    backgroundColor: '#4285F4',
    color: '#fff',
    border: 'none',
    padding: '1rem 2rem',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    minWidth: '280px',
    transition: 'all 0.3s ease'
  },
  debugBox: {
    backgroundColor: '#e3f2fd',
    border: '1px solid #2196f3',
    borderRadius: '8px',
    padding: '1rem',
    minWidth: '300px',
    textAlign: 'center' as const,
    color: '#1976d2'
  },
  errorBox: {
    backgroundColor: '#ffebee',
    border: '1px solid #f44336',
    borderRadius: '8px',
    padding: '1rem',
    minWidth: '300px',
    textAlign: 'center' as const,
    color: '#d32f2f'
  },
  devButtons: {
    display: 'flex',
    gap: '0.5rem',
    marginTop: '1rem'
  },
  testButton: {
    backgroundColor: '#ff9800',
    color: '#fff',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '0.9rem'
  },
  clearButton: {
    backgroundColor: '#9e9e9e',
    color: '#fff',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '0.9rem'
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
    width: '100%',
    maxWidth: '300px'
  },
  input: {
    padding: '0.75rem',
    border: '1px solid #ddd',
    borderRadius: '5px',
    fontSize: '1rem',
    outline: 'none',
    transition: 'border-color 0.3s ease',
    '&:focus': {
      borderColor: '#4CAF50'
    }
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    margin: '1rem 0',
    textAlign: 'center' as const,
    '&::before, &::after': {
      content: '""',
      flex: 1,
      height: '1px',
      backgroundColor: '#ddd'
    },
    '& span': {
      padding: '0 1rem',
      color: '#666',
      fontSize: '0.9rem'
    }
  },
  switchButton: {
    background: 'none',
    border: 'none',
    color: '#007bff',
    cursor: 'pointer',
    fontSize: '0.9rem',
    textDecoration: 'underline',
    marginTop: '1rem'
  },
  info: {
    marginTop: '2rem',
    textAlign: 'center' as const,
    color: '#666',
    fontSize: '0.9rem',
    maxWidth: '400px'
  }
}
