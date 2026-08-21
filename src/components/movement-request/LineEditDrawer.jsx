import { useEffect, useState } from 'react'
import { ItemSearchCombobox } from '../common/ItemSearchCombobox.jsx'
import { ReferenceSelect } from '../common/ReferenceSelect.jsx'
import { LookupCombobox } from '../common/LookupCombobox.jsx'
import { useUoms, useDestinationSubinventories, useReasons } from '../../hooks/useReferenceData.js'
import { referenceApi } from '../../api/referenceApi.js'
import {
  ZERO_VALID_UOM_MESSAGE,
  isUomValidForItem,
  resolveUomForItem,
  reconcileHistoricalUom,
  isItemActive,
  buildItemUnavailableMessage,
  buildItemInactiveMessage,
  buildStaleUomMessage,
} from '../../utils/lineItemUom.js'

const ISSUE_TRANSACTION_TYPE_ID = 63
const TRANSFER_TRANSACTION_TYPE_ID = 64

// Phase E2: Source Subinventory and Requester are no longer line-level write fields (Source moved
// to the request header — see MovementRequestHeaderForm.jsx; Requester was removed from the
// accepted contract entirely — see serializeLineForApi and the backend's lineSchema). When editing
// an existing line, `{ ...initialLine }` still carries over whatever historical sourceSubinventory/
// requester values that line already had (read-only compatibility — they're simply never shown or
// re-sent here), so old records stay understandable without becoming editable again.
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
    destinationSubinventory: '',
    destinationAccount: '',
    destinationAccountId: '',
    destinationAccountLabel: '',
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
  // Phase E3: an item's valid UOMs come from the item itself (Oracle Primary/Secondary UOM), never
  // from the old global 528-row enterprise UOM list. Starts empty for a brand-new line; for an
  // existing historical line it's populated by the re-resolution effect below.
  const [validUoms, setValidUoms] = useState([])
  const [resolvingItem, setResolvingItem] = useState(Boolean(initialLine))
  const [itemResolutionError, setItemResolutionError] = useState(null)

  // Secondary UOM (line.secondaryUom / line.secondaryRequestedQuantity) is Oracle's own separate
  // dual-quantity-tracking payload concept (SecondaryUOMCode/SecondaryRequestedQuantity) — not yet
  // mapped to Oracle at all (see OracleFusionService.js's buildOraclePayload field-mapping table),
  // and not "another representation of the primary UOM field". Confirmed via Phase E3 final-review
  // investigation; reverted to its pre-E3 behavior (the global UOM list) rather than validUoms.
  const uoms = useUoms()
  const destinationSubinventories = useDestinationSubinventories(organizationCode)
  const reasons = useReasons()

  const isIssue = form.transactionTypeId === ISSUE_TRANSACTION_TYPE_ID
  const isTransfer = form.transactionTypeId === TRANSFER_TRANSACTION_TYPE_ID

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  // An existing line's item must be re-resolved against CURRENT item reference data — Oracle's item
  // status and valid-UOM set can both change after a draft line was originally saved. Runs once on
  // mount, only for an existing line (a brand-new line has nothing to re-resolve).
  useEffect(() => {
    if (!initialLine) return
    let cancelled = false
    setResolvingItem(true)
    referenceApi
      .searchItems(organizationCode, initialLine.itemNumber)
      .then((results) => {
        if (cancelled) return
        const match = results.find((r) => r.itemNumber === initialLine.itemNumber)
        if (!match) {
          setItemResolutionError(buildItemUnavailableMessage(initialLine.itemNumber))
          setValidUoms([])
          return
        }
        if (!isItemActive(match)) {
          setItemResolutionError(buildItemInactiveMessage(initialLine.itemNumber))
          setValidUoms([])
          return
        }
        const nextValidUoms = match.validUoms || []
        setValidUoms(nextValidUoms)
        const { uom, invalid } = reconcileHistoricalUom(initialLine.uom, nextValidUoms)
        setForm((prev) => ({
          ...prev,
          itemDescription: match.description,
          transactionType: match.transactionType || null,
          transactionTypeId: match.transactionTypeId || null,
          itemChargeableFlag: match.chargeableFlag || null,
          uom,
        }))
        if (invalid) {
          setErrors((prev) => ({ ...prev, uom: buildStaleUomMessage(initialLine.uom, nextValidUoms) }))
        }
      })
      .catch(() => {
        if (!cancelled) setItemResolutionError('Unable to verify this item right now. Please try again.')
      })
      .finally(() => {
        if (!cancelled) setResolvingItem(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleItemSelect(item) {
    if (!item) {
      setForm((prev) => ({
        ...prev,
        itemNumber: '',
        itemDescription: '',
        uom: '',
        transactionType: null,
        transactionTypeId: null,
        itemChargeableFlag: null,
      }))
      setValidUoms([])
      setItemResolutionError(null)
      setErrors((prev) => {
        const next = { ...prev }
        delete next.uom
        return next
      })
      return
    }

    setItemResolutionError(null)

    if (!isItemActive(item)) {
      setForm((prev) => ({ ...prev, itemNumber: item.itemNumber, itemDescription: item.description, uom: '' }))
      setValidUoms([])
      setItemResolutionError(buildItemInactiveMessage(item.itemNumber))
      return
    }

    // Do NOT trust stale values from the previously selected item — every field below is rebuilt
    // entirely from this item's own Oracle-returned data, including clearing the UOM first before
    // re-deriving it purely from this item's validUoms (never carried over from the old item).
    const nextValidUoms = item.validUoms || []
    setValidUoms(nextValidUoms)
    setForm((prev) => ({
      ...prev,
      itemNumber: item.itemNumber,
      itemDescription: item.description,
      uom: resolveUomForItem(nextValidUoms),
      transactionType: item.transactionType || null,
      transactionTypeId: item.transactionTypeId || null,
      itemChargeableFlag: item.chargeableFlag || null,
      // Destination fields belong to a specific transaction type — clear whichever no longer applies.
      destinationSubinventory: item.transactionTypeId === TRANSFER_TRANSACTION_TYPE_ID ? prev.destinationSubinventory : '',
      destinationAccount: item.transactionTypeId === ISSUE_TRANSACTION_TYPE_ID ? prev.destinationAccount : '',
      destinationAccountId: item.transactionTypeId === ISSUE_TRANSACTION_TYPE_ID ? prev.destinationAccountId : '',
      destinationAccountLabel: item.transactionTypeId === ISSUE_TRANSACTION_TYPE_ID ? prev.destinationAccountLabel : '',
    }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next.uom
      delete next.itemNumber
      return next
    })
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
    if (itemResolutionError) nextErrors.itemNumber = itemResolutionError
    if (form.requestedQuantity === '' || form.requestedQuantity === null || Number(form.requestedQuantity) <= 0) {
      nextErrors.requestedQuantity = 'Enter a quantity greater than 0.'
    }
    // Phase E3: UOM is validated against this item's own validUoms, never a global UOM list — the
    // same rule the backend authoritatively enforces (resolveAndValidateLines).
    if (form.itemNumber && !itemResolutionError && validUoms.length === 0) {
      nextErrors.uom = ZERO_VALID_UOM_MESSAGE
    } else if (!form.uom) {
      nextErrors.uom = 'UOM is required.'
    } else if (!isUomValidForItem(form.uom, validUoms)) {
      nextErrors.uom = `"${form.uom}" is not a valid UOM for this item.`
    }
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
    if (resolvingItem) return
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
              {resolvingItem ? (
                <input type="text" className="form-input" value="Verifying item..." disabled readOnly />
              ) : validUoms.length === 1 ? (
                // Exactly one valid Oracle UOM for this item — auto-selected, shown read-only, never
                // a dropdown with a single option the user could second-guess.
                <input type="text" className="form-input" value={form.uom} disabled readOnly />
              ) : validUoms.length > 1 ? (
                // Options come ONLY from this item's own validUoms — never the old global UOM list.
                <ReferenceSelect
                  options={validUoms}
                  valueKey="uomCode"
                  labelKey="uomCode"
                  value={form.uom}
                  onChange={(v) => set('uom', v)}
                  hasError={Boolean(errors.uom)}
                  placeholder="Select UOM..."
                />
              ) : (
                <input type="text" className="form-input" value="" disabled readOnly />
              )}
              {!resolvingItem && form.itemNumber && !itemResolutionError && validUoms.length === 0 ? (
                <div className="form-error">{ZERO_VALID_UOM_MESSAGE}</div>
              ) : errors.uom ? (
                <div className="form-error">{errors.uom}</div>
              ) : null}
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
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={resolvingItem}>
            {resolvingItem ? 'Verifying item...' : 'Save Line'}
          </button>
        </div>
      </div>
    </div>
  )
}
