import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { AuthContext } from '../hooks/useAuth'
import type { AuthUser } from '../types'

// 🔹 المزوّد (Provider) اللي هنستخدمه في App.tsx
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const ranOnce = useRef(false) // لمنع التكرار في وضع التطوير StrictMode

  // ▪️ الحصول على الجلسة الحالية عند أول تشغيل للتطبيق
  useEffect(() => {
    if (ranOnce.current) return
    ranOnce.current = true

    const getSession = async () => {
      console.log('AuthContext: Getting initial session...')
      const { data, error } = await supabase.auth.getSession()
      if (error) {
        console.error('AuthContext: Error getting session:', error)
      }

      const sessionUser = data?.session?.user

      if (sessionUser) {
        console.log('AuthContext: Initial session found:', sessionUser.id)
        setUser({
          id: sessionUser.id,
          email: sessionUser.email ?? '',
          full_name: sessionUser.user_metadata.full_name ?? '',
        })
        // إذا كان المستخدم مسجل دخول مسبقًا، انتقل للصفحة الرئيسية
        if (window.location.pathname === '/login') {
          navigate('/')
        }
      } else {
        console.log('AuthContext: No initial session')
      }

      setLoading(false)
      console.log('AuthContext: Initial loading set to false')
    }

    getSession()

    // 🟢 متابعة أي تغيير في حالة المستخدم
    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('AuthContext: Auth state change:', event, session?.user?.id || 'none')

        const sessionUser = session?.user
        if (sessionUser) {
          // التحقق من وجود المستخدم في user_profiles وإضافته إذا لم يكن موجودًا
          if (event === 'SIGNED_IN') {
            try {
              const { data: existingUser, error: checkError } = await supabase
                .from('user_profiles')
                .select('id')
                .eq('id', sessionUser.id)
                .maybeSingle()

              if (checkError) {
                console.error('خطأ في التحقق من user_profiles:', checkError)
              } else if (!existingUser) {
                const { error: insertError } = await supabase
                  .from('user_profiles')
                  .insert([{
                    id: sessionUser.id,
                    full_name: sessionUser.user_metadata.full_name || sessionUser.email || 'مستخدم جديد',
                    role: 'user', // تأكد من أن المستخدمين الجدد يكونوا 'user' وليس 'owner'
                    created_at: new Date().toISOString()
                  }])

                if (insertError) {
                  console.error('خطأ في إدراج user_profiles:', insertError)
                } else {
                  console.log('تم إدراج المستخدم في user_profiles')
                }
              }
            } catch (err) {
              console.error('خطأ في معالجة user_profiles:', err)
            }
          }

          setUser({
            id: sessionUser.id,
            email: sessionUser.email ?? '',
            full_name: sessionUser.user_metadata.full_name ?? '',
          })
        } else {
          setUser(null)
        }
        setLoading(false)
        console.log('AuthContext: Loading set to false after auth state change')
      }
    )

    return () => subscription.subscription.unsubscribe()
  }, [navigate])

  // 🔹 تسجيل خروج المستخدم
  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
