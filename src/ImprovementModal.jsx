import { useState, useEffect } from 'react'
import { STATUS_CONFIG, generateId } from './data.js'

const EMPTY = {
  title: '',
  tagline: '',
  description: '',
  area: '',
  subarea: '',
  status: 'listed',
  businessArea: '',
  responsibility: '',
  requirements: [],
}

export default function ImprovementModal({ item, maxPriority, onSave, onClose }) {
  const [form, setForm] = useState(EMPTY)
  const [reqInput, setReqInput] = useState('')

  useEffect(() => {
    if (item) setForm({ ...item })
    else setForm(EMPTY)
  }, [item])

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function addReq() {
    const trimmed = reqInput.trim()
    if (!trimmed) return
    setForm(f => ({ ...f, requirements: [...f.requirements, trimmed] }))
    setReqInput('')
  }

  function removeReq(i) {
    setForm(f => ({ ...f, requirements: f.requirements.filter((_, idx) => idx !== i) }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    const now = new Date().toISOString().slice(0, 10)
    if (item) {
      onSave({ ...form })
    } else {
      onSave({ ...form, id: generateId(), priority: maxPriority + 1, createdAt: now })
    }
  }

  return (
    <div style={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.title}>{item ? 'Edit Improvement' : 'New Improvement'}</h2>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.grid2}>
            <Field label="Title *" span={2}>
              <input style={styles.input} value={form.title} onChange={e => set('title', e.target.value)} placeholder="Improvement title" required />
            </Field>

            <Field label="Tagline — the why" span={2}>
              <input style={styles.input} value={form.tagline} onChange={e => set('tagline', e.target.value)} placeholder="One sentence: why does this matter?" />
            </Field>

            <Field label="Area">
              <input style={styles.input} value={form.area} onChange={e => set('area', e.target.value)} placeholder="e.g. Engineering" list="areas-list" />
            </Field>
            <Field label="Subarea">
              <input style={styles.input} value={form.subarea} onChange={e => set('subarea', e.target.value)} placeholder="e.g. DevOps" />
            </Field>

            <Field label="Business Area">
              <input style={styles.input} value={form.businessArea} onChange={e => set('businessArea', e.target.value)} placeholder="e.g. Operations" />
            </Field>
            <Field label="Organizational Responsibility">
              <input style={styles.input} value={form.responsibility} onChange={e => set('responsibility', e.target.value)} placeholder="e.g. Platform Team" />
            </Field>

            <Field label="Status" span={2}>
              <div style={styles.statusRow}>
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <label key={key} style={{ ...styles.statusOption, ...(form.status === key ? { background: cfg.bg, borderColor: cfg.border, fontWeight: 600 } : {}) }}>
                    <input type="radio" name="status" value={key} checked={form.status === key} onChange={() => set('status', key)} style={{ display: 'none' }} />
                    <span style={{ fontSize: 18 }}>{cfg.emoji}</span>
                    <span style={{ color: cfg.color }}>{cfg.label}</span>
                  </label>
                ))}
              </div>
            </Field>

            <Field label="Description" span={2}>
              <textarea style={{ ...styles.input, height: 80, resize: 'vertical' }} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe the improvement..." />
            </Field>

            <Field label="Requirements" span={2}>
              <div style={styles.reqArea}>
                {form.requirements.map((r, i) => (
                  <div key={i} style={styles.reqTag}>
                    <span>{r}</span>
                    <button type="button" style={styles.reqRemove} onClick={() => removeReq(i)}>✕</button>
                  </div>
                ))}
                <div style={styles.reqInputRow}>
                  <input
                    style={{ ...styles.input, flex: 1 }}
                    value={reqInput}
                    onChange={e => setReqInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addReq())}
                    placeholder="Add a requirement and press Enter"
                  />
                  <button type="button" style={styles.addReqBtn} onClick={addReq}>Add</button>
                </div>
              </div>
            </Field>
          </div>

          <div style={styles.footer}>
            <button type="button" style={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button type="submit" style={styles.saveBtn}>Save Improvement</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children, span }) {
  return (
    <div style={{ gridColumn: span === 2 ? '1 / -1' : undefined }}>
      <label style={styles.label}>{label}</label>
      {children}
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16,
  },
  modal: {
    background: '#fff', borderRadius: 12, width: '100%', maxWidth: 680,
    maxHeight: '90vh', overflow: 'auto',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '20px 24px', borderBottom: '1px solid #e2e8f0',
  },
  title: { fontSize: 18, fontWeight: 700, color: '#1a1a2e' },
  closeBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 18, color: '#718096', padding: 4,
  },
  form: { padding: 24 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#4a5568', marginBottom: 6 },
  input: {
    width: '100%', padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 6,
    fontSize: 14, color: '#1a1a2e', outline: 'none', transition: 'border-color 0.15s',
    fontFamily: 'inherit',
  },
  statusRow: { display: 'flex', gap: 12 },
  statusOption: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
    border: '2px solid #e2e8f0', borderRadius: 8, cursor: 'pointer',
    fontSize: 14, transition: 'all 0.15s', flex: 1, justifyContent: 'center',
  },
  reqArea: { display: 'flex', flexDirection: 'column', gap: 8 },
  reqTag: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: 6,
    padding: '6px 12px', fontSize: 14,
  },
  reqRemove: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#a0aec0', fontSize: 12, padding: '0 0 0 8px',
  },
  reqInputRow: { display: 'flex', gap: 8 },
  addReqBtn: {
    padding: '8px 16px', background: '#eef2ff', color: '#4f46e5',
    border: '1.5px solid #c7d2fe', borderRadius: 6, cursor: 'pointer',
    fontSize: 14, fontWeight: 600,
  },
  footer: {
    display: 'flex', justifyContent: 'flex-end', gap: 12,
    marginTop: 24, paddingTop: 16, borderTop: '1px solid #e2e8f0',
  },
  cancelBtn: {
    padding: '10px 20px', background: 'none', border: '1.5px solid #e2e8f0',
    borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#718096',
  },
  saveBtn: {
    padding: '10px 24px', background: '#4f46e5', color: '#fff',
    border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 600,
  },
}
