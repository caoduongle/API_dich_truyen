# Research: Shared Redis Connection Manager & Lifecycle Engine

## Phase 0: Technical Architecture & Analysis

### 1. Current State vs Target Architecture

```mermaid
graph TD
    subgraph Current [Current: Redundant Client Connections]
        A1[rateLimiter instance 1] -->|new Redis| R1[(Redis TCP Socket 1)]
        A2[rateLimiter instance 2] -->|new Redis| R2[(Redis TCP Socket 2)]
        B[authStore] -->|new Redis| R3[(Redis TCP Socket 3)]
        C[sessionStore] -->|new Redis| R4[(Redis TCP Socket 4)]
    end

    subgraph Target [Target: Single Shared Redis Manager]
        T1[rateLimiter instance 1] --> M[redisManager.getClient]
        T2[rateLimiter instance 2] --> M
        TB[authStore] --> M
        TC[sessionStore] --> M
        M --> SR[(Single Shared Redis TCP Socket)]
    end
```

---

### 2. Connection Lifecycle & Graceful Shutdown

```mermaid
stateDiagram-v2
    [*] --> Disconnected: No REDIS_URL
    [*] --> Connected: REDIS_URL present & Connected

    Connected --> Degraded: Network timeout / Connection drop
    Degraded --> Connected: Reconnected ('ready' event)
    Connected --> Closed: Process shutdown (SIGINT / SIGTERM)
    Degraded --> Closed: Process shutdown (SIGINT / SIGTERM)
    Closed --> [*]
```

---

### 3. Graceful Shutdown & Resource Cleanup

- `redisManager.close()` invokes `await client.quit()`, ensuring any pending commands are flushed and the TCP socket closes cleanly.
- `server.ts` registers a unified shutdown handler listening for `SIGINT` and `SIGTERM`.
