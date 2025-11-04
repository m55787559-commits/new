import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import PlaceCard from '../components/PlaceCard'
import ServiceCard from '../components/ServiceCard'
import { Link, useLocation } from 'react-router-dom'
import type { Provider, Service, Ad } from '../types'

export default function Home() {
  // State
  const [providers, setProviders] = useState<Provider[]>([])
  const [pageStats, setPageStats] = useState<Record<string, { total_visits: number; today_visits: number }>>({})
  const [siteStats, setSiteStats] = useState<{ total_visits: number; today_visits: number } | null>(null)
  const [sessionVisitsCount, setSessionVisitsCount] = useState<number>(0)
  const [services, setServices] = useState<Service[]>([])
  const [serviceStats, setServiceStats] = useState<Record<string, { total_visits: number; today_visits: number }>>({})
  const [ads, setAds] = useState<Ad[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'all' | 'places' | 'services' | 'ads'>('all')
  const [lastRefresh, setLastRefresh] = useState(new Date().toLocaleTimeString())

  const ranOnce = useRef(false) // لمنع التكرار في وضع التطوير StrictMode
  const [refreshKey, setRefreshKey] = useState(0) // لإعادة تحميل البيانات
  const adFallbackImage = 'https://placehold.co/600x400?text=No+Image'

  const location = useLocation()

  // Sync tab with route
  useEffect(() => {
    const path = location.pathname
    if (path.endsWith('/places')) setActiveTab('places')
    else if (path.endsWith('/services')) setActiveTab('services')
    else if (path.endsWith('/ads')) setActiveTab('ads')
    else setActiveTab('all')
  }, [location.pathname])

  // Fetch data on mount and when refreshKey changes
  useEffect(() => {
    // إعادة تعيين ranOnce عند تغيير refreshKey
    if (refreshKey > 0) {
      ranOnce.current = false
    }
    
    if (ranOnce.current) return
    ranOnce.current = true

    const fetchAll = async () => {
      setLoading(true)
      setError(null)
      try {
        console.log('🔄 Starting to fetch data...')
        
        // لا ننتظر الجلسة؛ نسجلها فقط إذا توفرت (لا تمنع الجلب)
        supabase.auth.getSession().catch(() => {})

        // 1) Providers - استخدام دالة RPC
        console.log('📊 Fetching providers...')
        let providersData, providersError
        try {
          const result = await supabase.rpc('get_providers')
          providersData = result.data
          providersError = result.error
        } catch (err) {
          console.warn('⚠️ RPC get_providers failed, trying direct query...')
          const result = await supabase.from('providers').select('id, name, category, city, image_url, description, status').order('created_at', { ascending: false }).limit(12)
          providersData = result.data
          providersError = result.error
        }
        if (providersError) {
          console.error('❌ Providers error:', providersError)
          throw providersError
        }
        console.log('✅ Providers fetched:', providersData?.length || 0)
        setProviders(providersData || [])

        // زيارات: جلب إحصائيات الموقع (من الداتا بيز)
        try {
          const { data: site } = await supabase.rpc('get_site_visit_stats')
          if (site && site.length > 0) {
            setSiteStats({ total_visits: site[0].total_visits || 0, today_visits: site[0].today_visits || 0 })
          } else {
            setSiteStats({ total_visits: 0, today_visits: 0 })
          }
        } catch (_) {
          setSiteStats({ total_visits: 0, today_visits: 0 })
        }

        // زيارات الجلسة (محليًا)
        try {
          const raw = sessionStorage.getItem('session_pages') || '[]'
          const arr = JSON.parse(raw) as string[]
          setSessionVisitsCount(Array.isArray(arr) ? arr.length : 0)
        } catch (_) {
          setSessionVisitsCount(0)
        }

        // زيارات: جلب إحصائيات للكروت دفعة واحدة
        try {
          const pages = (providersData || []).map((p: Provider) => `/place/${p.id}`)
          if (pages.length > 0) {
            const { data: many } = await supabase.rpc('get_pages_visit_stats', { p_pages: pages })
            const map: Record<string, { total_visits: number; today_visits: number }> = {}
            ;(many || []).forEach((r: any) => {
              map[r.page] = { total_visits: r.total_visits || 0, today_visits: r.today_visits || 0 }
            })
            pages.forEach(pg => { if (!map[pg]) map[pg] = { total_visits: 0, today_visits: 0 } })
            setPageStats(map)
          } else {
            setPageStats({})
          }
        } catch (_) {
          setPageStats({})
        }

        // 2) Services - استخدام دالة RPC
        console.log('📊 Fetching services...')
        let servicesData, servicesError
        try {
          const result = await supabase.rpc('get_services')
          servicesData = result.data
          servicesError = result.error
        } catch (err) {
          console.warn('⚠️ RPC get_services failed, trying direct query...')
          const result = await supabase.from('services').select('id, provider_id, name, description, price, image_url, delivery, online').limit(12)
          servicesData = result.data
          servicesError = result.error
        }
        if (servicesError) {
          console.error('❌ Services error:', servicesError)
        }
        console.log('✅ Services fetched:', servicesData?.length || 0)
        setServices(servicesData || [])

        // زيارات: جلب إحصائيات للخدمات دفعة واحدة
        try {
          const servicePages = (servicesData || []).map((s: Service) => `/service/${s.id}`)
          if (servicePages.length > 0) {
            const { data: svcMany } = await supabase.rpc('get_pages_visit_stats', { p_pages: servicePages })
            const smap: Record<string, { total_visits: number; today_visits: number }> = {}
            ;(svcMany || []).forEach((r: any) => {
              smap[r.page] = { total_visits: r.total_visits || 0, today_visits: r.today_visits || 0 }
            })
            servicePages.forEach(pg => { if (!smap[pg]) smap[pg] = { total_visits: 0, today_visits: 0 } })
            setServiceStats(smap)
          } else {
            setServiceStats({})
          }
        } catch (_) {
          setServiceStats({})
        }

        // 3) Ads - استخدام دالة RPC
        console.log('📊 Fetching ads...')
        let adsData, adsError
        try {
          const result = await supabase.rpc('get_ads')
          adsData = result.data
          adsError = result.error
        } catch (err) {
          console.warn('⚠️ RPC get_ads failed, trying direct query...')
          const result = await supabase.from('ads').select('id, title, description, provider_id, status').eq('status', 'active').limit(12)
          adsData = result.data
          adsError = result.error
        }
        if (adsError) {
          console.error('❌ Ads error:', adsError)
          console.error('Error details:', JSON.stringify(adsError, null, 2))
        }
        console.log('✅ Ads fetched:', adsData?.length || 0)
        // تصفية الإعلانات النشطة فقط
        const activeAds = (adsData || []).filter(ad => ad.status === 'active')

        // 4) Link ads images via separate query
        let adsWithImages: Ad[] = (activeAds || []) as unknown as Ad[]
        
        // جلب الصور بشكل منفصل
        if (adsWithImages.length > 0 && !adsError) {
          try {
            const adIds = adsWithImages.map(a => a.id)
            const { data: imagesData, error: imagesError } = await supabase
              .from('ads_images')
              .select('ad_id, image_url')
              .in('ad_id', adIds)
            
            if (imagesError) {
              console.warn('⚠️ Images error (non-critical):', imagesError)
            } else if (imagesData) {
              const byAd: Record<number, { image_url: string }[]> = {}
              imagesData.forEach((img: { ad_id: number; image_url: string }) => {
                const key = img.ad_id
                if (!byAd[key]) byAd[key] = []
                byAd[key].push({ image_url: img.image_url })
              })

              adsWithImages = adsWithImages.map(ad => ({
                ...ad,
                ads_images: byAd[ad.id] || []
              }))
            }
          } catch (imgErr) {
            console.warn('⚠️ Could not fetch ad images:', imgErr)
            // لا نرمي خطأ، فقط نضيف مصفوفة فارغة
            adsWithImages = adsWithImages.map(ad => ({
              ...ad,
              ads_images: []
            }))
          }
        } else {
          adsWithImages = []
        }
        
        // لا نرمي خطأ إذا فشل جلب الإعلانات (هي اختيارية)
        if (adsError) {
          console.warn('⚠️ Ads query failed (will show empty list):', adsError)
          adsWithImages = []
        }

        setProviders(providersData || [])
        setServices(servicesData || [])
        setAds(adsWithImages)
        setLastRefresh(new Date().toLocaleTimeString())
        console.log('🎉 All data loaded successfully!')
      } catch (err: unknown) {
        console.error('❌ Error fetching data:', err)
        if (err instanceof Error) {
          console.error('Error message:', err.message)
          console.error('Error stack:', err.stack)
        }
        const errorMessage = err instanceof Error ? err.message : 'حدث خطأ غير متوقع'
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    fetchAll()
  }, [refreshKey])
  
  // استمع لتغييرات في localStorage (لإعادة تحميل البيانات)
  useEffect(() => {
    const handleStorageChange = () => {
      setRefreshKey(prev => prev + 1)
      ranOnce.current = false
      try {
        const raw = sessionStorage.getItem('session_pages') || '[]'
        const arr = JSON.parse(raw) as string[]
        setSessionVisitsCount(Array.isArray(arr) ? arr.length : 0)
      } catch (_) {}
    }
    
    window.addEventListener('storage', handleStorageChange)
    const handleCustomRefresh = () => {
      setRefreshKey(prev => prev + 1)
      ranOnce.current = false
      try {
        const raw = sessionStorage.getItem('session_pages') || '[]'
        const arr = JSON.parse(raw) as string[]
        setSessionVisitsCount(Array.isArray(arr) ? arr.length : 0)
      } catch (_) {}
    }
    
    window.addEventListener('data-refresh', handleCustomRefresh)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('data-refresh', handleCustomRefresh)
    }
  }, [])

  // UI helpers
  const renderAdsCard = (ad: Ad) => (
    <div key={ad.id} style={styles.adCard}>
      <img
        src={ad.ads_images?.[0]?.image_url || adFallbackImage}
        alt={ad.title}
        style={styles.adImage}
        onError={(e) => { e.currentTarget.src = adFallbackImage }}
      />
      <h3>{ad.title}</h3>
      {ad.description && <p>{ad.description}</p>}
    </div>
  )

  const renderContent = () => {
    if (loading) return <div style={styles.loading}>جارٍ التحميل...</div>
    if (error) return <div style={styles.errorContainer}>
      <p style={{ color: 'red', textAlign: 'center', marginBottom: '1rem' }}>حدث خطأ: {error}</p>
      <button onClick={() => window.location.reload()} style={styles.retryButton}>
        إعادة المحاولة
      </button>
    </div>

    switch (activeTab) {
      case 'places':
        return (
          <div className="grid cards">
            {providers.length === 0 ? (
              <p style={{ textAlign: 'center', width: '100%' }}>لا توجد أماكن متاحة حاليًا.</p>
            ) : (
              providers.map(p => <PlaceCard key={p.id} provider={p} stats={pageStats[`/place/${p.id}`]} />)
            )}
          </div>
        )
      case 'services':
        return (
          <div className="grid cards">
            {services.length === 0 ? (
              <p style={{ textAlign: 'center', width: '100%' }}>لا توجد خدمات متاحة حاليًا.</p>
            ) : (
              services.map(s => <ServiceCard key={s.id} service={s} stats={serviceStats[`/service/${s.id}`]} />)
            )}
          </div>
        )
      case 'ads':
        return (
          <div className="grid cards">
            {ads.length === 0 ? (
              <p style={{ textAlign: 'center', width: '100%' }}>لا توجد إعلانات متاحة حاليًا.</p>
            ) : (
              ads.map(renderAdsCard)
            )}
          </div>
        )
      default:
        return (
          <>
            {/* Featured Places */}
            <section className="container" style={{ marginBottom: '2rem' }}>
              <div style={styles.sectionHeader}>
                <h2>الأماكن المميزة</h2>
                <Link to="/places" style={styles.viewAllLink}>عرض الكل</Link>
              </div>
              <div className="grid cards">
                {providers.slice(0, 10).map(p => <PlaceCard key={p.id} provider={p} stats={pageStats[`/place/${p.id}`]} />)}
              </div>
            </section>

            {/* Featured Services */}
            <section className="container" style={{ marginBottom: '2rem' }}>
              <div style={styles.sectionHeader}>
                <h2>ال��دمات المميزة</h2>
                <Link to="/services" style={styles.viewAllLink}>عرض الكل</Link>
              </div>
              <div className="grid cards">
                {services.slice(0, 6).map(s => <ServiceCard key={s.id} service={s} />)}
              </div>
            </section>

            {/* Ads */}
            <section className="container" style={{ marginBottom: '2rem' }}>
              <div style={styles.sectionHeader}>
                <h2>الإعلانات</h2>
                <Link to="/ads" style={styles.viewAllLink}>عرض الكل</Link>
              </div>
              <div className="grid cards">
                {ads.slice(0, 6).map(renderAdsCard)}
              </div>
            </section>
          </>
        )
    }
  }

  const handleManualRefresh = () => {
    ranOnce.current = false
    setRefreshKey(prev => prev + 1)
  }

  return (
    <div className="container">
      <div style={{ textAlign: 'center', marginTop: '0.5rem', marginBottom: '0.5rem', color: '#333' }}>
        <small>زيارات الجلسة: {sessionVisitsCount}</small>
      </div>

      {/* Hero */}
      <div style={styles.hero}>
        <h1 style={styles.heroTitle}>اكتشف الأماكن والخدمات في مدينتك</h1>
        <p style={styles.heroSubtitle}>منصة شاملة للأعمال والخدمات المحلية</p>
        <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', justifyContent: 'center', alignItems: 'center' }}>
          <button 
            onClick={handleManualRefresh} 
            style={{ padding: '0.5rem 1.5rem', background: 'rgba(255,255,255,0.2)', border: '1px solid white', borderRadius: '25px', color: 'white', cursor: 'pointer' }}
          >
            🔄 تحديث
          </button>
          <small style={{ color: 'rgba(255,255,255,0.8)' }}>آخر تحديث: {lastRefresh}</small>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        <button
          style={activeTab === 'all' ? { ...styles.tab, ...styles.activeTab } : styles.tab}
          onClick={() => setActiveTab('all')}
        >
          الكل
        </button>
        <button
          style={activeTab === 'places' ? { ...styles.tab, ...styles.activeTab } : styles.tab}
          onClick={() => setActiveTab('places')}
        >
          الأماكن
        </button>
        <button
          style={activeTab === 'services' ? { ...styles.tab, ...styles.activeTab } : styles.tab}
          onClick={() => setActiveTab('services')}
        >
          الخدمات
        </button>
        <button
          style={activeTab === 'ads' ? { ...styles.tab, ...styles.activeTab } : styles.tab}
          onClick={() => setActiveTab('ads')}
        >
          الإعلانات
        </button>
      </div>

      {/* Content */}
      {renderContent()}
    </div>
  )
}

// Styles
const styles = {
  container: {
    width: '100%',
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '1rem',
  },
  grid: {
    display: 'grid',
    gap: '1rem',
    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '200px',
    fontSize: '1.2rem',
  },
  hero: {
    textAlign: 'center' as const,
    padding: '3rem 1rem',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    borderRadius: '10px',
    marginBottom: '2rem',
  },
  heroTitle: {
    fontSize: '2.5rem',
    marginBottom: '1rem',
    fontWeight: 'bold',
  },
  heroSubtitle: {
    fontSize: '1.2rem',
    opacity: 0.9,
  },
  tabs: {
    display: 'flex',
    justifyContent: 'center',
    gap: '1rem',
    marginBottom: '2rem',
    flexWrap: 'wrap' as const,
  },
  tab: {
    padding: '0.5rem 1rem',
    border: '2px solid #007bff',
    background: 'white',
    color: '#007bff',
    borderRadius: '25px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    fontWeight: 'bold',
  },
  activeTab: {
    background: '#007bff',
    color: 'white',
  },
  section: {
    marginBottom: '3rem',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  viewAllLink: {
    color: '#007bff',
    textDecoration: 'none',
    fontWeight: 'bold',
  },
  adCard: {
    background: '#fff',
    borderRadius: '8px',
    boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
    padding: '1rem',
    textAlign: 'center' as const,
    transition: 'transform 0.2s',
  },
  adImage: {
    width: '100%',
    height: '150px',
    objectFit: 'cover' as const,
    borderRadius: '5px',
    marginBottom: '1rem',
    backgroundColor: '#f3f4f6',
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
  },
  retryButton: {
    padding: '0.75rem 1.5rem',
    background: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: 'bold',
    transition: 'background 0.3s',
  },
} as const
