import { useState } from 'react'
import { Button, ErrorBox, Field, Modal, Textarea } from '../../components/ui'
import { errMsg } from '../../lib/format'

/** Every high-impact admin action asks for a written reason, which is stored in the audit log. */
export function ReasonDialog({ open, title, description, confirmLabel, danger, extra, onConfirm, onClose }: {
  open: boolean; title: string; description?: string; confirmLabel: string; danger?: boolean
  extra?: React.ReactNode; onConfirm: (reason: string) => Promise<void>; onClose: () => void
}) {
  const [reason, setReason] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const close = () => { setReason(''); setErr(null); onClose() }
  return (
    <Modal open={open} onClose={close} title={title}>
      <div className="space-y-3">
        {err && <ErrorBox error={err} />}
        {description && <p className="text-sm text-slate-600">{description}</p>}
        {extra}
        <Field label="Reason (required, saved in the audit log)">{(id) => <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={close}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} loading={busy} disabled={reason.trim().length < 5} onClick={async () => {
            setBusy(true); setErr(null)
            try { await onConfirm(reason.trim()); setReason(''); onClose() } catch (e) { setErr(errMsg(e)) } finally { setBusy(false) }
          }}>{confirmLabel}</Button>
        </div>
      </div>
    </Modal>
  )
}
