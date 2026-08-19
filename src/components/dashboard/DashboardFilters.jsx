import { useState } from 'react'
import {
  LOCAL_STATUS_OPTIONS,
  LINE_CLOSURE_OPTIONS,
  ORACLE_STATUS_CODE_OPTIONS,
} from '../common/StatusBadge.jsx'
import {
  useOrganizations,
  useSourceSubinventoriesByOrganizations,
  useDestinationSubinventoriesByOrganizations,
} from '../../hooks/useReferenceData.js'
import { DATE_PRESETS, DEFAULT_DATE_PRESET } from '../../utils/dateRangePresets.js'
import { formatDate } from '../../utils/formatters.js'

const DEFAULT_FILTERS = {
  preset: DEFAULT_DATE_PRESET,
  // Set only by clicking a single day on the Request Trend chart (DAY grain) — overrides the
  // preset-derived date range with one exact calendar day. Still lives in the same shared filter
  // state, not a chart-local state, per the directional click-to-filter model.
  customDate: '',
  applicationStatus: '',
  oracleStatusCode: '',
  lineClosure: '',
  organizationCode: '',
  // Phase 3 — same shared filter state, populated either by the More Filters selects below or by
  // clicking a Destination/Source Activity row on the dashboard.
  sourceSubinventory: '',
  destinationSubinventory: '',
}

export { DEFAULT_FILTERS }

// Groups a {orgCode: [{code, name, ...}]} map into the organizations that actually have options,
// in organization list order — used so the Source/Destination selects can show <optgroup> labels
// instead of a flat list once more than one organization is in play.
function groupByOrganization(dataByOrg, organizations, onlyOrgCode) {
  const orgs = onlyOrgCode
    ? organizations.filter((o) => o.code === onlyOrgCode)
    : organizations
  return orgs
    .map((org) => ({ org, items: dataByOrg[org.code] || [] }))
    .filter((g) => g.items.length > 0)
}

export function DashboardFilters({ filters, onChange, onReset, updating }) {
  const organizations = useOrganizations()
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false)
  const [hasOpenedMoreFilters, setHasOpenedMoreFilters] = useState(false)

  // Reference data for the two new selects is only fetched once More Filters is opened for the
  // first time — not on every Dashboard load — since most visits won't touch it.
  const orgCodesForSubinventories = hasOpenedMoreFilters ? organizations.data.map((o) => o.code) : []
  const sourceByOrg = useSourceSubinventoriesByOrganizations(orgCodesForSubinventories)
  const destinationByOrg = useDestinationSubinventoriesByOrganizations(orgCodesForSubinventories)

  const sourceGroups = groupByOrganization(sourceByOrg.dataByOrg, organizations.data, filters.organizationCode)
  const destinationGroups = groupByOrganization(
    destinationByOrg.dataByOrg,
    organizations.data,
    filters.organizationCode,
  )

  function toggleMoreFilters() {
    setMoreFiltersOpen((open) => !open)
    setHasOpenedMoreFilters(true)
  }

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
  if (filters.customDate) {
    chips.push({
      key: 'customDate',
      label: `Date: ${formatDate(filters.customDate) || filters.customDate}`,
      clear: () => set('customDate', ''),
    })
  } else if (filters.preset !== DEFAULT_DATE_PRESET) {
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
  if (filters.sourceSubinventory) {
    chips.push({
      key: 'sourceSubinventory',
      label: `Source: ${filters.sourceSubinventory}`,
      clear: () => set('sourceSubinventory', ''),
    })
  }
  if (filters.destinationSubinventory) {
    chips.push({
      key: 'destinationSubinventory',
      label: `Destination: ${filters.destinationSubinventory}`,
      clear: () => set('destinationSubinventory', ''),
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
                className={`preset-btn${!filters.customDate && filters.preset === p.value ? ' preset-btn--active' : ''}`}
                aria-pressed={!filters.customDate && filters.preset === p.value}
                onClick={() => onChange({ preset: p.value, customDate: '' })}
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
            aria-expanded={moreFiltersOpen}
            onClick={toggleMoreFilters}
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

        {moreFiltersOpen ? (
          <div className="more-filters-panel">
            <div className="form-field">
              <label className="form-label" htmlFor="dashboard-source-subinventory">
                Source Subinventory
              </label>
              <select
                id="dashboard-source-subinventory"
                className="form-select"
                value={filters.sourceSubinventory}
                onChange={(e) => set('sourceSubinventory', e.target.value)}
                disabled={sourceByOrg.loading}
              >
                <option value="">All Sources</option>
                {sourceGroups.map(({ org, items }) => (
                  <optgroup key={org.code} label={org.name || org.code}>
                    {items.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.name || s.code}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="dashboard-destination-subinventory">
                Destination Subinventory
              </label>
              <select
                id="dashboard-destination-subinventory"
                className="form-select"
                value={filters.destinationSubinventory}
                onChange={(e) => set('destinationSubinventory', e.target.value)}
                disabled={destinationByOrg.loading}
              >
                <option value="">All Destinations</option>
                {destinationGroups.map(({ org, items }) => (
                  <optgroup key={org.code} label={org.name || org.code}>
                    {items.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.name || s.code}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>
        ) : null}

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
