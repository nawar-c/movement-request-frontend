import { ReferenceSelect } from '../common/ReferenceSelect.jsx'
import { useOrganizations, useSubinventories } from '../../hooks/useReferenceData.js'

export function MovementRequestHeaderForm({ header, onChange, errors = {}, disabled }) {
  // TODO(security): once user-based organization restrictions ship, this should consume an
  // already-filtered "allowed organizations" list from the backend instead of the full set —
  // no client-side filtering logic should be added here to simulate that in the meantime.
  const organizations = useOrganizations()
  // Phase E2: Source Subinventory moved here from the line level — one Movement Request, one
  // Source, selected once against the chosen Inventory Organization's approved source list.
  const subinventories = useSubinventories(header.inventoryOrganization)
  const sourceOptions = subinventories.data.filter((s) => s.isSource)

  function set(field, value) {
    onChange({ ...header, [field]: value })
  }

  function setSourceSubinventory(value) {
    // An explicit user selection resolves the historical-conflict state — the hint has done its
    // job once the user has picked one Source, and must not keep showing after that.
    onChange({ ...header, sourceSubinventory: value, sourceSubinventoryConflict: false })
  }

  return (
    <div className="form-grid">
      <div className="form-field">
        <label className="form-label">
          Inventory Organization<span className="form-label__required">*</span>
        </label>
        <ReferenceSelect
          options={organizations.data}
          valueKey="code"
          labelKey="name"
          value={header.inventoryOrganization}
          onChange={(value) => set('inventoryOrganization', value)}
          loading={organizations.loading}
          disabled={disabled}
          hasError={Boolean(errors.inventoryOrganization)}
          placeholder="Select organization..."
        />
        {errors.inventoryOrganization ? <div className="form-error">{errors.inventoryOrganization}</div> : null}
      </div>

      <div className="form-field">
        <label className="form-label">
          Required Date<span className="form-label__required">*</span>
        </label>
        <input
          type="date"
          className={`form-input${errors.requiredDate ? ' has-error' : ''}`}
          value={header.requiredDate || ''}
          disabled={disabled}
          onChange={(e) => set('requiredDate', e.target.value)}
        />
        {errors.requiredDate ? <div className="form-error">{errors.requiredDate}</div> : null}
      </div>

      <div className="form-field">
        <label className="form-label">
          Source Subinventory<span className="form-label__required">*</span>
        </label>
        <ReferenceSelect
          options={sourceOptions}
          value={header.sourceSubinventory}
          onChange={setSourceSubinventory}
          loading={subinventories.loading}
          disabled={disabled || !header.inventoryOrganization}
          hasError={Boolean(errors.sourceSubinventory)}
          placeholder="Select source subinventory..."
        />
        {errors.sourceSubinventory ? <div className="form-error">{errors.sourceSubinventory}</div> : null}
        {header.sourceSubinventoryConflict ? (
          <div className="form-hint">
            Existing lines use different Source Subinventories. Select one Source Subinventory before saving.
          </div>
        ) : null}
      </div>

      <div className="form-field">
        <label className="form-label">Cost Center</label>
        <input
          type="text"
          className="form-input"
          value={header.costCenter || ''}
          disabled
          readOnly
          title="Cost Center comes from your configured profile and cannot be changed here."
        />
      </div>

      <div className="form-field form-field--span-3">
        <label className="form-label">Description</label>
        <textarea
          className="form-textarea"
          rows={2}
          value={header.description || ''}
          disabled={disabled}
          onChange={(e) => set('description', e.target.value)}
        />
      </div>
    </div>
  )
}
