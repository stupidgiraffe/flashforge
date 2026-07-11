import { useRef, useState } from 'react'
import { DownloadSimple, UploadSimple, Trash } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { decryptCredentialBackup, encryptCredentialBackup } from '@/lib/agent-preferences'
import type { CredentialBackupPayload } from '@/lib/agent-preferences'

interface CredentialBackupPanelProps {
  rememberAiKey: boolean
  hasSavedCredentials: boolean
  disabled?: boolean
  getBackupPayload: () => CredentialBackupPayload
  onRememberAiKeyChange: (remember: boolean) => void
  onImport: (payload: CredentialBackupPayload) => void
  onClearCredentials: () => void
}

export function CredentialBackupPanel({
  rememberAiKey,
  hasSavedCredentials,
  disabled,
  getBackupPayload,
  onRememberAiKeyChange,
  onImport,
  onClearCredentials,
}: CredentialBackupPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [passphrase, setPassphrase] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function exportBackup() {
    try {
      setBusy(true)
      setMessage(null)
      const serialized = await encryptCredentialBackup(getBackupPayload(), passphrase)
      const blob = new Blob([serialized], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `flashforge-encrypted-settings-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      setMessage('Encrypted settings backup downloaded. Keep the passphrase separately.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not export encrypted settings')
    } finally {
      setBusy(false)
    }
  }

  async function importBackup(file: File) {
    try {
      setBusy(true)
      setMessage(null)
      const serialized = await file.text()
      const payload = await decryptCredentialBackup(serialized, passphrase)
      onImport(payload)
      setMessage('Encrypted settings restored on this device.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not import encrypted settings')
    } finally {
      setBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <details className="rounded-md border p-3">
      <summary className="cursor-pointer text-sm font-medium">Credential storage and encrypted backup</summary>
      <div className="mt-4 space-y-4">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={rememberAiKey}
            disabled={disabled}
            onChange={(event) => onRememberAiKeyChange(event.target.checked)}
          />
          <span>
            <span className="font-medium">Remember the AI key on this device</span>
            <span className="block text-xs text-muted-foreground">Stored only in this browser. Clearing site data removes it.</span>
          </span>
        </label>

        <div className="space-y-2">
          <Label htmlFor="credential-backup-passphrase">Backup passphrase</Label>
          <Input
            id="credential-backup-passphrase"
            type="password"
            value={passphrase}
            minLength={10}
            autoComplete="new-password"
            placeholder="At least 10 characters"
            disabled={disabled || busy}
            onChange={(event) => setPassphrase(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">FlashForge encrypts the backup in your browser. The passphrase is never stored or uploaded.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={disabled || busy || passphrase.length < 10} onClick={exportBackup}>
            <DownloadSimple className="mr-2" /> Export encrypted settings
          </Button>
          <Button type="button" variant="outline" disabled={disabled || busy || passphrase.length < 10} onClick={() => fileInputRef.current?.click()}>
            <UploadSimple className="mr-2" /> Import encrypted settings
          </Button>
          <Button type="button" variant="outline" disabled={disabled || busy || !hasSavedCredentials} onClick={onClearCredentials}>
            <Trash className="mr-2" /> Clear saved credentials
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void importBackup(file)
            }}
          />
        </div>
        {message && <p role="status" className="text-xs text-muted-foreground">{message}</p>}
      </div>
    </details>
  )
}
