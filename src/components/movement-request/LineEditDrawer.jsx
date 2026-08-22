import { useEffect, useState } from 'react'
import { ItemSearchCombobox } from '../common/ItemSearchCombobox.jsx'
import { ReferenceSelect } from '../common/ReferenceSelect.jsx'
import { useUoms, useDestinationSubinventories, useReasons, useOrganizationDefaultAccount } from '../../hooks/useReferenceData.js'
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
import { DEFAULT_ACCOUNT_NOT_CONFIGURED_MESSAGE, resolveDestinationAccountDisplay } from '../../utils/lineDestinationAccount.js'

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
  // Phase E4 final review: counts how many times the user has (re-)picked an item via
  // handleItemSelect this session — 0 means "still whatever initialLine loaded with, never
  // touched". Used to decide whether the Destination Account shown/sent for an Issue line should
  // be the line's own preserved historical snapshot (untouched) or the freshly resolved
  // organization default (touched) — see the effect and accountDisplay below.
  const [selectionVersion, setSelectionVersion] = useState(0)

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

  // Phase E4: Issue-line Destination Account is read-only, resolved from the organization's
  // configured default via the USER-safe reference endpoint — never manually entered. Only fetched
  // for an Issue line; a Transfer (or not-yet-determined) line skips the request entirely.
  const defaultAccount = useOrganizationDefaultAccount(isIssue ? organizationCode : null)

  // Phase E4 final review: an untouched historical Issue line (selectionVersion === 0) keeps its
  // own preserved snapshot as the source of truth for display — NOT the live lookup, which may
  // differ if an admin changed the organization's configured default since this line was created,
  // or may even be "not configured" if that default was later removed entirely. Only a freshly
  // (re-)selected item (selectionVersion > 0) shows/adopts the live resolution. Either way this
  // reuses the same resolveDestinationAccountDisplay shape ({ destinationAccount, combinationCode }).
  const isUntouchedHistoricalAccount = selectionVersion === 0 && Boolean(form.destinationAccountId || form.destinationAccount)
  const accountDisplay = resolveDestinationAccountDisplay(
    isUntouchedHistoricalAccount
      ? { destinationAccount: form.destinationAccountId, combinationCode: form.destinationAccount }
      : defaultAccount.data,
  )

  // Applies the freshly resolved organization default onto the line's own write state — but only
  // after a real (re-)selection this session (selectionVersion > 0). A historical line that hasn't
  // been touched never has its preserved destinationAccountId/destinationAccount overwritten just
  // because the drawer happened to re-fetch the organization's current default in the background.
  useEffect(() => {
    if (!isIssue || selectionVersion === 0) return
    if (defaultAccount.loading || !defaultAccount.data) return
    setForm((prev) => ({
      ...prev,
      destinationAccountId: defaultAccount.data.destinationAccount,
      destinationAccount: defaultAccount.data.combinationCode || defaultAccount.data.destinationAccount,
    }))
  }, [isIssue, selectionVersion, defaultAccount.loading, defaultAccount.data])

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
        destinationAccount: '',
        destinationAccountId: '',
      }))
      setValidUoms([])
      setItemResolutionError(null)
      setSelectionVersion((v) => v + 1)
      setErrors((prev) => {
        const next = { ...prev }
        delete next.uom
        return next
      })
      return
    }

    setItemResolutionError(null)

    if (!isItemActive(item)) {
      setForm((prev) => ({
        ...prev,
        itemNumber: item.itemNumber,
        itemDescription: item.description,
        uom: '',
        destinationAccount: '',
        destinationAccountId: '',
      }))
      setValidUoms([])
      setItemResolutionError(buildItemInactiveMessage(item.itemNumber))
      setSelectionVersion((v) => v + 1)
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
      // Destination Subinventory belongs to Transfer lines only. Destination Account belongs to
      // Issue lines only and is never carried over from a prior item — when the newly selected item
      // IS Issue, the sync effect above fills it in from the resolved organization default once
      // that fetch completes (selectionVersion, bumped below, is what makes that effect apply).
      destinationSubinventory: item.transactionTypeId === TRANSFER_TRANSACTION_TYPE_ID ? prev.destinationSubinventory : '',
      destinationAccount: item.transactionTypeId === ISSUE_TRANSACTION_TYPE_ID ? prev.destinationAccount : '',
      destinationAccountId: item.transactionTypeId === ISSUE_TRANSACTION_TYPE_ID ? prev.destinationAccountId : '',
    }))
    setSelectionVersion((v) => v + 1)
    setErrors((prev) => {
      const next = { ...prev }
      delete next.uom
      delete next.itemNumber
      return next
    })
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
    // Phase E4: Destination Account is never user-entered for Issue lines. An untouched historical
    // line keeps its own preserved snapshot (never blocked by today's live lookup — see
    // isUntouchedHistoricalAccount above); a freshly (re-)selected item must resolve successfully
    // from the organization's configured default before the line can be saved at all.
    if (isIssue && !isUntouchedHistoricalAccount) {
      if (defaultAccount.notConfigured) {
        nextErrors.destinationAccount = DEFAULT_ACCOUNT_NOT_CONFIGURED_MESSAGE
      } else if (defaultAccount.error) {
        nextErrors.destinationAccount = 'Unable to verify the configured Destination Account right now. Please try again.'
      } else if (!defaultAccount.data) {
        nextErrors.destinationAccount = 'Destination Account is still being verified. Please wait.'
      }
    }
    if (isTransfer && !form.destinationSubinventory) {
      nextErrors.destinationSubinventory = 'Destination Subinventory is required for Transfer lines.'
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  function handleSave() {
    if (resolvingItem) return
    if (isIssue && !isUntouchedHistoricalAccount && defaultAccount.loading) return
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
          <div className="form-grid form-grid--drawer">
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
          <div className="form-grid form-grid--drawer">
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
              <div className="form-field form-field--span-2">
                <label className="form-label">
                  Destination Account<span className="form-label__required">*</span>
                </label>
                <input
                  type="text"
                  className={`form-input${errors.destinationAccount ? ' has-error' : ''}`}
                  value={
                    !isUntouchedHistoricalAccount && defaultAccount.loading
                      ? 'Loading configured account...'
                      : accountDisplay.primary
                  }
                  disabled
                  readOnly
                  title="Resolved automatically from the Inventory Organization's configured default Destination Account — cannot be changed here."
                />
                {(isUntouchedHistoricalAccount || !defaultAccount.loading) && accountDisplay.secondaryCcid ? (
                  <div className="form-hint">CCID: {accountDisplay.secondaryCcid}</div>
                ) : null}
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
          <div className="form-grid form-grid--drawer">
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
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={resolvingItem || (isIssue && !isUntouchedHistoricalAccount && defaultAccount.loading)}
          >
            {resolvingItem || (isIssue && !isUntouchedHistoricalAccount && defaultAccount.loading) ? 'Verifying...' : 'Save Line'}
          </button>
        </div>
      </div>
    </div>
  )
}
