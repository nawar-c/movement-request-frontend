import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../components/layout/PageHeader.jsx'
import { DomainSyncCard } from '../components/admin/DomainSyncCard.jsx'
import { ItemRefreshCard } from '../components/admin/ItemRefreshCard.jsx'
import { SyncStatusBadge } from '../components/common/StatusBadge.jsx'
import { LoadingState, ErrorState, EmptyState, InlineError, InlineNotice } from '../components/common/States.jsx'
import { adminSyncApi, SYNC_DOMAINS, DOMAIN_LABELS } from '../api/adminSyncApi.js'
import { formatDateTime, truncate } from '../utils/formatters.js'

function friendlyErrorMessage(err) {
  if (err.status === 409 || err.code === 'SYNC_ALREADY_RUNNING') {
    return 'A master data synchronization is already running. Please wait for it to complete.'
  }
  return err.message
}

export function AdminMasterDataSyncPage() {
  const [status, setStatus] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [syncAllBusy, setSyncAllBusy] = useState(false)
  const [syncAllError, setSyncAllError] = useState(null)
  const [domainBusy, setDomainBusy] = useState({})
  const [domainErrors, setDomainErrors] = useState({})

  const loadAll = useCallback(() => {
    setLoading(true)
    setLoadError(null)
    return Promise.all([adminSyncApi.getStatus(), adminSyncApi.getHistory({ limit: 20 })])
      .then(([statusData, historyData]) => {
        setStatus(statusData)
        setHistory(historyData.items)
      })
      .catch((err) => setLoadError(err))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // Refreshes status/history in place after a sync action, without the full-page loading state.
  function refreshQuiet() {
    return Promise.all([adminSyncApi.getStatus(), adminSyncApi.getHistory({ limit: 20 })])
      .then(([statusData, historyData]) => {
        setStatus(statusData)
        setHistory(historyData.items)
      })
      .catch((err) => setLoadError(err))
  }

  async function handleSyncAll() {
    setSyncAllBusy(true)
    setSyncAllError(null)
    try {
      await adminSyncApi.syncAll()
      await refreshQuiet()
    } catch (err) {
      setSyncAllError(err)
    } finally {
      setSyncAllBusy(false)
    }
  }

  async function handleDomainSync(domainKey) {
    setDomainBusy((prev) => ({ ...prev, [domainKey]: true }))
    setDomainErrors((prev) => ({ ...prev, [domainKey]: null }))
    try {
      await adminSyncApi.syncDomain(domainKey)
      await refreshQuiet()
    } catch (err) {
      setDomainErrors((prev) => ({ ...prev, [domainKey]: friendlyErrorMessage(err) }))
    } finally {
      setDomainBusy((prev) => ({ ...prev, [domainKey]: false }))
    }
  }

  if (loading) return <LoadingState label="Loading sync status..." />
  if (loadError) return <ErrorState message={loadError.message} onRetry={loadAll} />

  const domainStatusMap = Object.fromEntries((status?.domains || []).map((d) => [d.domain, d]))
  const anySyncRunning =
    syncAllBusy ||
    Object.values(domainBusy).some(Boolean) ||
    Boolean(status?.syncAll?.isRunning) ||
    (status?.domains || []).some((d) => d.isRunning)

  return (
    <div>
      <PageHeader
        title="Master Data Sync"
        subtitle="Synchronize reference data from Oracle Fusion."
        actions={
          <>
            <button type="button" className="btn" onClick={loadAll} disabled={loading}>
              Refresh
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSyncAll} disabled={anySyncRunning}>
              {syncAllBusy ? 'Syncing All...' : 'Sync All'}
            </button>
          </>
        }
      />

      <InlineNotice>
        Oracle Fusion is the source of truth. Synchronizing here refreshes this application&apos;s local
        reference-data cache from Oracle — it does not write anything back to Oracle Fusion.
      </InlineNotice>

      <InlineError message={syncAllError ? friendlyErrorMessage(syncAllError) : null} />

      <div className="card-grid">
        {SYNC_DOMAINS.map((d) => (
          <DomainSyncCard
            key={d.key}
            label={d.label}
            domainStatus={domainStatusMap[d.key]}
            busy={Boolean(domainBusy[d.key])}
            disabled={anySyncRunning && !domainBusy[d.key]}
            onSync={() => handleDomainSync(d.key)}
            error={domainErrors[d.key]}
          />
        ))}
      </div>

      <ItemRefreshCard disabled={anySyncRunning} onRefreshed={refreshQuiet} />

      <div className="card">
        <div className="card__header">
          <h2 className="card__title">Sync History</h2>
        </div>
        <div className="card__body" style={{ padding: history.length === 0 ? undefined : 0 }}>
          {history.length === 0 ? (
            <EmptyState title="No sync runs yet" />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Domain</th>
                    <th>Started</th>
                    <th>Completed</th>
                    <th>Status</th>
                    <th className="num-cell">Seen</th>
                    <th className="num-cell">Upserted</th>
                    <th className="num-cell">Disabled</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id}>
                      <td>{DOMAIN_LABELS[h.domain] || h.domain}</td>
                      <td className="text-muted">{formatDateTime(h.startedAt)}</td>
                      <td className="text-muted">{formatDateTime(h.completedAt) || '—'}</td>
                      <td>
                        <SyncStatusBadge status={h.status} isRunning={h.status === 'RUNNING'} />
                      </td>
                      <td className="num-cell">{h.recordsSeen}</td>
                      <td className="num-cell">{h.recordsUpserted}</td>
                      <td className="num-cell">{h.recordsDisabled}</td>
                      <td>
                        {h.errorMessage ? (
                          <span className="text-muted" title={h.errorMessage}>
                            {truncate(h.errorMessage, 60)}
                          </span>
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
