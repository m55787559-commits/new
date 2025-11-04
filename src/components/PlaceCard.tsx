import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Provider } from '../types'

// src/components/PlaceCard.tsx

export default function PlaceCard({ provider, stats }: { provider: Provider; stats?: { total_visits?: number; today_visits?: number } }) {
  const placeholder = 'https://placehold.co/600x400?text=No+Image'
  const [imgSrc, setImgSrc] = useState<string>(provider.image_url || placeholder)

  useEffect(() => {
    setImgSrc(provider.image_url || placeholder)
  }, [provider.image_url])

  const handleImgError = async () => {
    const url: string | undefined = provider.image_url
    if (url && /\bibb\.co\b/.test(url)) {
      // استخدم لقطة شاشة للصفحة كحل بديل لتفادي CORS
      const screenshot = `https://image.thum.io/get/width/800/noanimate/${encodeURIComponent(url)}`
      setImgSrc(screenshot)
      return
    }
    setImgSrc(placeholder)
  }

  const handleImageLinkClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (provider.image_url) {
      window.open(provider.image_url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div style={styles.cardContainer}>
      <Link to={`/place/${provider.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
        <div className="card">
          <img
            src={imgSrc}
            alt={provider.name}
            style={styles.image}
            referrerPolicy="no-referrer"
            decoding="async"
            onError={handleImgError}
          />
          <h3>{provider.name}</h3>
          <p>{provider.category}</p>
          <p style={styles.city}>{provider.city}</p>
          {provider.description && <small>{provider.description}</small>}
          {(
            <div className="badge muted" style={{ marginTop: '0.5rem' }}>
              <span>زيارات اليوم: {stats?.today_visits ?? 0}</span>
              <span> — إجمالي: {stats?.total_visits ?? 0}</span>
            </div>
          )}
        </div>
      </Link>
      {provider.image_url && (
        <button
          onClick={handleImageLinkClick}
          className="btn ghost"
        >
          عرض الصورة
        </button>
      )}
    </div>
  )
}

const styles = {
  cardContainer: {
    position: 'relative' as const,
  },
  image: {
    width: '100%',
    height: '180px',
    objectFit: 'cover' as const,
    borderRadius: '6px',
    marginBottom: '0.5rem',
    backgroundColor: '#f3f4f6',
  },
  city: { color: '#666', fontSize: '0.9rem' },
  imageButton: {},
}