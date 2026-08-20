# Contract: Hierarchical Scheduler Pipeline

## Core Method: `scheduleNextRequest()`

### Interface Specification

```typescript
export interface ScheduleRequestParams {
  modelId: string;
  estimatedPromptTokens?: number;
  candidateKeys: string[];
  groupConfigs?: Array<{
    id: string;
    projectId?: string;
    configuredRpm?: number;
    configuredTpm?: number;
    configuredRpd?: number;
    keyIds: string[];
  }>;
  now?: number;
}

export interface SchedulerExecutionPlan {
  selectedGroupId: string;
  selectedKeyId: string;
  selectedRawKey: string;
  keyIndex: number;
  pacingDelayMs: number;
  groupScore: number;
  keyScore: number;
}
```

---

### Pipeline Execution Order

```mermaid
sequenceDiagram
    autonumber
    participant Client as GeminiService Dispatcher
    participant Registry as ModelRegistry
    participant QuotaSvc as QuotaService
    participant GenAI as GoogleGenAI SDK

    Client->>Registry: Check model compatibility & limits(modelId)
    Client->>QuotaSvc: evaluateQuotaGroups(modelId, estimatedTokens)
    QuotaSvc-->>Client: Eligible Groups sorted by Score descending
    
    loop For each eligible QuotaGroup
        Client->>QuotaSvc: selectBestKeyInGroup(groupId)
        alt Healthy Key Found
            QuotaSvc-->>Client: Selected Key + Pacing Delay
            Client->>Client: Wait pacingDelayMs (if > 0)
            Client->>GenAI: execute generateContent(apiKey, prompt)
            alt Request Success (200)
                Client->>QuotaSvc: recordGroupSuccess(groupId, keyId, tokens)
            else Rate Limit / 429
                Client->>QuotaSvc: recordGroup429(groupId, keyId)
                Note over Client,QuotaSvc: Trigger Group Cooldown & Rotate to Next Group
            else Auth Failure / 401 / 403
                Client->>QuotaSvc: recordKeyAuthFailure(keyId)
                Note over Client,QuotaSvc: Disable Key & Retry with Next Key in Group
            end
        else No Healthy Keys in Group
            Note over Client,QuotaSvc: Skip group and try next group
        end
    end
```
