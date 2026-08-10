export function DetailField({ label, value, span }) {
  return (
    <div className={span === 3 ? 'form-field--span-3' : span === 2 ? 'form-field--span-2' : undefined}>
      <div className="detail-field__label">{label}</div>
      <div className={`detail-field__value${value ? '' : ' detail-field__value--empty'}`}>
        {value || 'Not set'}
      </div>
    </div>
  )
}
