import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/layout/PageHeader.jsx'
import { LoadingState, ErrorState, EmptyState, InlineError } from '../components/common/States.jsx'
import { adminApprovalRulesApi } from '../api/adminApprovalRulesApi.js'

const ruleKey = (r) => `${r.organizationCode}|${r.subinventoryCode}`

export function AdminApprovalRulesPage() {
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [rowError, setRowError] = useState(null)
  const [busyKey, setBusyKey] = useState(null)

  const [orgFilter, setOrgFilter] = useState('')
  const [subFilter, setSubFilter] = useState('')
  const [requiredFilter, setRequiredFilter] = useState('')

  function load() {
    setLoading(true)
    setLoadError(null)
    adminApprovalRulesApi
      .list()
      .then((data) => setRules(Array.isArray(data) ? data : data.items || []))
      .catch((err) => setLoadError(err))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const organizationOptions = useMemo(
    () => Array.from(new Set(rules.map((r) => r.organizationCode))).sort(),
    [rules],
  )

  const filtered = useMemo(() => {
    const term = subFilter.trim().toLowerCase()
    return rules.filter((r) => {
      if (orgFilter && r.organizationCode !== orgFilter) return false
      if (term && !r.subinventoryCode.toLowerCase().includes(term)) return false
      if (requiredFilter === 'YES' && !r.approvalRequired) return false
      if (requiredFilter === 'NO' && r.approvalRequired) return false
      return true
    })
  }, [rules, orgFilter, subFilter, requiredFilter])

  async function handleToggle(rule) {
    const key = ruleKey(rule)
    setRowError(null)
    setBusyKey(key)
    try {
      await adminApprovalRulesApi.setApprovalRequired(rule.organizationCode, rule.subinventoryCode, !rule.approvalRequired)
      await load()
    } catch (err) {
      setRowError(err)
    } finally {
      setBusyKey(null)
    }
  }

  if (loading) return <LoadingState label="Loading approval rules..." />
  if (loadError) return <ErrorState message={loadError.message} onRetry={load} />

  return (
    <div>
      <PageHeader
        title="Approval Rules"
        subtitle="Whether Oracle approval is required per Inventory Organization and Destination Subinventory."
      />

      <InlineError message={rowError?.message} />

      <div className="card">
        <div className="card__body">
          <div className="toolbar">
            <select className="form-select" value={orgFilter} onChange={(e) => setOrgFilter(e.target.value)}>
              <option value="">All organizations</option>
              {organizationOptions.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
            <input
              type="text"
              className="form-input"
              placeholder="Search destination subinventory..."
              value={subFilter}
              onChange={(e) => setSubFilter(e.target.value)}
            />
            <select className="form-select" value={requiredFilter} onChange={(e) => setRequiredFilter(e.target.value)}>
              <option value="">Approval required: all</option>
              <option value="YES">Approval required: Yes</option>
              <option value="NO">Approval required: No</option>
            </select>
            <span className="text-faint" style={{ fontSize: 12 }}>
              {filtered.length} of {rules.length}
            </span>
          </div>

          {filtered.length === 0 ? (
            <EmptyState title="No matching rules" />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Inventory Organization</th>
                    <th>Destination Subinventory</th>
                    <th>Approval Required</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const key = ruleKey(r)
                    return (
                      <tr key={key}>
                        <td>{r.organizationCode}</td>
                        <td>{r.subinventoryCode}</td>
                        <td>
                          <span
                            className={`status-badge ${r.approvalRequired ? 'status-badge--ready' : 'status-badge--muted'}`}
                          >
                            {r.approvalRequired ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => handleToggle(r)}
                            disabled={busyKey === key}
                          >
                            {busyKey === key ? 'Saving...' : r.approvalRequired ? 'Set to No' : 'Set to Yes'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
