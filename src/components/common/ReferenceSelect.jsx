export function ReferenceSelect({ options, valueKey = 'code', labelKey = 'name', value, onChange, placeholder = 'Select...', disabled, hasError, loading }) {
  return (
    <select
      className={`form-select${hasError ? ' has-error' : ''}`}
      value={value || ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">{loading ? 'Loading...' : placeholder}</option>
      {options.map((opt) => (
        <option key={opt[valueKey]} value={opt[valueKey]}>
          {opt[labelKey] || opt[valueKey]}
        </option>
      ))}
    </select>
  )
}
