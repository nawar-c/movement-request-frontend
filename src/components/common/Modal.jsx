export function Modal({ title, children, footer, onClose }) {
  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal__header">
          <h2 className="modal__title">{title}</h2>
        </div>
        <div className="modal__body">{children}</div>
        {footer ? <div className="modal__footer">{footer}</div> : null}
      </div>
    </div>
  )
}

export function ConfirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', busy, onConfirm, onCancel, tone = 'primary' }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <div>{message}</div>
      <div className="modal__footer" style={{ padding: '20px 0 0', borderTop: 'none' }}>
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={tone === 'danger' ? 'btn btn-danger' : 'btn btn-primary'}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? 'Please wait...' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
