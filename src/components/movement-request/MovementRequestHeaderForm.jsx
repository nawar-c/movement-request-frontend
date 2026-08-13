import { ReferenceSelect } from '../common/ReferenceSelect.jsx'
import { LookupCombobox } from '../common/LookupCombobox.jsx'
import { referenceApi } from '../../api/referenceApi.js'
import { useOrganizations } from '../../hooks/useReferenceData.js'

export function MovementRequestHeaderForm({ header, onChange, errors = {}, disabled }) {
  // TODO(security): once user-based organization restrictions ship, this should consume an
  // already-filtered "allowed organizations" list from the backend instead of the full set —
  // no client-side filtering logic should be added here to simulate that in the meantime.
  const organizations = useOrganizations()

  function set(field, value) {
    onChange({ ...header, [field]: value })
  }

  function handleCostCenterSelect(costCenter) {
    onChange({
      ...header,
      costCenter: costCenter ? costCenter.code : null,
      costCenterLabel: costCenter ? `${costCenter.code} — ${costCenter.name}` : '',
    })
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
          Cost Center<span className="form-label__required">*</span>
        </label>
        <LookupCombobox
          displayLabel={header.costCenterLabel}
          onSearch={async (term) => ({ items: await referenceApi.searchCostCenters(term), hasMore: false })}
          onSelect={handleCostCenterSelect}
          renderOption={(cc) => (
            <>
              <span className="combobox__option-primary">{cc.code}</span>
              <span className="combobox__option-secondary">{cc.name}</span>
            </>
          )}
          getOptionKey={(cc) => cc.code}
          placeholder="Search cost center by code or name..."
          disabled={disabled}
          hasError={Boolean(errors.costCenter)}
        />
        {errors.costCenter ? <div className="form-error">{errors.costCenter}</div> : null}
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
