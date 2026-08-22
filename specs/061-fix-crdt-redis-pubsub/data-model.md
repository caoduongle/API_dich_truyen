# Data Model & State Transitions: Fix Redis Pub/Sub Initialization

## 1. Client Configuration Model

```typescript
interface RedisClientConfig {
  // Main Client (Fail-Fast for API & Rate Limiter)
  mainClient: {
    maxRetriesPerRequest: 1;
    enableOfflineQueue: false;
  };

  // Subscriber Client (Persistent Channel Management)
  subClientOverride: {
    maxRetriesPerRequest: null;
    enableOfflineQueue: true;
  };
}
```

---

## 2. Pub/Sub Lifecycle & State Transitions

```text
Server Startup
  │
  ├─► redisManager.getClient()
  │     │
  │     ├── [null / in-memory mode] ──► Exit gracefully (No Pub/Sub needed)
  │     │
  │     └── [Redis instance exists]
  │           │
  │           ▼
  │         mainClient.duplicate({ enableOfflineQueue: true, maxRetriesPerRequest: null })
  │           │
  │           ├─► Attach subClient.on('error', handler)
  │           │
  │           ├─► Attach subClient.on('ready', async () => psubscribe('crdt:room:*'))
  │           │
  │           ├─► Attach subClient.on('pmessage', messageHandler)
  │           │
  │           ├─► If status === 'ready' ──► psubscribe('crdt:room:*') immediately
  │           │
  │           └─► Attach setRedisPublisherHook(...)
```

---

## 3. Message Serialization Protocol (Unchanged)

```typescript
// Channel Format
type RedisChannel = `crdt:room:${string}`;

// Payload Format
interface RedisCrdtPayload {
  inst: string; // Instance ID to prevent self-echo loops
  b64: string;  // Base64 encoded binary CRDT update chunk
}
```
