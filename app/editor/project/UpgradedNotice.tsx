import type { Upgraded } from './api'
import { Modal } from '../Modal'

// shown once, after an upgrade on open or import rewrote the files
export function UpgradedNotice({ upgraded, onClose }: { upgraded: Upgraded | null; onClose: () => void }) {
  return (
    <Modal open={!!upgraded} title="Project upgraded" submitLabel="OK" cancelLabel={null} onSubmit={onClose} onClose={onClose}>
      <p>
        It was made with Conness GIS {upgraded?.from}. Its files were updated for {upgraded?.to}:
      </p>
      <ul className="mt-2 list-disc pl-5">
        {upgraded?.changes.map((change) => <li key={change}>{change}</li>)}
      </ul>
    </Modal>
  )
}
