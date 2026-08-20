# Data Model: Secure Session Tokens (Zero URL Query Credentials)

## 1. Error Payload Contracts

### 1.1 Disallowed Query Token Error (HTTP 400)

```typescript
export interface DisallowedUrlCredentialsError {
  code: 'DISALLOWED_URL_CREDENTIALS';
  error: string;
}
```

---

### 1.2 Missing Session Token Error (HTTP 401)

```typescript
export interface MissingSessionTokenError {
  code: 'MISSING_SESSION_TOKEN';
  error: string;
}
```
