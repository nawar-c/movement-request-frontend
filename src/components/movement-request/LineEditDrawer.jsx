import { useState } from 'react'
import { ItemSearchCombobox } from '../common/ItemSearchCombobox.jsx'
import { ReferenceSelect } from '../common/ReferenceSelect.jsx'
import {
  useUoms,
  useTransactionTypes,
  useSubinventories,
  useLocators,
  useReasons,
} from '../../hooks/useReferenceData.js'

function buildInitialForm(initialLine, headerDefaults) {
  if (initialLine) return { ...initialLine }
  return {
    itemNumber: '',
    itemDescription: '',
    requestedQuantity: '',
    uom: '',
    requiredDate: headerDefaults.requiredDate || '',
    transactionType: headerDefaults.transactionType || '',
    sourceSubinventory: headerDefaults.sourceSubinventory || '',
    sourceLocator: '',
    destinationSubinventory: headerDefaults.destinationSubinventory || '',
    destinationLocator: '',
    destinationAccount: headerDefaults.destinationAccount || '',
    requester: '',
    reason: '',
    reference: '',
    secondaryRequestedQuantity: '',
    secondaryUom: '',
    lotNumber: '',
    grade: '',
    fromSerialNumber: '',
  }
}

export function LineEditDrawer({ organizationCode, initialLine, headerDefaults, onSave, onCancel }) {
  const [form, setForm] = useState(() => buildInitialForm(initialLine, headerDefaults))
  const [errors, setErrors] = useState({})

  const uoms = useUoms()
  const transactionTypes = useTransactionTypes()
  const sourceSubinventories = useSubinventories(organizationCode)
  const sourceLocators = useLocators(organizationCode, form.sourceSubinventory)
  const destinationLocators = useLocators(organizationCode, form.destinationSubinventory)
  const reasons = useReasons()

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleItemSelect(item) {
    if (!item) {
      set('itemNumber', '')
      return
    }
    setForm((prev) => ({
      ...prev,
      itemNumber: item.itemNumber,
      itemDescription: item.description,
      uom: prev.uom || item.primaryUom,
    }))
  }

  function validate() {
    const nextErrors = {}
    if (!form.itemNumber) nextErrors.itemNumber = 'Item is required.'
    if (form.requestedQuantity === '' || form.requestedQuantity === null || Number(form.requestedQuantity) <= 0) {
      nextErrors.requestedQuantity = 'Enter a quantity greater than 0.'
    }
    if (!form.uom) nextErrors.uom = 'UOM is required.'
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  function handleSave() {
    if (!validate()) return
    onSave(form)
  }

  return (
    <div className="drawer-overlay" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="drawer">
        <div className="drawer__header">
          <h2 className="drawer__title">{initialLine ? 'Edit Line' : 'Add Line'}</h2>
          <button type="button" className="btn btn-sm" onClick={onCancel}>
            Close
          </button>
        </div>

        <div className="drawer__body">
          <div className="section-divider">Item &amp; Quantity</div>
          <div className="form-grid">
            <div className="form-field form-field--span-2">
              <label className="form-label">
                Item<span className="form-label__required">*</span>
              </label>
              <ItemSearchCombobox
                organizationCode={organizationCode}
                displayLabel={form.itemNumber ? `${form.itemNumber} - ${form.itemDescription || ''}` : ''}
                onSelect={handleItemSelect}
                hasError={Boolean(errors.itemNumber)}
              />
              {errors.itemNumber ? <div className="form-error">{errors.itemNumber}</div> : null}
            </div>

            <div className="form-field">
              <label className="form-label">Item Description</label>
              <input
                type="text"
                className="form-input"
                value={form.itemDescription || ''}
                onChange={(e) => set('itemDescription', e.target.value)}
              />
            </div>

            <div className="form-field">
              <label className="form-label">
                Requested Quantity<span className="form-label__required">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="any"
                className={`form-input${errors.requestedQuantity ? ' has-error' : ''}`}
                value={form.requestedQuantity}
                onChange={(e) => set('requestedQuantity', e.target.value)}
              />
              {errors.requestedQuantity ? <div className="form-error">{errors.requestedQuantity}</div> : null}
            </div>

            <div className="form-field">
              <label className="form-label">
                UOM<span className="form-label__required">*</span>
              </label>
              <ReferenceSelect
                options={uoms.data}
                value={form.uom}
                onChange={(v) => set('uom', v)}
                loading={uoms.loading}
                hasError={Boolean(errors.uom)}
                placeholder="Select UOM..."
              />
              {errors.uom ? <div className="form-error">{errors.uom}</div> : null}
            </div>

            <div className="form-field">
              <label className="form-label">Required Date</label>
              <input
                type="date"
                className="form-input"
                value={form.requiredDate || ''}
                onChange={(e) => set('requiredDate', e.target.value)}
              />
            </div>

            <div className="form-field">
              <label className="form-label">Transaction Type</label>
              <ReferenceSelect
                options={transactionTypes.data}
                value={form.transactionType}
                onChange={(v) => set('transactionType', v)}
                loading={transactionTypes.loading}
                placeholder="Select transaction type..."
              />
            </div>
          </div>

          <div className="section-divider">Source &amp; Destination</div>
          <div className="form-grid">
            <div className="form-field">
              <label className="form-label">Source Subinventory</label>
              <ReferenceSelect
                options={sourceSubinventories.data}
                value={form.sourceSubinventory}
                onChange={(v) => set('sourceSubinventory', v)}
                loading={sourceSubinventories.loading}
                disabled={!organizationCode}
                placeholder="Select subinventory..."
              />
            </div>
            <div className="form-field">
              <label className="form-label">Source Locator</label>
              <ReferenceSelect
                options={sourceLocators.data}
                valueKey="code"
                labelKey="code"
                value={form.sourceLocator}
                onChange={(v) => set('sourceLocator', v)}
                loading={sourceLocators.loading}
                disabled={!form.sourceSubinventory}
                placeholder="Select locator..."
              />
            </div>

            <div className="form-field">
              <label className="form-label">Destination Subinventory</label>
              <ReferenceSelect
                options={sourceSubinventories.data}
                value={form.destinationSubinventory}
                onChange={(v) => set('destinationSubinventory', v)}
                loading={sourceSubinventories.loading}
                disabled={!organizationCode}
                placeholder="Select subinventory..."
              />
            </div>
            <div className="form-field">
              <label className="form-label">Destination Locator</label>
              <ReferenceSelect
                options={destinationLocators.data}
                valueKey="code"
                labelKey="code"
                value={form.destinationLocator}
                onChange={(v) => set('destinationLocator', v)}
                loading={destinationLocators.loading}
                disabled={!form.destinationSubinventory}
                placeholder="Select locator..."
              />
            </div>

            <div className="form-field">
              <label className="form-label">Destination Account</label>
              <input
                type="text"
                className="form-input"
                value={form.destinationAccount || ''}
                onChange={(e) => set('destinationAccount', e.target.value)}
              />
            </div>
          </div>

          <div className="section-divider">Additional Details</div>
          <div className="form-grid">
            <div className="form-field">
              <label className="form-label">Requester</label>
              <input
                type="text"
                className="form-input"
                value={form.requester || ''}
                onChange={(e) => set('requester', e.target.value)}
              />
            </div>
            <div className="form-field">
              <label className="form-label">Reason</label>
              <ReferenceSelect
                options={reasons.data}
                value={form.reason}
                onChange={(v) => set('reason', v)}
                loading={reasons.loading}
                placeholder="Select reason..."
              />
            </div>
            <div className="form-field">
              <label className="form-label">Reference</label>
              <input
                type="text"
                className="form-input"
                value={form.reference || ''}
                onChange={(e) => set('reference', e.target.value)}
              />
            </div>

            <div className="form-field">
              <label className="form-label">Secondary Quantity</label>
              <input
                type="number"
                min="0"
                step="any"
                className="form-input"
                value={form.secondaryRequestedQuantity || ''}
                onChange={(e) => set('secondaryRequestedQuantity', e.target.value)}
              />
            </div>
            <div className="form-field">
              <label className="form-label">Secondary UOM</label>
              <ReferenceSelect
                options={uoms.data}
                value={form.secondaryUom}
                onChange={(v) => set('secondaryUom', v)}
                loading={uoms.loading}
                placeholder="Select UOM..."
              />
            </div>

            <div className="form-field">
              <label className="form-label">Lot Number</label>
              <input
                type="text"
                className="form-input"
                value={form.lotNumber || ''}
                onChange={(e) => set('lotNumber', e.target.value)}
              />
            </div>
            <div className="form-field">
              <label className="form-label">Grade</label>
              <input
                type="text"
                className="form-input"
                value={form.grade || ''}
                onChange={(e) => set('grade', e.target.value)}
              />
            </div>
            <div className="form-field">
              <label className="form-label">From Serial Number</label>
              <input
                type="text"
                className="form-input"
                value={form.fromSerialNumber || ''}
                onChange={(e) => set('fromSerialNumber', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="drawer__footer">
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave}>
            Save Line
          </button>
        </div>
      </div>
    </div>
  )
}
