// Minimal Prev/Next pagination shared by the Attention Worklist and Matching Requests table —
// deliberately not a general-purpose data-grid, just enough to page through the backend's
// page/pageSize/total contract.
export function PaginationBar({ page, pageSize, total, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(total, page * pageSize)

  return (
    <div className="pagination-bar">
      <span className="text-faint">
        {start}–{end} of {total}
      </span>
      <div className="pagination-bar__controls">
        <button
          type="button"
          className="btn btn-sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Prev
        </button>
        <span className="text-muted">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          className="btn btn-sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  )
}
