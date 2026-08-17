import { useState } from 'react'
import { ItemSearchCombobox } from '../common/ItemSearchCombobox.jsx'
import { ReferenceSelect } from '../common/ReferenceSelect.jsx'
import { LookupCombobox } from '../common/LookupCombobox.jsx'
import { useUoms, useSubinventories, useDestinationSubinventories, useReasons } from '../../hooks/useReferenceData.js'
import { referenceApi } from '../../api/referenceApi.js'

const ISSUE_TRANSACTION_TYPE_ID = 63
const TRANSFER_TRANSACTION_TYPE_ID = 64

function buildInitialForm(initialLine, headerDefaults) {
  if (initialLine) return { ...initialLine }
  return {
    itemNumber: '',
    itemDescription: '',
    transactionType: null,
    transactionTypeId: null,
    itemChargeableFlag: null,
    requestedQuantity: '',
    uom: '',
    requiredDate: headerDefaults.requiredDate || '',
    sourceSubinventory: '',
    destinationSubinventory: '',
    destinationAccount: '',
    destinationAccountId: '',
    destinationAccountLabel: '',
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
  const subinventories = useSubinventories(organizationCode)
  const destinationSubinventories = useDestinationSubinventories(organizationCode)
  const reasons = useReasons()

  const sourceSubinventoryOptions = subinventories.data.filter((s) => s.isSource)
  const isIssue = form.transactionTypeId === ISSUE_TRANSACTION_TYPE_ID
  const isTransfer = form.transactionTypeId === TRANSFER_TRANSACTION_TYPE_ID

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleItemSelect(item) {
    if (!item) {
      setForm((prev) => ({
        ...prev,
        itemNumber: '',
        transactionType: null,
        transactionTypeId: null,
        itemChargeableFlag: null,
      }))
      return
    }
    setForm((prev) => ({
      ...prev,
      itemNumber: item.itemNumber,
      itemDescription: item.description,
      uom: prev.uom || item.primaryUom,
      transactionType: item.transactionType || null,
      transactionTypeId: item.transactionTypeId || null,
      itemChargeableFlag: item.chargeableFlag || null,
      // Destination fields belong to a specific transaction type — clear whichever no longer applies.
      destinationSubinventory: item.transactionTypeId === TRANSFER_TRANSACTION_TYPE_ID ? prev.destinationSubinventory : '',
      destinationAccount: item.transactionTypeId === ISSUE_TRANSACTION_TYPE_ID ? prev.destinationAccount : '',
      destinationAccountId: item.transactionTypeId === ISSUE_TRANSACTION_TYPE_ID ? prev.destinationAccountId : '',
      destinationAccountLabel: item.transactionTypeId === ISSUE_TRANSACTION_TYPE_ID ? prev.destinationAccountLabel : '',
    }))
  }

  function handleDestinationAccountSelect(account) {
    setForm((prev) => ({
      ...prev,
      destinationAccountId: account ? account.oracleCodeCombinationId : '',
      destinationAccount: account ? account.combinationCode : '',
      destinationAccountLabel: account ? account.combinationCode : '',
    }))
  }

  // Destination accounts are not organization-scoped on the backend and the full set (~7,771 rows)
  // is searched and paginated server-side — never fetched or filtered client-side.
  function searchDestinationAccounts(term, { offset } = {}) {
    return referenceApi.searchDestinationAccounts(term, { offset })
  }

  function validate() {
    const nextErrors = {}
    if (!form.itemNumber) nextErrors.itemNumber = 'Item is required.'
    if (form.requestedQuantity === '' || form.requestedQuantity === null || Number(form.requestedQuantity) <= 0) {
      nextErrors.requestedQuantity = 'Enter a quantity greater than 0.'
    }
    if (!form.uom) nextErrors.uom = 'UOM is required.'
    if (!form.sourceSubinventory) nextErrors.sourceSubinventory = 'Source Subinventory is required.'
    if (form.itemNumber && !form.transactionTypeId) {
      nextErrors.itemNumber = 'This item has no derived transaction type. Try re-selecting it.'
    }
    if (isIssue && !form.destinationAccountId) {
      nextErrors.destinationAccount = 'Destination Account is required for Issue lines.'
    }
    if (isTransfer && !form.destinationSubinventory) {
      nextErrors.destinationSubinventory = 'Destination Subinventory is required for Transfer lines.'
    }
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
              <input type="text" className="form-input" value={form.itemDescription || ''} disabled readOnly />
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
              <input
                type="text"
                className="form-input"
                value={form.transactionType || (form.itemNumber ? 'Not determined' : '')}
                disabled
                readOnly
                title="Determined automatically by Oracle Fusion from the selected item and organization."
              />
            </div>
          </div>

          <div className="section-divider">Source &amp; Destination</div>
          <div className="form-grid">
            <div className="form-field">
              <label className="form-label">
                Source Subinventory<span className="form-label__required">*</span>
              </label>
              <ReferenceSelect
                options={sourceSubinventoryOptions}
                value={form.sourceSubinventory}
                onChange={(v) => set('sourceSubinventory', v)}
                loading={subinventories.loading}
                disabled={!organizationCode}
                hasError={Boolean(errors.sourceSubinventory)}
                placeholder="Select subinventory..."
              />
              {errors.sourceSubinventory ? <div className="form-error">{errors.sourceSubinventory}</div> : null}
            </div>

            {isTransfer ? (
              <div className="form-field">
                <label className="form-label">
                  Destination Subinventory<span className="form-label__required">*</span>
                </label>
                <ReferenceSelect
                  options={destinationSubinventories.data}
                  value={form.destinationSubinventory}
                  onChange={(v) => set('destinationSubinventory', v)}
                  loading={destinationSubinventories.loading}
                  disabled={!organizationCode}
                  hasError={Boolean(errors.destinationSubinventory)}
                  placeholder="Select subinventory..."
                />
                {organizationCode && !destinationSubinventories.loading && destinationSubinventories.data.length === 0 ? (
                  <div className="form-hint">No destination subinventories assigned for this organization.</div>
                ) : null}
                {errors.destinationSubinventory ? (
                  <div className="form-error">{errors.destinationSubinventory}</div>
                ) : null}
              </div>
            ) : isIssue ? (
              <div className="form-field">
                <label className="form-label">
                  Destination Account<span className="form-label__required">*</span>
                </label>
                <LookupCombobox
                  displayLabel={form.destinationAccountLabel}
                  onSearch={searchDestinationAccounts}
                  onSelect={handleDestinationAccountSelect}
                  renderOption={(a) => (
                    <>
                      <span className="combobox__option-primary">{a.combinationCode}</span>
                      {a.description && a.description !== a.combinationCode ? (
                        <span className="combobox__option-secondary">{a.description}</span>
                      ) : null}
                    </>
                  )}
                  getOptionKey={(a) => a.id}
                  placeholder="Search destination account..."
                  hasError={Boolean(errors.destinationAccount)}
                />
                {errors.destinationAccount ? <div className="form-error">{errors.destinationAccount}</div> : null}
              </div>
            ) : (
              <div className="form-field">
                <label className="form-label">Destination</label>
                <div className="form-hint">Select an item to determine whether a destination account or subinventory is needed.</div>
              </div>
            )}
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
