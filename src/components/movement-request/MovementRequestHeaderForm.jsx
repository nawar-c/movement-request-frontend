import { ReferenceSelect } from '../common/ReferenceSelect.jsx'
import {
  useOrganizations,
  useTransactionTypes,
  useSubinventories,
  useCostCenters,
} from '../../hooks/useReferenceData.js'

const MOVEMENT_REQUEST_TYPES = [{ code: 'Requisition', name: 'Requisition' }]

export function MovementRequestHeaderForm({ header, onChange, errors = {}, disabled }) {
  const organizations = useOrganizations()
  const transactionTypes = useTransactionTypes()
  const subinventories = useSubinventories(header.inventoryOrganization)
  const costCenters = useCostCenters()

  function set(field, value) {
    onChange({ ...header, [field]: value })
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
        <label className="form-label">Movement Request Type</label>
        <ReferenceSelect
          options={MOVEMENT_REQUEST_TYPES}
          valueKey="code"
          labelKey="name"
          value={header.movementRequestType || 'Requisition'}
          onChange={(value) => set('movementRequestType', value)}
          disabled={disabled}
          placeholder="Select type..."
        />
      </div>

      <div className="form-field">
        <label className="form-label">
          Transaction Type<span className="form-label__required">*</span>
        </label>
        <ReferenceSelect
          options={transactionTypes.data}
          valueKey="code"
          labelKey="name"
          value={header.transactionType}
          onChange={(value) => set('transactionType', value)}
          loading={transactionTypes.loading}
          disabled={disabled}
          hasError={Boolean(errors.transactionType)}
          placeholder="Select transaction type..."
        />
        {errors.transactionType ? <div className="form-error">{errors.transactionType}</div> : null}
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
        <label className="form-label">Source Subinventory</label>
        <ReferenceSelect
          options={subinventories.data}
          valueKey="code"
          labelKey="name"
          value={header.sourceSubinventory}
          onChange={(value) => set('sourceSubinventory', value)}
          loading={subinventories.loading}
          disabled={disabled || !header.inventoryOrganization}
          placeholder="Select subinventory..."
        />
      </div>

      <div className="form-field">
        <label className="form-label">Destination Subinventory</label>
        <ReferenceSelect
          options={subinventories.data}
          valueKey="code"
          labelKey="name"
          value={header.destinationSubinventory}
          onChange={(value) => set('destinationSubinventory', value)}
          loading={subinventories.loading}
          disabled={disabled || !header.inventoryOrganization}
          placeholder="Select subinventory..."
        />
      </div>

      <div className="form-field">
        <label className="form-label">Destination Account</label>
        <input
          type="text"
          className="form-input"
          value={header.destinationAccount || ''}
          disabled={disabled}
          onChange={(e) => set('destinationAccount', e.target.value)}
        />
      </div>

      <div className="form-field">
        <label className="form-label">Cost Center</label>
        <ReferenceSelect
          options={costCenters.data}
          valueKey="code"
          labelKey="name"
          value={header.costCenter}
          onChange={(value) => set('costCenter', value)}
          loading={costCenters.loading}
          disabled={disabled}
          placeholder="Select cost center..."
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
