import { useState } from 'react'
import { ReferenceSelect } from '../common/ReferenceSelect.jsx'
import { InlineError, InlineNotice } from '../common/States.jsx'
import { adminSyncApi } from '../../api/adminSyncApi.js'

const ITEM_ORGANIZATIONS = [
  { code: 'GENERAL', name: 'GENERAL' },
  { code: 'MEDICAL_CONSUMABLE', name: 'MEDICAL_CONSUMABLE' },
  { code: 'DRUG', name: 'DRUG' },
]

export function ItemRefreshCard({ disabled, onRefreshed }) {
  const [organizationCode, setOrganizationCode] = useState(null)
  const [itemNumber, setItemNumber] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [validationError, setValidationError] = useState(null)
  const [lastResult, setLastResult] = useState(null)

  async function handleRefresh() {
    if (!organizationCode || !itemNumber.trim()) {
      setValidationError('Select an organization and enter an item number.')
      return
    }
    setValidationError(null)
    setError(null)
    setLastResult(null)
    setBusy(true)
    try {
      const data = await adminSyncApi.refreshItem({ organizationCode, itemNumber: itemNumber.trim() })
      setLastResult(data)
      onRefreshed?.()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <div className="card__header">
        <h2 className="card__title">Item Refresh</h2>
      </div>
      <div className="card__body">
        <p className="text-muted" style={{ marginTop: 0 }}>
          Items are refreshed individually by item number — there is no bulk sync for items.
        </p>

        <div className="form-grid">
          <div className="form-field">
            <label className="form-label">Organization</label>
            <ReferenceSelect
              options={ITEM_ORGANIZATIONS}
              value={organizationCode}
              onChange={setOrganizationCode}
              disabled={disabled || busy}
              placeholder="Select organization..."
            />
          </div>
          <div className="form-field">
            <label className="form-label">Item Number</label>
            <input
              type="text"
              className="form-input"
              value={itemNumber}
              disabled={disabled || busy}
              onChange={(e) => setItemNumber(e.target.value)}
            />
          </div>
        </div>

        {validationError ? <div className="form-error" style={{ marginTop: 8 }}>{validationError}</div> : null}
        <InlineError message={error?.message} />
        {lastResult ? (
          <InlineNotice>
            Refreshed {itemNumber} in {organizationCode}.
            {typeof lastResult.recordsUpserted === 'number' ? ` ${lastResult.recordsUpserted} record(s) upserted.` : ''}
          </InlineNotice>
        ) : null}

        <div style={{ marginTop: 14 }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={handleRefresh} disabled={disabled || busy}>
            {busy ? 'Refreshing...' : 'Refresh Item'}
          </button>
        </div>
      </div>
    </div>
  )
}
