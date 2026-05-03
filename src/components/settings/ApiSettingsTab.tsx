import type { Provider } from '../../config/models'
import { ApiKeysSettings, type KeyHook } from '../ApiKeysDialog'

type ApiSettingsTabProps = {
  keyHooks: Record<Provider, KeyHook>
}

export function ApiSettingsTab({ keyHooks }: ApiSettingsTabProps) {
  return (
    <div className="px-5 py-4">
      <ApiKeysSettings keyHooks={keyHooks} variant="embedded" />
    </div>
  )
}
