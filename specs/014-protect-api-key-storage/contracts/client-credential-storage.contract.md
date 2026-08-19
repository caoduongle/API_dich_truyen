# Contract: Client Credential Storage & Migration Lifecycle

## 1. Storage Scope Specifications

| Storage Domain | Key Name | Retention Period | Plaintext Security Policy |
|---|---|---|---|
| `sessionStorage` | `gemini_api_keys` | Current browser tab lifetime | Valid array of strings. Cleared on tab close or user deletion. |
| `localStorage` | `gemini_session_token` | Persistent across sessions | Opaque UUIDv4 string. |
| `localStorage` | `gemini_auth_token` | Persistent across sessions | Hex authentication token. |
| `localStorage` | `gemini_selected_model` | Persistent across sessions | Model string identifier. |
| `localStorage` | `gemini_api_keys` | **ZERO RETENTION** | **Deprecated legacy storage. MUST BE PURGED upon startup migration.** |

---

## 2. Legacy Migration Algorithm

```typescript
function migrateAndLoadApiKeys(): string[] {
  // 1. Check active session storage first
  try {
    const sessionData = sessionStorage.getItem('gemini_api_keys');
    if (sessionData) {
      const parsed = JSON.parse(sessionData);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((k): k is string => typeof k === 'string' && k.trim().length > 0);
      }
    }
  } catch (_) {
    sessionStorage.removeItem('gemini_api_keys');
  }

  // 2. Check legacy localStorage
  try {
    const legacyData = localStorage.getItem('gemini_api_keys');
    if (legacyData) {
      const parsed = JSON.parse(legacyData);
      // Clean up legacy storage regardless
      localStorage.removeItem('gemini_api_keys');

      if (Array.isArray(parsed)) {
        const clean = parsed.filter((k): k is string => typeof k === 'string' && k.trim().length > 0);
        if (clean.length > 0) {
          sessionStorage.setItem('gemini_api_keys', JSON.stringify(clean));
          return clean;
        }
      }
    }
  } catch (_) {
    // Malformed JSON in legacy storage -> purge it safely
    localStorage.removeItem('gemini_api_keys');
  }

  return [];
}
```

---

## 3. Client React Hook Contract (`useAIConfig`)

### Exposed State & Methods

```typescript
export interface AIConfigHookReturn {
  apiKeys: string[];
  selectedModel: string;
  availableModels: RegisteredModelDef[];
  discoveredModels: RegisteredModelDef[];
  customModels: RegisteredModelDef[];
  showApiSettings: boolean;
  setShowApiSettings: (show: boolean) => void;
  handleSaveModel: (model: string) => void;
  handleAddApiKey: () => void;
  handleUpdateKeyIndex: (index: number, val: string) => void;
  handleDeleteKeyIndex: (index: number) => void;
  handleImportClipboardKeys: () => Promise<void>;
  // ... other feature flags
}
```

### Invariants:
1. `apiKeys` in `useAIConfig` state must never write back to `localStorage.setItem('gemini_api_keys', ...)`.
2. Any mutation of `apiKeys` updates `sessionStorage` and asynchronously calls `syncSessionKeysToServer(apiKeys)`.
3. When `apiKeys` becomes empty (`[]`), `sessionStorage.removeItem('gemini_api_keys')` and `DELETE /api/session-keys` are executed.
