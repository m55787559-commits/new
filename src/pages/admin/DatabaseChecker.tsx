import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

// قائمة الجداول من database-schema.json
const KNOWN_TABLES = [
  'activities', 'ads', 'ads_images', 'ads_videos', 'affiliates', 'areas', 'branches',
  'cities', 'commissions', 'dashboard_stats', 'discount_codes', 'favorites',
  'interactions', 'malls', 'offers', 'packages', 'payments', 'price_history',
  'products', 'providers', 'reports', 'reviews', 'services', 'user_profiles', 'visits'
]

interface TableInfo {
  name: string
  exists: boolean
  count: number
  error?: string
  columns?: string[]
}

interface FunctionInfo {
  name: string
  schema: string
  arguments: string
  return_type: string
}

interface DatabaseStatus {
  tables: TableInfo[]
  functions: FunctionInfo[]
  totalTables: number
  accessibleTables: number
  totalFunctions: number
}

export default function DatabaseChecker() {
  const [status, setStatus] = useState<DatabaseStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string>('')
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [tableData, setTableData] = useState<any[]>([])

  const checkDatabase = async () => {
    setLoading(true)
    setMessage('')
    setStatus(null)
    setSelectedTable(null)
    setTableData([])

    try {
      setMessage('🔄 جارٍ فحص جميع الجداول...')

      // أولاً: جلب ملخص الجداول عبر دالة قاعدة البيانات
      const { data: tablesOverview, error: tablesError } = await supabase.rpc('get_tables_overview')

      let tablesInfo: TableInfo[] = []
      let accessibleCount = 0

      if (!tablesError && Array.isArray(tablesOverview)) {
        tablesInfo = tablesOverview.map((t: any) => ({
          name: t.table_name,
          exists: true,
          count: typeof t.row_count === 'number' ? t.row_count : 0,
        }))
        accessibleCount = tablesInfo.length
      } else {
        // في حال عدم توفر الدالة، نعود لأسلوب القراءة المباشر كحل احتياطي
        for (const tableName of KNOWN_TABLES) {
          try {
            const { error, count } = await supabase
              .from(tableName)
              .select('*', { count: 'exact', head: true })

            if (error) {
              tablesInfo.push({ name: tableName, exists: false, count: 0, error: error.message })
            } else {
              tablesInfo.push({ name: tableName, exists: true, count: count || 0 })
              accessibleCount++
            }
          } catch (err: any) {
            tablesInfo.push({ name: tableName, exists: false, count: 0, error: err.message || 'خطأ غير معروف' })
          }
        }
      }

      // ثانياً: جلب قائمة الدوال عبر دالة قاعدة البيانات
      const { data: funcs, error: funcsError } = await supabase.rpc('list_database_functions')

      let functionsList: FunctionInfo[] = []
      if (!funcsError && Array.isArray(funcs)) {
        functionsList = funcs.map((f: any) => ({
          name: f.name,
          schema: f.schema,
          arguments: f.arguments || '',
          return_type: f.return_type || '',
        }))
      } else {
        // قائمة احتياطية بسيطة في حال فشل الدالة
        functionsList = [
          { name: 'get_providers', schema: 'public', arguments: '', return_type: 'TABLE' },
          { name: 'get_services', schema: 'public', arguments: '', return_type: 'TABLE' },
          { name: 'get_ads', schema: 'public', arguments: '', return_type: 'TABLE' },
          { name: 'get_categories', schema: 'public', arguments: '', return_type: 'TABLE' },
        ]
      }

      setStatus({
        tables: tablesInfo,
        functions: functionsList,
        totalTables: tablesInfo.length,
        accessibleTables: accessibleCount,
        totalFunctions: functionsList.length,
      })

      setMessage(`✅ تم التحقق من ${accessibleCount} جدول`)
    } catch (err: any) {
      setMessage('❌ حدث خطأ: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const viewTableData = async (tableName: string) => {
    setLoading(true)
    setSelectedTable(tableName)
    setTableData([])

    try {
      // استخدام دالة RPC لمعاينة الجدول كـ JSON
      const { data, error } = await supabase.rpc('get_table_preview', {
        p_table: tableName,
        p_limit: 100,
      })

      if (error) {
        setMessage('❌ خطأ في جلب البيانات: ' + error.message)
      } else {
        const rows = Array.isArray(data) ? data.map((r: any) => (r.item ?? r)) : []
        setTableData(rows)
        setMessage(`✅ تم جلب ${rows.length} سجل من جدول ${tableName}`)
      }
    } catch (err: any) {
      setMessage('❌ خطأ: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const addDefaultPackages = async () => {
    if (!window.confirm('هل تريد إضافة باقات افتراضية؟ هذا سيضيف 3 باقات أساسية.')) return

    setLoading(true)
    setMessage('')

    const defaultPackages = [
      {
        name: 'الباقة الأساسية',
        price: 100,
        duration_days: 30,
        max_places: 3,
        priority_weight: 1,
        is_active: true,
        description: 'باقة مناسبة للمبتدئين - تسمح بإضافة حتى 3 أماكن',
      },
      {
        name: 'الباقة المتوسطة',
        price: 250,
        duration_days: 30,
        max_places: 10,
        priority_weight: 2,
        is_active: true,
        description: 'باقة متوسطة - تسمح بإضافة حتى 10 أماكن مع أولوية أعلى',
      },
      {
        name: 'الباقة المميزة',
        price: 500,
        duration_days: 30,
        max_places: 50,
        priority_weight: 3,
        is_active: true,
        description: 'باقة مميزة - تسمح بإضافة حتى 50 مكان مع أولوية عالية جداً',
      },
    ]

    try {
      for (const pkg of defaultPackages) {
        const { error } = await supabase.rpc('admin_upsert_package', {
          p_id: null,
          p_name: pkg.name,
          p_price: pkg.price,
          p_duration_days: pkg.duration_days,
          p_is_active: pkg.is_active,
          p_description: pkg.description,
          p_max_places: pkg.max_places,
          p_priority_weight: pkg.priority_weight,
        })

        if (error) {
          console.error('خطأ في إضافة الباقة:', pkg.name, error)
        }
      }

      setMessage('✅ تم إضافة الباقات الافتراضية بنجاح!')
      // إعادة التحقق من قاعدة البيانات
      setTimeout(() => checkDatabase(), 1000)
    } catch (err: any) {
      setMessage('❌ حدث خطأ أثناء إضافة الباقات: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const fixPackages = async () => {
    if (!window.confirm('هل تريد تفعيل جميع الباقات غير النشطة؟')) return

    setLoading(true)
    setMessage('')

    try {
      // جلب جميع الباقات
      const { data: packages, error } = await supabase
        .from('packages')
        .select('*')

      if (error) {
        setMessage('❌ خطأ في جلب الباقات: ' + error.message)
        return
      }

      if (!packages || packages.length === 0) {
        setMessage('⚠️ لا توجد باقات في قاعدة البيانات. استخدم زر "إضافة باقات افتراضية"')
        return
      }

      // تفعيل جميع الباقات غير النشطة
      for (const pkg of packages) {
        if (!pkg.is_active) {
          const { error: updateError } = await supabase.rpc('admin_upsert_package', {
            p_id: pkg.id,
            p_name: pkg.name,
            p_price: pkg.price,
            p_duration_days: pkg.duration_days,
            p_is_active: true,
            p_description: pkg.description || null,
            p_max_places: pkg.max_places ?? 1,
            p_priority_weight: pkg.priority_weight ?? 0,
          })

          if (updateError) {
            console.error('خطأ في تفعيل الباقة:', pkg.name, updateError)
          }
        }
      }

      setMessage('✅ تم تفعيل جميع الباقات بنجاح!')
      // إعادة التحقق من قاعدة البيانات
      setTimeout(() => checkDatabase(), 1000)
    } catch (err: any) {
      setMessage('❌ حدث خطأ: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container" style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>🔍 فاحص قاعدة البيانات الشامل</h1>

      <div className="card" style={{ marginBottom: '1rem', padding: '1.5rem' }}>
        <h2 style={{ marginTop: 0 }}>الإجراءات السريعة</h2>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <button
            onClick={checkDatabase}
            disabled={loading}
            className="btn primary"
            style={{ minWidth: '200px' }}
          >
            {loading ? 'جارٍ التحقق...' : '🔍 التحقق من قاعدة البيانات'}
          </button>
          <button
            onClick={addDefaultPackages}
            disabled={loading}
            className="btn"
            style={{ minWidth: '200px', backgroundColor: '#4CAF50', color: 'white' }}
          >
            ➕ إضافة باقات افتراضية
          </button>
          <button
            onClick={fixPackages}
            disabled={loading}
            className="btn"
            style={{ minWidth: '200px', backgroundColor: '#FF9800', color: 'white' }}
          >
            ✅ تفعيل جميع الباقات
          </button>
        </div>
      </div>

      {message && (
        <div
          className="card"
          style={{
            marginBottom: '1rem',
            padding: '1rem',
            backgroundColor: message.includes('✅') ? '#e8f5e9' : message.includes('❌') ? '#ffebee' : '#fff3cd',
            border: `1px solid ${message.includes('✅') ? '#4CAF50' : message.includes('❌') ? '#f44336' : '#FF9800'}`,
          }}
        >
          <p style={{ margin: 0, fontWeight: 'bold' }}>{message}</p>
        </div>
      )}

      {status && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {/* ملخص عام */}
          <div className="card" style={{ padding: '1.5rem', backgroundColor: '#e3f2fd', border: '2px solid #2196F3' }}>
            <h2 style={{ marginTop: 0 }}>📊 ملخص قاعدة البيانات</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <strong>إجمالي الجداول:</strong> {status.totalTables}
              </div>
              <div>
                <strong>الجداول المتاحة:</strong> <span style={{ color: '#4CAF50' }}>{status.accessibleTables}</span>
              </div>
              <div>
                <strong>الدوال المتاحة:</strong> {status.totalFunctions}
              </div>
            </div>
          </div>

          {/* قائمة جميع الجداول */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h2 style={{ marginTop: 0 }}>📋 جميع الجداول ({status.tables.length})</h2>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', 
              gap: '0.75rem',
              marginTop: '1rem',
              maxHeight: '500px',
              overflowY: 'auto',
              padding: '0.5rem'
            }}>
              {status.tables.map((table) => (
                <div
                  key={table.name}
                  style={{
                    padding: '1rem',
                    border: `2px solid ${table.exists ? '#4CAF50' : '#f44336'}`,
                    borderRadius: '8px',
                    backgroundColor: table.exists ? '#f1f8f4' : '#ffebee',
                    cursor: table.exists ? 'pointer' : 'default',
                  }}
                  onClick={() => table.exists && viewTableData(table.name)}
                  title={table.exists ? 'انقر لعرض البيانات' : table.error || 'غير متاح'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <strong style={{ fontSize: '0.95rem' }}>{table.name}</strong>
                    {table.exists ? (
                      <span style={{ color: '#4CAF50', fontSize: '0.85rem' }}>✓</span>
                    ) : (
                      <span style={{ color: '#f44336', fontSize: '0.85rem' }}>✗</span>
                    )}
                  </div>
                  {table.exists ? (
                    <div style={{ fontSize: '0.85rem', color: '#666' }}>
                      {table.count.toLocaleString()} سجل
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.75rem', color: '#f44336', marginTop: '0.25rem' }}>
                      {table.error || 'غير متاح'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* عرض بيانات الجدول المختار */}
          {selectedTable && tableData.length > 0 && (
            <div className="card" style={{ padding: '1.5rem', maxHeight: '600px', overflow: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ marginTop: 0 }}>📄 بيانات جدول: {selectedTable}</h3>
                <button
                  onClick={() => { setSelectedTable(null); setTableData([]); }}
                  className="btn"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                >
                  إغلاق
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      {Object.keys(tableData[0] || {}).map((key) => (
                        <th key={key} style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 'bold' }}>
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.slice(0, 50).map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                        {Object.values(row).map((value: any, colIdx) => (
                          <td key={colIdx} style={{ padding: '0.5rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {value !== null && value !== undefined
                              ? typeof value === 'object'
                                ? JSON.stringify(value).substring(0, 50) + '...'
                                : String(value).substring(0, 100)
                              : 'null'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {tableData.length > 50 && (
                  <p style={{ marginTop: '1rem', color: '#666', fontSize: '0.85rem' }}>
                    عرض أول 50 سجل من أصل {tableData.length} سجل
                  </p>
                )}
              </div>
            </div>
          )}

          {/* قائمة الدوال */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h2 style={{ marginTop: 0 }}>⚙️ الدوال المتاحة ({status.functions.length})</h2>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
              gap: '0.75rem',
              marginTop: '1rem',
              maxHeight: '400px',
              overflowY: 'auto',
              padding: '0.5rem'
            }}>
              {status.functions.map((func, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '1rem',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    backgroundColor: '#f9f9f9',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                    <strong style={{ fontSize: '0.95rem', color: '#1976d2' }}>{func.name}</strong>
                    <span style={{ fontSize: '0.75rem', color: '#666', backgroundColor: '#e3f2fd', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                      {func.schema}
                    </span>
                  </div>
                  {func.arguments && (
                    <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.25rem' }}>
                      <strong>المعاملات:</strong> {func.arguments.substring(0, 80)}
                      {func.arguments.length > 80 && '...'}
                    </div>
                  )}
                  <div style={{ fontSize: '0.8rem', color: '#666' }}>
                    <strong>نوع الإرجاع:</strong> {func.return_type}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* معلومات إضافية */}
          <div className="card" style={{ padding: '1.5rem', backgroundColor: '#f5f5f5' }}>
            <h3 style={{ marginTop: 0 }}>💡 ملاحظات مهمة:</h3>
            <ul style={{ lineHeight: '1.8' }}>
              <li>انقر على أي جدول متاح لعرض بياناته (حتى 100 سجل)</li>
              <li>الجداول باللون الأحمر غير متاحة بسبب RLS أو مشاكل الصلاحيات</li>
              <li>استخدم زر "إضافة باقات افتراضية" لإضافة 3 باقات جاهزة للاستخدام</li>
              <li>استخدم زر "تفعيل جميع الباقات" لتفعيل أي باقات غير نشطة</li>
              <li>تأكد من أنك مسجل دخول كمسؤول (admin) لاستخدام هذه الأدوات</li>
            </ul>
          </div>
        </div>
      )}

      {!status && (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
          <p>اضغط على زر "التحقق من قاعدة البيانات" لبدء الفحص</p>
        </div>
      )}
    </div>
  )
}

