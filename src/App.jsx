import { useState, useEffect, useMemo } from 'react'
import { loadData, saveData, STATUS_CONFIG } from './data.js'
import ImprovementModal from './ImprovementModal.jsx'
import * as XLSX from 'xlsx'

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
  const businessAreas = useMemo(() => [...new Set(items.flatMap(i => Array.isArray(i.businessArea) ? i.businessArea : i.businessArea ? [i.businessArea] : []))].sort(), [items])
  const responsibilities = useMemo(() => [...new Set(items.map(i => i.responsibility).filter(Boolean))].sort(), [items])

  const filtered = useMemo(() => {
    return items
      .filter(i => {
        if (filters.area && i.area !== filters.area) return false
        if (filters.subarea && i.subarea !== filters.subarea) return false
        if (filters.businessArea && !(Array.isArray(i.businessArea) ? i.businessArea : i.businessArea ? [i.businessArea] : []).includes(filters.businessArea)) return false
        if (filters.responsibility && i.responsibility !== filters.responsibility) return false
        if (filters.status && i.status !== filters.status) return false
        if (search && !`${i.title} ${i.description} ${i.area} ${i.subarea} ${(Array.isArray(i.businessArea) ? i.businessArea : [i.businessArea]).join(' ')} ${i.responsibility}`.toLowerCase().includes(search.toLowerCase())) return false
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
      return prev.filter(i => i.id !== id).map(i => ({
        ...i,
        priority: i.priority > removed.priority ? i.priority - 1 : i.priority,
        dependencies: (i.dependencies || []).filter(d => d !== id),
      }))
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

  function handleExport() {
    const json = JSON.stringify(items, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `improvements-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImport(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = evt => {
      try {
        const parsed = JSON.parse(evt.target.result)
        if (!Array.isArray(parsed)) throw new Error('Expected an array')
        setItems(parsed)
      } catch {
        alert('Invalid file: must be a JSON array of improvements exported from this app.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // Exports all improvements as a .xlsx file (write-only — importing Excel is not supported).
  // Uses SheetJS (xlsx). Note: xlsx has known vulnerabilities in its file *parser*, but we
  // only use the write path here, so those vulnerabilities are not exposed.
  function handleExportExcel() {
    // Flatten each improvement into a plain object with human-readable column names.
    // Multi-value fields (requirements, dependencies, business areas) are serialised as
    // newline-separated strings so each improvement occupies exactly one row.
    const rows = [...items].sort((a, b) => a.priority - b.priority).map(item => {
      // Requirements may be plain strings (legacy) or {text, accepted} objects.
      const reqs = (item.requirements || []).map(r =>
        typeof r === 'string' ? r : (r.accepted ? `[Accepted] ${r.text}` : r.text)
      )

      // Resolve dependency IDs to readable labels; fall back to the raw ID if the
      // referenced item has been deleted.
      const deps = (item.dependencies || []).map(depId => {
        const dep = items.find(i => i.id === depId)
        return dep ? `#${dep.priority} ${dep.title}` : depId
      })

      // businessArea migrated from string → array; handle both shapes defensively.
      const bizAreas = Array.isArray(item.businessArea)
        ? item.businessArea
        : item.businessArea ? [item.businessArea] : []

      const acceptedCount = (item.requirements || []).filter(r => typeof r !== 'string' && r.accepted).length

      return {
        'Priority': item.priority,
        'Title': item.title,
        'Tagline': item.tagline || '',
        'Status': STATUS_CONFIG[item.status]?.label ?? item.status,
        'Area': item.area || '',
        'Subarea': item.subarea || '',
        'Business Area': bizAreas.join(', '),
        'Responsibility': item.responsibility || '',
        'Problem Statement': item.description || '',
        'Requirements': reqs.join('\n'),
        'Requirements Total': (item.requirements || []).length,
        'Requirements Accepted': acceptedCount,
        'Contract': item.contract || '',
        'Dependencies': deps.join('\n'),
        'Created': item.createdAt || '',
      }
    })

    const ws = XLSX.utils.json_to_sheet(rows)
    // wch = column width in characters; order matches the key order of the row objects above.
    ws['!cols'] = [
      { wch: 8 },  // Priority
      { wch: 40 }, // Title
      { wch: 50 }, // Tagline
      { wch: 12 }, // Status
      { wch: 16 }, // Area
      { wch: 16 }, // Subarea
      { wch: 24 }, // Business Area
      { wch: 20 }, // Responsibility
      { wch: 50 }, // Problem Statement
      { wch: 50 }, // Requirements
      { wch: 10 }, // Requirements Total
      { wch: 10 }, // Requirements Accepted
      { wch: 30 }, // Contract
      { wch: 40 }, // Dependencies
      { wch: 12 }, // Created
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Improvements')
    XLSX.writeFile(wb, `improvements-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <div style={s.app}>
      {/* Header */}
      <header style={s.header}>
        <div style={s.headerInner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 71.881 33.434" style={{ height: 40, width: 'auto' }} aria-label="CGI">
              <path fill="#E31937" d="M17.862,6.448c-6.543,0-10.555,5.11-10.555,10.268c0,6.21,5.063,10.269,10.603,10.269c3.678,0,7.164-1.623,10.125-4.25v7.689c-3.104,1.862-7.355,3.01-10.65,3.01C7.928,33.432,0,25.742,0,16.716C0,7.164,7.976,0,17.432,0c3.63,0,7.881,1.098,10.651,2.483v7.547C24.597,7.737,21.063,6.448,17.862,6.448zM48.143,33.432c-9.505,0-17.529-7.402-17.529-16.716C30.614,7.307,38.591,0,48.574,0c3.631,0,8.12,0.955,10.891,2.245v7.497c-3.154-1.815-7.213-3.295-10.749-3.295c-6.543,0-10.793,5.11-10.793,10.268c0,6.066,5.015,10.46,10.89,10.46c1.241,0,2.435-0.096,3.964-0.669v-6.018h-5.35v-6.353h12.227v16.908C56.168,32.62,52.251,33.432,48.143,33.432zM65.004,32.764V0.668h6.877v32.096H65.004z"/>
            </svg>
            <div>
              <h1 style={s.h1}>Improvement Backlog</h1>
              <p style={s.subtitle}>{items.length} improvements tracked · sorted by absolute priority</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button style={s.exportBtn} onClick={handleExportExcel}>↓ Export Excel</button>
            <button style={s.exportBtn} onClick={handleExport}>↓ Export JSON</button>
            <label style={s.importBtn}>
              ↑ Import JSON
              <input type="file" accept="application/json,.json" onChange={handleImport} style={{ display: 'none' }} />
            </label>
            <button style={s.newBtn} onClick={() => setModal('new')}>+ New Improvement</button>
          </div>
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
              <th style={{ ...s.th, width: 70 }}>Contract</th>
              <th style={{ ...s.th, width: 90 }}>Reqs</th>
              <th style={{ ...s.th, width: 90 }}>Blocked by</th>
              <th style={{ ...s.th, width: 90 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={10} style={s.empty}>No improvements match the current filters.</td></tr>
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
                    {item.tagline && <div style={s.tagline}>{item.tagline}</div>}
                    {item.description && <div style={s.desc}>{item.description.slice(0, 80)}{item.description.length > 80 ? '…' : ''}</div>}
                  </td>
                  <td style={s.td}>
                    {item.area && <span style={s.tag}>{item.area}</span>}
                    {item.subarea && <span style={{ ...s.tag, background: '#F3F0F9', color: '#4C2C92' }}>{item.subarea}</span>}
                  </td>
                  <td style={s.td}>
                    {(Array.isArray(item.businessArea) ? item.businessArea : item.businessArea ? [item.businessArea] : []).map((ba, i) => (
                      <span key={i} style={{ ...s.tag, background: '#fef3c7', color: '#92400e' }}>{ba}</span>
                    ))}
                  </td>
                  <td style={s.td}>
                    {item.responsibility && <span style={{ ...s.tag, background: '#E8E0F3', color: '#4C2C92' }}>{item.responsibility}</span>}
                  </td>
                  <td style={s.tdCenter}>
                    <StatusBadge cfg={cfg} />
                  </td>
                  <td style={s.tdCenter}>
                    {item.contract && (
                      <span title={item.contract} style={{ fontSize: 16, color: '#16a34a', cursor: 'default' }}>✓</span>
                    )}
                  </td>
                  <td style={s.tdCenter}>
                    {item.requirements.length > 0 && (
                      <span style={s.reqCount}>{item.requirements.length}</span>
                    )}
                  </td>
                  <td style={s.tdCenter}>
                    {(item.dependencies || []).length > 0 && (() => {
                      const unmet = (item.dependencies || []).filter(depId => {
                        const dep = items.find(i => i.id === depId)
                        return dep && dep.status !== 'done'
                      })
                      return (
                        <span style={{ ...s.reqCount, background: unmet.length > 0 ? '#fef3c7' : '#dcfce7', color: unmet.length > 0 ? '#92400e' : '#166534' }}>
                          {item.dependencies.length}
                        </span>
                      )
                    })()}
                  </td>
                  <td style={s.tdCenter}>
                    <div style={s.actions}>
                      <button style={s.iconBtn} title="Move up" onClick={() => moveUp(item.id)} disabled={item.priority === 1}>↑</button>
                      <button style={s.iconBtn} title="Move down" onClick={() => moveDown(item.id)} disabled={item.priority === maxPriority}>↓</button>
                      <button style={s.iconBtn} title="Edit" onClick={() => setModal(item)}>✎</button>
                      <button style={{ ...s.iconBtn, color: '#E31937' }} title="Delete" onClick={() => setConfirmDelete(item)}>✕</button>
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
          allItems={items}
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
          allItems={items}
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

function DetailPanel({ item, allItems, onEdit, onDelete, onClose }) {
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
            {item.subarea && <span style={{ ...s.tag, background: '#F3F0F9', color: '#4C2C92' }}>{item.subarea}</span>}
            {(Array.isArray(item.businessArea) ? item.businessArea : item.businessArea ? [item.businessArea] : []).map((ba, i) => (
              <span key={i} style={{ ...s.tag, background: '#fef3c7', color: '#92400e' }}>Biz: {ba}</span>
            ))}
            {item.responsibility && <span style={{ ...s.tag, background: '#E8E0F3', color: '#4C2C92' }}>Owner: {item.responsibility}</span>}
          </div>

          {item.contract && (
            <div style={{ marginBottom: 16, padding: '10px 14px', background: '#f0fdf4', borderLeft: '3px solid #16a34a', borderRadius: 4 }}>
              <h4 style={{ ...s.sectionLabel, color: '#166534', marginBottom: 4 }}>Contract</h4>
              <p style={{ fontSize: 14, color: '#166534' }}>{item.contract}</p>
            </div>
          )}

          {item.tagline && (
            <div style={{ marginBottom: 16, padding: '10px 14px', background: '#f8fafc', borderLeft: '3px solid #4C2C92', borderRadius: 4 }}>
              <p style={{ fontSize: 14, color: '#4C2C92', fontStyle: 'italic', fontWeight: 500 }}>{item.tagline}</p>
            </div>
          )}

          {item.description && (
            <div style={{ marginBottom: 20 }}>
              <h4 style={s.sectionLabel}>Problem statement</h4>
              <p style={{ fontSize: 14, color: '#4a5568', lineHeight: 1.6 }}>{item.description}</p>
            </div>
          )}

          {item.requirements.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h4 style={s.sectionLabel}>Requirements ({item.requirements.length})</h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {item.requirements.map((r, i) => {
                  const text = typeof r === 'string' ? r : r.text
                  const accepted = typeof r === 'string' ? false : r.accepted
                  return (
                    <li key={i} style={s.reqItem}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: accepted ? '#166534' : '#94a3b8', flexShrink: 0 }}>{accepted ? '✓' : '○'}</span>
                      <span style={{ fontSize: 14, fontWeight: accepted ? 700 : 'normal', color: accepted ? '#166534' : 'inherit' }}>{text}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {(item.dependencies || []).length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h4 style={s.sectionLabel}>Depends on ({item.dependencies.length})</h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {item.dependencies.map(depId => {
                  const dep = (allItems || []).find(i => i.id === depId)
                  const depCfg = dep ? STATUS_CONFIG[dep.status] : null
                  return (
                    <li key={depId} style={{ ...s.reqItem, justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 14 }}>
                        {dep ? <><span style={{ fontWeight: 600 }}>#{dep.priority}</span> {dep.title}</> : <span style={{ color: '#a0aec0' }}>Removed item</span>}
                      </span>
                      {depCfg && <span style={{ fontSize: 11, fontWeight: 600, color: depCfg.color, background: depCfg.bg, border: `1px solid ${depCfg.border}`, borderRadius: 10, padding: '2px 8px', whiteSpace: 'nowrap' }}>{depCfg.label}</span>}
                    </li>
                  )
                })}
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
  header: { background: '#2D1A57', color: '#fff', padding: '20px 0' },
  headerInner: { maxWidth: 1400, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  h1: { fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px' },
  subtitle: { fontSize: 13, color: '#B89CD9', marginTop: 4 },
  newBtn: { background: '#E31937', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  exportBtn: { background: 'none', color: '#B89CD9', border: '1.5px solid #7B5EAD', borderRadius: 8, padding: '9px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  importBtn: { background: 'none', color: '#B89CD9', border: '1.5px solid #7B5EAD', borderRadius: 8, padding: '9px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'inline-block' },

  filtersBar: { background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '12px 24px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', maxWidth: '100%' },
  search: { padding: '8px 14px', border: '1.5px solid #e2e8f0', borderRadius: 6, fontSize: 14, minWidth: 200, outline: 'none' },
  select: { padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 6, fontSize: 13, color: '#4a5568', background: '#fff', cursor: 'pointer', outline: 'none' },
  clearBtn: { padding: '8px 14px', background: '#FEF2F4', color: '#E31937', border: '1.5px solid #F5A3B1', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontWeight: 600 },

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

  priority: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', background: '#4C2C92', color: '#fff', fontSize: 12, fontWeight: 700 },
  priorityLarge: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '50%', background: '#4C2C92', color: '#fff', fontSize: 14, fontWeight: 700 },

  titleBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#2D1A57', textAlign: 'left', padding: 0, display: 'block' },
  tagline: { fontSize: 12, color: '#4C2C92', fontStyle: 'italic', marginTop: 3, lineHeight: 1.4 },
  desc: { fontSize: 12, color: '#718096', marginTop: 2, lineHeight: 1.5 },

  tag: { display: 'inline-block', fontSize: 11, fontWeight: 600, background: '#f1f5f9', color: '#475569', borderRadius: 4, padding: '2px 8px', marginRight: 4, marginBottom: 4 },

  reqCount: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: '#F3F0F9', color: '#4C2C92', fontSize: 12, fontWeight: 700 },

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
  editBtn: { padding: '10px 24px', background: '#4C2C92', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 600 },
  deleteBtn: { padding: '10px 20px', background: '#FEF2F4', color: '#E31937', border: '1.5px solid #F5A3B1', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 600 },
}
