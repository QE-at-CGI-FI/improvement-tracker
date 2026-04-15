import { useState, useEffect, useMemo } from 'react'
import { loadData, saveData, STATUS_CONFIG } from './data.js'
import ImprovementModal from './ImprovementModal.jsx'

export default function App() {
  const [items, setItems] = useState(() => loadData())
  const [modal, setModal] = useState(null) // null | 'new' | item object
  const [detail, setDetail] = useState(null) // item being viewed
  const [filters, setFilters] = useState({ area: '', subarea: '', businessArea: '', responsibility: '', status: '' })
  const [search, setSearch] = useState('')
  const [dragging, setDragging] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  useEffect(() => { saveData(items) }, [items])

  // Derived filter options
  const areas = useMemo(() => [...new Set(items.map(i => i.area).filter(Boolean))].sort(), [items])
  const subareas = useMemo(() => [...new Set(items.filter(i => !filters.area || i.area === filters.area).map(i => i.subarea).filter(Boolean))].sort(), [items, filters.area])
  const businessAreas = useMemo(() => [...new Set(items.map(i => i.businessArea).filter(Boolean))].sort(), [items])
  const responsibilities = useMemo(() => [...new Set(items.map(i => i.responsibility).filter(Boolean))].sort(), [items])

  const filtered = useMemo(() => {
    return items
      .filter(i => {
        if (filters.area && i.area !== filters.area) return false
        if (filters.subarea && i.subarea !== filters.subarea) return false
        if (filters.businessArea && i.businessArea !== filters.businessArea) return false
        if (filters.responsibility && i.responsibility !== filters.responsibility) return false
        if (filters.status && i.status !== filters.status) return false
        if (search && !`${i.title} ${i.description} ${i.area} ${i.subarea} ${i.businessArea} ${i.responsibility}`.toLowerCase().includes(search.toLowerCase())) return false
        return true
      })
      .sort((a, b) => a.priority - b.priority)
  }, [items, filters, search])

  function handleSave(updated) {
    setItems(prev => {
      if (prev.find(i => i.id === updated.id)) {
        return prev.map(i => i.id === updated.id ? updated : i)
      }
      return [...prev, updated]
    })
    setModal(null)
    setDetail(null)
  }

  function handleDelete(id) {
    setItems(prev => {
      const removed = prev.find(i => i.id === id)
      return prev.filter(i => i.id !== id).map(i =>
        i.priority > removed.priority ? { ...i, priority: i.priority - 1 } : i
      )
    })
    setConfirmDelete(null)
    setDetail(null)
  }

  function moveUp(id) {
    setItems(prev => {
      const sorted = [...prev].sort((a, b) => a.priority - b.priority)
      const idx = sorted.findIndex(i => i.id === id)
      if (idx <= 0) return prev
      const a = sorted[idx], b = sorted[idx - 1]
      return prev.map(i => i.id === a.id ? { ...i, priority: b.priority } : i.id === b.id ? { ...i, priority: a.priority } : i)
    })
  }

  function moveDown(id) {
    setItems(prev => {
      const sorted = [...prev].sort((a, b) => a.priority - b.priority)
      const idx = sorted.findIndex(i => i.id === id)
      if (idx >= sorted.length - 1) return prev
      const a = sorted[idx], b = sorted[idx + 1]
      return prev.map(i => i.id === a.id ? { ...i, priority: b.priority } : i.id === b.id ? { ...i, priority: a.priority } : i)
    })
  }

  // Drag-and-drop reorder
  function handleDrop(targetId) {
    if (!dragging || dragging === targetId) { setDragging(null); setDragOver(null); return }
    setItems(prev => {
      const sorted = [...prev].sort((a, b) => a.priority - b.priority)
      const fromIdx = sorted.findIndex(i => i.id === dragging)
      const toIdx = sorted.findIndex(i => i.id === targetId)
      const reordered = [...sorted]
      const [moved] = reordered.splice(fromIdx, 1)
      reordered.splice(toIdx, 0, moved)
      return reordered.map((item, idx) => ({ ...item, priority: idx + 1 }))
    })
    setDragging(null)
    setDragOver(null)
  }

  function setFilter(key, value) {
    setFilters(f => {
      const next = { ...f, [key]: value }
      if (key === 'area') next.subarea = ''
      return next
    })
  }

  function clearFilters() {
    setFilters({ area: '', subarea: '', businessArea: '', responsibility: '', status: '' })
    setSearch('')
  }

  const hasFilters = search || Object.values(filters).some(Boolean)
  const maxPriority = items.length > 0 ? Math.max(...items.map(i => i.priority)) : 0

  return (
    <div style={s.app}>
      {/* Header */}
      <header style={s.header}>
        <div style={s.headerInner}>
          <div>
            <h1 style={s.h1}>Improvement Backlog</h1>
            <p style={s.subtitle}>{items.length} improvements tracked · sorted by absolute priority</p>
          </div>
          <button style={s.newBtn} onClick={() => setModal('new')}>+ New Improvement</button>
        </div>
      </header>

      {/* Filters */}
      <div style={s.filtersBar}>
        <input style={s.search} placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />

        <Select value={filters.status} onChange={v => setFilter('status', v)} label="Status">
          <option value="">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([k, c]) => <option key={k} value={k}>{c.emoji} {c.label}</option>)}
        </Select>

        <Select value={filters.area} onChange={v => setFilter('area', v)} label="Area">
          <option value="">All Areas</option>
          {areas.map(a => <option key={a} value={a}>{a}</option>)}
        </Select>

        <Select value={filters.subarea} onChange={v => setFilter('subarea', v)} label="Subarea">
          <option value="">All Subareas</option>
          {subareas.map(a => <option key={a} value={a}>{a}</option>)}
        </Select>

        <Select value={filters.businessArea} onChange={v => setFilter('businessArea', v)} label="Business Area">
          <option value="">All Business Areas</option>
          {businessAreas.map(a => <option key={a} value={a}>{a}</option>)}
        </Select>

        <Select value={filters.responsibility} onChange={v => setFilter('responsibility', v)} label="Responsibility">
          <option value="">All Teams</option>
          {responsibilities.map(a => <option key={a} value={a}>{a}</option>)}
        </Select>

        {hasFilters && (
          <button style={s.clearBtn} onClick={clearFilters}>Clear filters ✕</button>
        )}
      </div>

      {/* Stats bar */}
      <div style={s.statsBar}>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const count = items.filter(i => i.status === key).length
          return (
            <button key={key} style={{ ...s.statChip, background: cfg.bg, borderColor: cfg.border, color: cfg.color, fontWeight: filters.status === key ? 700 : 400 }}
              onClick={() => setFilter('status', filters.status === key ? '' : key)}>
              {cfg.emoji} {cfg.label}: {count}
            </button>
          )
        })}
        {hasFilters && <span style={s.filteredNote}>Showing {filtered.length} of {items.length}</span>}
      </div>

      {/* Table */}
      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={{ ...s.th, width: 48 }}>#</th>
              <th style={s.th}>Improvement</th>
              <th style={{ ...s.th, width: 120 }}>Area / Subarea</th>
              <th style={{ ...s.th, width: 120 }}>Business Area</th>
              <th style={{ ...s.th, width: 140 }}>Responsibility</th>
              <th style={{ ...s.th, width: 110 }}>Status</th>
              <th style={{ ...s.th, width: 90 }}>Reqs</th>
              <th style={{ ...s.th, width: 90 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={s.empty}>No improvements match the current filters.</td></tr>
            )}
            {filtered.map((item, idx) => {
              const cfg = STATUS_CONFIG[item.status]
              const isOver = dragOver === item.id
              return (
                <tr
                  key={item.id}
                  draggable
                  onDragStart={() => setDragging(item.id)}
                  onDragOver={e => { e.preventDefault(); setDragOver(item.id) }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={() => handleDrop(item.id)}
                  style={{ ...s.tr, background: cfg.bg, borderLeft: `4px solid ${cfg.border}`, opacity: dragging === item.id ? 0.4 : 1, outline: isOver ? `2px dashed ${cfg.border}` : undefined }}
                >
                  <td style={s.tdCenter}>
                    <span style={s.priority}>{item.priority}</span>
                  </td>
                  <td style={s.td}>
                    <button style={s.titleBtn} onClick={() => setDetail(item)}>
                      {item.title}
                    </button>
                    {item.description && <div style={s.desc}>{item.description.slice(0, 80)}{item.description.length > 80 ? '…' : ''}</div>}
                  </td>
                  <td style={s.td}>
                    {item.area && <span style={s.tag}>{item.area}</span>}
                    {item.subarea && <span style={{ ...s.tag, background: '#eef2ff', color: '#4f46e5' }}>{item.subarea}</span>}
                  </td>
                  <td style={s.td}>
                    {item.businessArea && <span style={{ ...s.tag, background: '#fef3c7', color: '#92400e' }}>{item.businessArea}</span>}
                  </td>
                  <td style={s.td}>
                    {item.responsibility && <span style={{ ...s.tag, background: '#ede9fe', color: '#5b21b6' }}>{item.responsibility}</span>}
                  </td>
                  <td style={s.tdCenter}>
                    <StatusBadge cfg={cfg} />
                  </td>
                  <td style={s.tdCenter}>
                    {item.requirements.length > 0 && (
                      <span style={s.reqCount}>{item.requirements.length}</span>
                    )}
                  </td>
                  <td style={s.tdCenter}>
                    <div style={s.actions}>
                      <button style={s.iconBtn} title="Move up" onClick={() => moveUp(item.id)} disabled={item.priority === 1}>↑</button>
                      <button style={s.iconBtn} title="Move down" onClick={() => moveDown(item.id)} disabled={item.priority === maxPriority}>↓</button>
                      <button style={s.iconBtn} title="Edit" onClick={() => setModal(item)}>✎</button>
                      <button style={{ ...s.iconBtn, color: '#e53e3e' }} title="Delete" onClick={() => setConfirmDelete(item)}>✕</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Detail panel */}
      {detail && (
        <DetailPanel
          item={detail}
          onEdit={() => { setModal(detail); setDetail(null) }}
          onDelete={() => setConfirmDelete(detail)}
          onClose={() => setDetail(null)}
        />
      )}

      {/* Modal */}
      {modal && (
        <ImprovementModal
          item={modal === 'new' ? null : modal}
          maxPriority={maxPriority}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div style={{ ...s.overlay, zIndex: 2000 }} onClick={e => e.target === e.currentTarget && setConfirmDelete(null)}>
          <div style={s.confirmBox}>
            <h3 style={{ marginBottom: 8 }}>Delete improvement?</h3>
            <p style={{ color: '#718096', marginBottom: 20, fontSize: 14 }}>"{confirmDelete.title}" will be permanently removed and priorities will be recalculated.</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button style={s.cancelBtn} onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button style={s.deleteBtn} onClick={() => handleDelete(confirmDelete.id)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Select({ value, onChange, label, children }) {
  return (
    <select style={s.select} value={value} onChange={e => onChange(e.target.value)} aria-label={label}>
      {children}
    </select>
  )
}

function StatusBadge({ cfg }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color, display: 'inline-block' }} />
      {cfg.label}
    </span>
  )
}

function DetailPanel({ item, onEdit, onDelete, onClose }) {
  const cfg = STATUS_CONFIG[item.status]
  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.detail}>
        <div style={s.detailHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={s.priorityLarge}>#{item.priority}</span>
            <h2 style={{ fontSize: 20, fontWeight: 700 }}>{item.title}</h2>
          </div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            <StatusBadge cfg={cfg} />
            {item.area && <span style={s.tag}>{item.area}</span>}
            {item.subarea && <span style={{ ...s.tag, background: '#eef2ff', color: '#4f46e5' }}>{item.subarea}</span>}
            {item.businessArea && <span style={{ ...s.tag, background: '#fef3c7', color: '#92400e' }}>Biz: {item.businessArea}</span>}
            {item.responsibility && <span style={{ ...s.tag, background: '#ede9fe', color: '#5b21b6' }}>Owner: {item.responsibility}</span>}
          </div>

          {item.description && (
            <div style={{ marginBottom: 20 }}>
              <h4 style={s.sectionLabel}>Description</h4>
              <p style={{ fontSize: 14, color: '#4a5568', lineHeight: 1.6 }}>{item.description}</p>
            </div>
          )}

          {item.requirements.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h4 style={s.sectionLabel}>Requirements ({item.requirements.length})</h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {item.requirements.map((r, i) => (
                  <li key={i} style={s.reqItem}>
                    <span style={{ color: cfg.color, fontSize: 16 }}>◆</span>
                    <span style={{ fontSize: 14 }}>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ fontSize: 12, color: '#a0aec0', marginBottom: 20 }}>Created: {item.createdAt}</div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button style={s.editBtn} onClick={onEdit}>Edit</button>
            <button style={{ ...s.deleteBtn, padding: '10px 20px' }} onClick={onDelete}>Delete</button>
          </div>
        </div>
      </div>
    </div>
  )
}

const s = {
  app: { minHeight: '100vh', display: 'flex', flexDirection: 'column' },
  header: { background: '#1a1a2e', color: '#fff', padding: '20px 0' },
  headerInner: { maxWidth: 1400, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  h1: { fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px' },
  subtitle: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
  newBtn: { background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' },

  filtersBar: { background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '12px 24px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', maxWidth: '100%' },
  search: { padding: '8px 14px', border: '1.5px solid #e2e8f0', borderRadius: 6, fontSize: 14, minWidth: 200, outline: 'none' },
  select: { padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 6, fontSize: 13, color: '#4a5568', background: '#fff', cursor: 'pointer', outline: 'none' },
  clearBtn: { padding: '8px 14px', background: '#fee2e2', color: '#c53030', border: '1.5px solid #fca5a5', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontWeight: 600 },

  statsBar: { maxWidth: '100%', padding: '10px 24px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' },
  statChip: { display: 'flex', alignItems: 'center', gap: 6, padding: '5px 14px', border: '1.5px solid', borderRadius: 20, fontSize: 13, cursor: 'pointer', fontWeight: 500 },
  filteredNote: { fontSize: 13, color: '#718096', marginLeft: 'auto' },

  tableWrap: { flex: 1, overflowX: 'auto', padding: '24px' },
  table: { width: '100%', borderCollapse: 'separate', borderSpacing: '0 6px', minWidth: 900 },
  th: { textAlign: 'left', padding: '10px 14px', fontSize: 12, fontWeight: 700, color: '#718096', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'transparent' },
  tr: { cursor: 'grab', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.07)' },
  td: { padding: '14px 14px', verticalAlign: 'top', fontSize: 14 },
  tdCenter: { padding: '14px 14px', verticalAlign: 'middle', textAlign: 'center', fontSize: 14 },
  empty: { textAlign: 'center', padding: 48, color: '#a0aec0', fontSize: 15 },

  priority: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', background: '#1a1a2e', color: '#fff', fontSize: 12, fontWeight: 700 },
  priorityLarge: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '50%', background: '#1a1a2e', color: '#fff', fontSize: 14, fontWeight: 700 },

  titleBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#1a1a2e', textAlign: 'left', padding: 0, display: 'block' },
  desc: { fontSize: 12, color: '#718096', marginTop: 4, lineHeight: 1.5 },

  tag: { display: 'inline-block', fontSize: 11, fontWeight: 600, background: '#f1f5f9', color: '#475569', borderRadius: 4, padding: '2px 8px', marginRight: 4, marginBottom: 4 },

  reqCount: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: '#eef2ff', color: '#4f46e5', fontSize: 12, fontWeight: 700 },

  actions: { display: 'flex', gap: 4, justifyContent: 'center' },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: '#718096', padding: '4px 6px', borderRadius: 4, transition: 'background 0.1s' },

  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 },
  detail: { background: '#fff', borderRadius: 12, width: '100%', maxWidth: 600, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' },
  detailHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #e2e8f0' },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#718096', padding: 4 },
  sectionLabel: { fontSize: 12, fontWeight: 700, color: '#718096', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 },
  reqItem: { display: 'flex', alignItems: 'flex-start', gap: 8, background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 12px' },

  confirmBox: { background: '#fff', borderRadius: 12, padding: 28, maxWidth: 420, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' },
  cancelBtn: { padding: '10px 20px', background: 'none', border: '1.5px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#718096' },
  editBtn: { padding: '10px 24px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 600 },
  deleteBtn: { padding: '10px 20px', background: '#fff5f5', color: '#e53e3e', border: '1.5px solid #fc8181', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 600 },
}
