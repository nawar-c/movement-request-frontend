import {
  LOCAL_STATUS_OPTIONS,
  LINE_CLOSURE_OPTIONS,
  ORACLE_STATUS_CODE_OPTIONS,
} from '../common/StatusBadge.jsx'
import { useOrganizations } from '../../hooks/useReferenceData.js'
import { DATE_PRESETS, DEFAULT_DATE_PRESET } from '../../utils/dateRangePresets.js'

const DEFAULT_FILTERS = {
  preset: DEFAULT_DATE_PRESET,
  applicationStatus: '',
  oracleStatusCode: '',
  lineClosure: '',
  organizationCode: '',
}

export { DEFAULT_FILTERS }

export function DashboardFilters({ filters, onChange, onReset, updating }) {
  const organizations = useOrganizations()

  function set(key, value) {
    onChange({ [key]: value })
  }

  const orgLabel = (code) => organizations.data.find((o) => o.code === code)?.name || code
  const oracleLabel = (code) =>
    ORACLE_STATUS_CODE_OPTIONS.find((o) => String(o.code) === String(code))?.label || code
  const localLabel = (value) => LOCAL_STATUS_OPTIONS.find((o) => o.value === value)?.label || value
  const closureLabel = (value) => LINE_CLOSURE_OPTIONS.find((o) => o.value === value)?.label || value
  const presetLabel = (value) => DATE_PRESETS.find((p) => p.value === value)?.label || value

  const chips = []
  if (filters.preset !== DEFAULT_DATE_PRESET) {
    chips.push({ key: 'preset', label: presetLabel(filters.preset), clear: () => set('preset', DEFAULT_DATE_PRESET) })
  }
  if (filters.applicationStatus) {
    chips.push({
      key: 'applicationStatus',
      label: `Status: ${localLabel(filters.applicationStatus)}`,
      clear: () => set('applicationStatus', ''),
    })
  }
  if (filters.oracleStatusCode) {
    chips.push({
      key: 'oracleStatusCode',
      label: `Oracle: ${oracleLabel(filters.oracleStatusCode)}`,
      clear: () => set('oracleStatusCode', ''),
    })
  }
  if (filters.lineClosure) {
    chips.push({
      key: 'lineClosure',
      label: `Line Closure: ${closureLabel(filters.lineClosure)}`,
      clear: () => set('lineClosure', ''),
    })
  }
  if (filters.organizationCode) {
    chips.push({
      key: 'organizationCode',
      label: `Org: ${orgLabel(filters.organizationCode)}`,
      clear: () => set('organizationCode', ''),
    })
  }

  const hasActiveFilters = chips.length > 0

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card__body">
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <div className="preset-group" role="group" aria-label="Date range">
            {DATE_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                className={`preset-btn${filters.preset === p.value ? ' preset-btn--active' : ''}`}
                aria-pressed={filters.preset === p.value}
                onClick={() => set('preset', p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <select
            className="form-select"
            aria-label="Application Status"
            value={filters.applicationStatus}
            onChange={(e) => set('applicationStatus', e.target.value)}
          >
            <option value="">All Statuses</option>
            {LOCAL_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <select
            className="form-select"
            aria-label="Oracle Status"
            value={filters.oracleStatusCode}
            onChange={(e) => set('oracleStatusCode', e.target.value)}
          >
            <option value="">All Oracle Statuses</option>
            {ORACLE_STATUS_CODE_OPTIONS.map((o) => (
              <option key={o.code} value={o.code}>
                {o.label}
              </option>
            ))}
          </select>

          <select
            className="form-select"
            aria-label="Line Closure"
            value={filters.lineClosure}
            onChange={(e) => set('lineClosure', e.target.value)}
          >
            <option value="">All Line Closure</option>
            {LINE_CLOSURE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <select
            className="form-select"
            aria-label="Organization"
            value={filters.organizationCode}
            onChange={(e) => set('organizationCode', e.target.value)}
            disabled={organizations.loading}
          >
            <option value="">All Organizations</option>
            {organizations.data.map((o) => (
              <option key={o.code} value={o.code}>
                {o.name || o.code}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="btn btn-sm"
            disabled
            title="Source, Destination, and Requester filters are coming in a later phase."
          >
            More Filters
          </button>

          {hasActiveFilters ? (
            <button type="button" className="btn-link filter-clear" onClick={onReset}>
              Clear / Reset Filters
            </button>
          ) : null}

          {updating ? (
            <span className="filter-updating">
              <span className="spinner" />
              Updating…
            </span>
          ) : null}
        </div>

        {chips.length > 0 ? (
          <div className="filter-chips">
            {chips.map((chip) => (
              <span className="filter-chip" key={chip.key}>
                {chip.label}
                <button
                  type="button"
                  className="filter-chip__remove"
                  onClick={chip.clear}
                  aria-label={`Remove filter: ${chip.label}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
