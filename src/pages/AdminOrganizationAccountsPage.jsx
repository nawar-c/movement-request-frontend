import { useEffect, useState } from 'react'
import { PageHeader } from '../components/layout/PageHeader.jsx'
import { Modal } from '../components/common/Modal.jsx'
import { LookupCombobox } from '../components/common/LookupCombobox.jsx'
import { LoadingState, ErrorState, InlineError } from '../components/common/States.jsx'
import { adminOrganizationAccountsApi } from '../api/adminOrganizationAccountsApi.js'
import { referenceApi } from '../api/referenceApi.js'
import { useOrganizations } from '../hooks/useReferenceData.js'
import { formatDateTime } from '../utils/formatters.js'

const modalFooterStyle = { padding: '20px 0 0', borderTop: 'none' }

export function AdminOrganizationAccountsPage() {
  const organizations = useOrganizations()
  const [configs, setConfigs] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [editOrg, setEditOrg] = useState(null)

  function load() {
    setLoading(true)
    setLoadError(null)
    adminOrganizationAccountsApi
      .list()
      .then((data) => setConfigs(Array.isArray(data) ? data : data.items || []))
      .catch((err) => setLoadError(err))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  if (organizations.loading || loading) return <LoadingState label="Loading organization configuration..." />
  if (loadError) return <ErrorState message={loadError.message} onRetry={load} />

  const configByOrg = Object.fromEntries(configs.map((c) => [c.organizationCode, c]))

  return (
    <div>
      <PageHeader
        title="Organization Default Accounts"
        subtitle="The default Destination Account Oracle Fusion uses for Issue-type Movement Request lines, per Inventory Organization."
      />

      <div className="card">
        <div className="card__body" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Default Destination Account</th>
                  <th>Status</th>
                  <th>Last Updated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {organizations.data.map((org) => {
                  const config = configByOrg[org.code]
                  return (
                    <tr key={org.code}>
                      <td>{org.name || org.code}</td>
                      <td>
                        {config ? (
                          config.destinationAccount
                        ) : (
                          <span className="text-faint">Not configured</span>
                        )}
                      </td>
                      <td>
                        {config ? (
                          <span
                            className={`status-badge ${config.enabled ? 'status-badge--ready' : 'status-badge--muted'}`}
                          >
                            {config.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </td>
                      <td className="text-muted">{config ? formatDateTime(config.updatedAt) : '—'}</td>
                      <td>
                        <button type="button" className="btn btn-sm" onClick={() => setEditOrg(org)}>
                          {config ? 'Edit' : 'Set'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editOrg ? (
        <SetDefaultAccountModal
          organization={editOrg}
          config={configByOrg[editOrg.code]}
          onClose={() => setEditOrg(null)}
          onSaved={() => {
            setEditOrg(null)
            load()
          }}
        />
      ) : null}
    </div>
  )
}

function SetDefaultAccountModal({ organization, config, onClose, onSaved }) {
  // The stored config only carries the Oracle CCID, not its combinationCode label — same limitation
  // as the MR header's Cost Center (see MovementRequestEditPage.jsx toHeaderFormState). Show the raw
  // CCID until the admin searches again, rather than fetching/inventing a label.
  const [destinationAccountId, setDestinationAccountId] = useState(config?.destinationAccount || '')
  const [destinationAccountLabel, setDestinationAccountLabel] = useState(config?.destinationAccount || '')
  const [enabled, setEnabled] = useState(config ? config.enabled : true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [fieldError, setFieldError] = useState(null)

  // Destination accounts are not organization-scoped on the backend and the full set (~7,771 rows)
  // is searched and paginated server-side — same pattern as the Movement Request line's Destination
  // Account picker, never fetched or filtered client-side.
  function searchDestinationAccounts(term, { offset } = {}) {
    return referenceApi.searchDestinationAccounts(term, { offset })
  }

  function handleSelect(account) {
    setDestinationAccountId(account ? account.oracleCodeCombinationId : '')
    setDestinationAccountLabel(account ? account.combinationCode : '')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!destinationAccountId) {
      setFieldError('Select a destination account.')
      return
    }
    setFieldError(null)
    setSubmitting(true)
    setError(null)
    try {
      await adminOrganizationAccountsApi.upsert(organization.code, {
        destinationAccount: destinationAccountId,
        enabled,
      })
      onSaved()
    } catch (err) {
      setError(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={`Default Destination Account — ${organization.name || organization.code}`} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <InlineError message={error?.message} details={error?.details} />
        <div className="form-field">
          <label className="form-label">
            Destination Account<span className="form-label__required">*</span>
          </label>
          <LookupCombobox
            displayLabel={destinationAccountLabel}
            onSearch={searchDestinationAccounts}
            onSelect={handleSelect}
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
            hasError={Boolean(fieldError)}
          />
          {fieldError ? <div className="form-error">{fieldError}</div> : null}
          <div className="form-hint">Backend validates the selected account against the synced Oracle cache.</div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 13 }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Enabled
        </label>
        <div className="modal__footer" style={modalFooterStyle}>
          <button type="button" className="btn" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
