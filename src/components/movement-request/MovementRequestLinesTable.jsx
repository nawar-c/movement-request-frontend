import { EmptyState } from '../common/States.jsx'
import { LineTransactionTypeBadge, OracleStatusBadge } from '../common/StatusBadge.jsx'

function destinationLabel(line) {
  if (line.transactionTypeId === 64 || line.transactionType === 'Movement Request Transfer') {
    return line.destinationSubinventory
  }
  if (line.transactionTypeId === 63 || line.transactionType === 'Movement Request Issue') {
    return line.destinationAccount || line.destinationAccountId
  }
  return line.destinationSubinventory || line.destinationAccount || line.destinationAccountId
}

// Phase E2: Requester is no longer an editable line field, but historical requests may still carry
// a value written before the field was removed (e.g. MR-000039's two lines). Only shown in View
// mode (disabled), and only when at least one line actually has a value — new-style requests never
// will, so the column simply doesn't appear for them.
export function MovementRequestLinesTable({ lines, onAdd, onEdit, onRemove, disabled }) {
  const showRequesterColumn = disabled && lines.some((line) => line.requester)

  return (
    <div className="card">
      <div className="card__header">
        <h2 className="card__title">Lines ({lines.length})</h2>
        {!disabled ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={onAdd}>
            + Add Line
          </button>
        ) : null}
      </div>
      <div className="card__body" style={{ padding: lines.length === 0 ? undefined : 0 }}>
        {lines.length === 0 ? (
          <EmptyState title="No lines yet" message="Add at least one line before submitting this request." />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Line #</th>
                  <th>Item</th>
                  <th>Description</th>
                  <th>Type</th>
                  <th className="num-cell">Quantity</th>
                  <th>UOM</th>
                  <th>Source</th>
                  <th>Destination</th>
                  {showRequesterColumn ? <th>Requester</th> : null}
                  {disabled ? <th>Oracle Line Status</th> : null}
                  {disabled ? <th>Oracle Status Code</th> : null}
                  {!disabled ? <th></th> : null}
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={line.clientId || line.id}>
                    <td>{line.lineNumber || index + 1}</td>
                    <td>{line.itemNumber || <span className="text-faint">—</span>}</td>
                    <td>{line.itemDescription || <span className="text-faint">—</span>}</td>
                    <td>
                      <LineTransactionTypeBadge transactionType={line.transactionType} />
                    </td>
                    <td className="num-cell">{line.requestedQuantity ?? <span className="text-faint">—</span>}</td>
                    <td>{line.uom || <span className="text-faint">—</span>}</td>
                    <td>{line.sourceSubinventory || <span className="text-faint">—</span>}</td>
                    <td>{destinationLabel(line) || <span className="text-faint">—</span>}</td>
                    {showRequesterColumn ? (
                      <td>{line.requester || <span className="text-faint">—</span>}</td>
                    ) : null}
                    {disabled ? (
                      <td>
                        <OracleStatusBadge status={line.oracleStatus} />
                      </td>
                    ) : null}
                    {disabled ? (
                      <td>{line.oracleStatusCode != null ? String(line.oracleStatusCode) : <span className="text-faint">—</span>}</td>
                    ) : null}
                    {!disabled ? (
                      <td>
                        <div className="row-actions">
                          <button type="button" className="btn btn-sm" onClick={() => onEdit(index)}>
                            Edit
                          </button>
                          <button type="button" className="btn btn-sm btn-danger" onClick={() => onRemove(index)}>
                            Remove
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
