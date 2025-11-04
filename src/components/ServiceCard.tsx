import { Link } from 'react-router-dom'
import type { Service } from '../types'

interface ServiceCardProps {
  service: Service
  stats?: { total_visits?: number; today_visits?: number }
}

export default function ServiceCard({ service, stats }: ServiceCardProps) {
  return (
    <Link to={`/service/${service.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div style={styles.card}>
        {service.image_url && (
          <img
            src={service.image_url}
            alt={service.name}
            style={styles.image}
            referrerPolicy="no-referrer"
            decoding="async"
            onError={(e) => {
              const target = e.currentTarget as HTMLImageElement
              target.onerror = null
              target.src = 'https://placehold.co/600x400?text=No+Image'
            }}
          />
        )}
        <h3>{service.name}</h3>
        <p>{service.description}</p>
        {service.price && <p style={{ fontWeight: 'bold', color: '#007bff' }}>السعر: {service.price} جنيه</p>}
        {service.providers && (
          <small style={{ color: '#666' }}>
            المزود: {service.providers.name}
            {service.providers.city && ` - ${service.providers.city}`}
          </small>
        )}
        <div style={{ marginTop: '0.5rem', color: '#555', fontSize: '0.9rem' }}>
          <span>زيارات اليوم: {stats?.today_visits ?? 0}</span>
          <span> — إجمالي: {stats?.total_visits ?? 0}</span>
        </div>
        <span style={styles.detailsLink}>عرض التفاصيل</span>
      </div>
    </Link>
  )
}

const styles = {
  card: {
    background: '#fff',
    borderRadius: '8px',
    boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
    padding: '1rem',
    textAlign: 'center' as const,
    transition: '0.2s',
    cursor: 'pointer',
  },
  image: {
    width: 120,
    height: 120,
    objectFit: 'cover' as const,
    borderRadius: '50%',
    margin: '0 auto 0.75rem',
    display: 'block',
    background: '#f2f2f2'
  },
  detailsLink: {
    color: '#007bff',
    textDecoration: 'none',
    fontSize: '0.9rem',
    fontWeight: 'bold',
  },
}
