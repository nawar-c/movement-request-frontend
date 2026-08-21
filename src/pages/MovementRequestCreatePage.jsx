import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { PageHeader } from '../components/layout/PageHeader.jsx'
import { MovementRequestHeaderForm } from '../components/movement-request/MovementRequestHeaderForm.jsx'
import { MovementRequestLinesTable } from '../components/movement-request/MovementRequestLinesTable.jsx'
import { LineEditDrawer } from '../components/movement-request/LineEditDrawer.jsx'
import { InlineError, ErrorState } from '../components/common/States.jsx'
import { movementRequestsApi } from '../api/movementRequestsApi.js'
import { validateHeader } from '../utils/validation.js'
import { buildInitialHeader, isCostCenterMissing, applyOrgChange } from '../utils/movementRequestHeader.js'
import { useAuth } from '../auth/useAuth.js'

// Exact wording matches the backend's USER_COST_CENTER_NOT_CONFIGURED message (see
// resolveCreateCostCenter in movementRequest.service.js) — this is the client-side pre-check for
// the same condition, not a different message for the same problem.
const COST_CENTER_NOT_CONFIGURED_MESSAGE = 'Your Cost Center is not configured. Please contact the administrator.'

export function MovementRequestCreatePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [header, setHeader] = useState(() => buildInitialHeader(user))
  const [lines, setLines] = useState([])
  const [errors, setErrors] = useState({})
  const [editingLineIndex, setEditingLineIndex] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  function handleHeaderChange(nextHeader) {
    // Every line field (item, destination subinventory or account) plus the header's own Source
    // Subinventory are organization-scoped, so a changed organization invalidates all existing
    // lines and clears the selected Source rather than leaving stale values.
    const { header: resolvedHeader, shouldClearLines } = applyOrgChange(header, nextHeader)
    if (shouldClearLines) setLines([])
    setHeader(resolvedHeader)
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

  // Blocks the entire create flow rather than letting the user build out lines that could never be
  // saved — the backend would reject this the same way (409 USER_COST_CENTER_NOT_CONFIGURED) but
  // failing this early, before any line work is invested, is the better UX.
  if (isCostCenterMissing(user)) {
    return (
      <div>
        <PageHeader
          title="New Movement Request"
          actions={
            <Link to="/movement-requests" className="btn">
              Back to List
            </Link>
          }
        />
        <ErrorState title="Cost Center Not Configured" message={COST_CENTER_NOT_CONFIGURED_MESSAGE} />
      </div>
    )
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
