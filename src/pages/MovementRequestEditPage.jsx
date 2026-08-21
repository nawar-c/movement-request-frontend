import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link, Navigate } from 'react-router-dom'
import { PageHeader } from '../components/layout/PageHeader.jsx'
import { MovementRequestHeaderForm } from '../components/movement-request/MovementRequestHeaderForm.jsx'
import { MovementRequestLinesTable } from '../components/movement-request/MovementRequestLinesTable.jsx'
import { LineEditDrawer } from '../components/movement-request/LineEditDrawer.jsx'
import { LoadingState, ErrorState, InlineError } from '../components/common/States.jsx'
import { useMovementRequest } from '../hooks/useMovementRequest.js'
import { movementRequestsApi } from '../api/movementRequestsApi.js'
import { validateHeader } from '../utils/validation.js'
import {
  toEditHeaderFormState as toHeaderFormState,
  toEditLineFormState as toLineFormState,
  applyOrgChange,
} from '../utils/movementRequestHeader.js'

export function MovementRequestEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: mr, loading, error } = useMovementRequest(id)

  const [header, setHeader] = useState(null)
  const [lines, setLines] = useState(null)
  const [errors, setErrors] = useState({})
  const [editingLineIndex, setEditingLineIndex] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  useEffect(() => {
    if (mr) {
      setHeader(toHeaderFormState(mr))
      setLines(mr.lines.map(toLineFormState))
    }
  }, [mr])

  if (loading) return <LoadingState label="Loading movement request..." />
  if (error) return <ErrorState message={error.message} />
  if (!mr || !header || !lines) return null

  if (mr.localStatus !== 'DRAFT') {
    return (
      <Navigate
        to={`/movement-requests/${id}`}
        replace
        state={{
          notice: `This request is currently "${mr.localStatus.replace(/_/g, ' ')}" and can no longer be edited.`,
        }}
      />
    )
  }

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
      await movementRequestsApi.update(id, header, lines)
      navigate(`/movement-requests/${id}`)
    } catch (err) {
      setSaveError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={`Edit ${mr.internalDraftNumber}`}
        subtitle="Draft changes are saved locally and are not sent to Oracle Fusion at this stage."
        actions={
          <Link to={`/movement-requests/${id}`} className="btn">
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

      <div className="row-actions mr-form-actions" style={{ justifyContent: 'flex-start' }}>
        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        <Link to={`/movement-requests/${id}`} className="btn">
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
