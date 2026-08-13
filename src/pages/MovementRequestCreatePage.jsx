import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { PageHeader } from '../components/layout/PageHeader.jsx'
import { MovementRequestHeaderForm } from '../components/movement-request/MovementRequestHeaderForm.jsx'
import { MovementRequestLinesTable } from '../components/movement-request/MovementRequestLinesTable.jsx'
import { LineEditDrawer } from '../components/movement-request/LineEditDrawer.jsx'
import { InlineError } from '../components/common/States.jsx'
import { movementRequestsApi } from '../api/movementRequestsApi.js'
import { validateHeader } from '../utils/validation.js'

const EMPTY_HEADER = {
  inventoryOrganization: null,
  requiredDate: '',
  description: '',
  costCenter: null,
  costCenterLabel: '',
}

export function MovementRequestCreatePage() {
  const navigate = useNavigate()
  const [header, setHeader] = useState(EMPTY_HEADER)
  const [lines, setLines] = useState([])
  const [errors, setErrors] = useState({})
  const [editingLineIndex, setEditingLineIndex] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  function handleHeaderChange(nextHeader) {
    // Every line field (item, source/destination subinventory or account) is organization-scoped,
    // so a changed organization invalidates all existing lines rather than leaving stale values.
    if (nextHeader.inventoryOrganization !== header.inventoryOrganization) {
      setLines([])
    }
    setHeader(nextHeader)
  }

  function openAddLine() {
    setEditingLineIndex(null)
    setDrawerOpen(true)
  }

  function openEditLine(index) {
    setEditingLineIndex(index)
    setDrawerOpen(true)
  }

  function handleSaveLine(lineData) {
    setLines((prev) => {
      if (editingLineIndex === null) {
        return [...prev, { ...lineData, clientId: crypto.randomUUID() }]
      }
      const next = [...prev]
      next[editingLineIndex] = { ...next[editingLineIndex], ...lineData }
      return next
    })
    setDrawerOpen(false)
  }

  function handleRemoveLine(index) {
    setLines((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSave() {
    const headerErrors = validateHeader(header)
    setErrors(headerErrors)
    if (Object.keys(headerErrors).length > 0) return
    if (lines.length === 0) {
      setSaveError({ message: 'Add at least one line before saving.' })
      return
    }

    setSaving(true)
    setSaveError(null)
    try {
      const created = await movementRequestsApi.create(header, lines)
      navigate(`/movement-requests/${created.id}`)
    } catch (err) {
      setSaveError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="New Movement Request"
        subtitle="Saved as a local draft. Nothing is sent to Oracle Fusion at this stage."
        actions={
          <Link to="/movement-requests" className="btn">
            Cancel
          </Link>
        }
      />

      <InlineError message={saveError?.message} details={saveError?.details} />

      <div className="card">
        <div className="card__header">
          <h2 className="card__title">Header</h2>
        </div>
        <div className="card__body">
          <MovementRequestHeaderForm header={header} onChange={handleHeaderChange} errors={errors} />
        </div>
      </div>

      <MovementRequestLinesTable
        lines={lines}
        onAdd={openAddLine}
        onEdit={openEditLine}
        onRemove={handleRemoveLine}
      />

      <div className="row-actions" style={{ justifyContent: 'flex-start' }}>
        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Draft'}
        </button>
        <Link to="/movement-requests" className="btn">
          Cancel
        </Link>
      </div>

      {drawerOpen ? (
        <LineEditDrawer
          organizationCode={header.inventoryOrganization}
          initialLine={editingLineIndex !== null ? lines[editingLineIndex] : null}
          headerDefaults={header}
          onSave={handleSaveLine}
          onCancel={() => setDrawerOpen(false)}
        />
      ) : null}
    </div>
  )
}
