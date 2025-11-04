import { useState, useRef } from 'react'

interface ImageUploaderProps {
  onUploadSuccess: (imageUrl: string) => void
  currentImageUrl?: string
  label?: string
}

export default function ImageUploader({ onUploadSuccess, currentImageUrl, label = 'رفع صورة' }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const IMGBB_API_KEY = import.meta.env.VITE_IMGBB_API_KEY
  const IMGBB_URL = 'https://api.imgbb.com/1/upload'

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // التحقق من نوع الملف
    if (!file.type.startsWith('image/')) {
      setError('يرجى اختيار ملف صورة')
      return
    }

    // التحقق من حجم الملف (5MB كحد أقصى)
    if (file.size > 5 * 1024 * 1024) {
      setError('حجم الصورة كبير جداً (الحد الأقصى 5MB)')
      return
    }

    // معاينة الصورة
    const reader = new FileReader()
    reader.onload = (event) => {
      setPreviewUrl(event.target?.result as string)
    }
    reader.readAsDataURL(file)

    // رفع الصورة
    uploadImage(file)
  }

  const uploadImage = async (file: File) => {
    setUploading(true)
    setUploadProgress(0)
    setError(null)

    try {
      // إنشاء FormData
      const formData = new FormData()
      formData.append('key', IMGBB_API_KEY)
      formData.append('image', file)

      // محاكاة شريط التحميل
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return prev + 10
        })
      }, 200)

      // رفع الصورة إلى ImgBB
      const response = await fetch(IMGBB_URL, {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      if (!response.ok) {
        throw new Error('فشل رفع الصورة')
      }

      const data = await response.json()
      
      if (data.success) {
        const imageUrl = data.data.url
        onUploadSuccess(imageUrl)
        setError(null)
        // تم الفحص بنجاح
        setTimeout(() => {
          setUploadProgress(0)
        }, 1000)
      } else {
        throw new Error(data.error?.message || 'فشل رفع الصورة')
      }
    } catch (err) {
      console.error('Error uploading image:', err)
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء رفع الصورة')
      setPreviewUrl(null)
      setUploadProgress(0)
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveImage = () => {
    setPreviewUrl(null)
    onUploadSuccess('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div style={styles.container}>
      <label style={styles.label}>{label}</label>
      
      {previewUrl && (
        <div style={styles.previewContainer}>
          <img src={previewUrl} alt="معاينة" style={styles.previewImage} />
          <button onClick={handleRemoveImage} style={styles.removeButton}>
            ✕ حذف
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        style={styles.fileInput}
        disabled={uploading}
      />

      {uploading && (
        <div style={styles.progressContainer}>
          <div style={styles.progressBar}>
            <div style={{ ...styles.progressFill, width: `${uploadProgress}%` }}></div>
          </div>
          <p style={styles.progressText}>جارٍ رفع الصورة... {uploadProgress}%</p>
        </div>
      )}

      {error && (
        <p style={styles.error}>{error}</p>
      )}

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        style={styles.uploadButton}
      >
        {uploading ? 'جارٍ الرفع...' : previewUrl ? 'تغيير الصورة' : 'اختر صورة'}
      </button>
    </div>
  )
}

const styles = {
  container: {
    marginBottom: '1rem',
  },
  label: {
    display: 'block',
    marginBottom: '0.5rem',
    fontWeight: 'bold' as const,
  },
  previewContainer: {
    position: 'relative' as const,
    marginBottom: '1rem',
    display: 'inline-block',
  },
  previewImage: {
    width: '200px',
    height: '200px',
    objectFit: 'cover' as const,
    borderRadius: '8px',
    border: '2px solid #ddd',
  },
  removeButton: {
    position: 'absolute' as const,
    top: '10px',
    right: '10px',
    background: 'red',
    color: 'white',
    border: 'none',
    borderRadius: '50%',
    width: '30px',
    height: '30px',
    cursor: 'pointer',
    fontSize: '16px',
  },
  fileInput: {
    display: 'none',
  },
  uploadButton: {
    padding: '0.75rem 1.5rem',
    background: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: 'bold' as const,
  },
  progressContainer: {
    marginTop: '1rem',
  },
  progressBar: {
    width: '100%',
    height: '20px',
    background: '#e0e0e0',
    borderRadius: '10px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #007bff, #00c6ff)',
    transition: 'width 0.3s ease',
  },
  progressText: {
    marginTop: '0.5rem',
    textAlign: 'center' as const,
    fontSize: '0.9rem',
    color: '#666',
  },
  error: {
    color: 'red',
    marginTop: '0.5rem',
    fontSize: '0.9rem',
  },
}

