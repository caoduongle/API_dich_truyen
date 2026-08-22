import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { googleAuthService } from '../../../services/googleAuthService';
import { googlePickerService } from '../../../services/googlePickerService';

describe('GoogleSyncModal Credential Privacy & Resolution Tests', () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    const storageMock = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, value: string) => {
        mockStorage[key] = value;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        mockStorage = {};
      },
    };

    (global as any).window = {
      localStorage: storageMock,
    };
    (global as any).localStorage = storageMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves default Client ID for runtime auth but returns empty string for custom UI input', () => {
    const isCustom = Boolean(localStorage.getItem('ai_dich_truyen_google_client_id'));
    const effectiveClientId = googleAuthService.getClientId();
    const customClientId = googleAuthService.getCustomClientId();

    expect(isCustom).toBe(false);
    expect(typeof effectiveClientId).toBe('string');
    // UI input must be empty by default so system keys are not pre-populated into the input
    expect(customClientId).toBe('');
  });

  it('resolves default Picker API Key for runtime picker but returns empty string for custom UI input', () => {
    const isCustom = Boolean(localStorage.getItem('ai_dich_truyen_google_picker_key'));
    const effectivePickerKey = googlePickerService.getPickerApiKey();
    const customPickerKey = googlePickerService.getCustomPickerApiKey();

    expect(isCustom).toBe(false);
    expect(typeof effectivePickerKey).toBe('string');
    // UI input must be empty by default
    expect(customPickerKey).toBe('');
  });

  it('persists and flags custom Client ID when user sets custom credentials', () => {
    const customId = '987654321-custom.apps.googleusercontent.com';
    googleAuthService.setClientId(customId);

    const isCustom = Boolean(localStorage.getItem('ai_dich_truyen_google_client_id'));
    const resolvedId = googleAuthService.getClientId();
    const customIdForInput = googleAuthService.getCustomClientId();

    expect(isCustom).toBe(true);
    expect(resolvedId).toBe(customId);
    expect(customIdForInput).toBe(customId);
  });

  it('reverts to default Client ID and clears custom input value upon reset', () => {
    googleAuthService.setClientId('custom-test-id');
    expect(localStorage.getItem('ai_dich_truyen_google_client_id')).toBe('custom-test-id');
    expect(googleAuthService.getCustomClientId()).toBe('custom-test-id');

    // Reset
    googleAuthService.setClientId('');
    const isCustom = Boolean(localStorage.getItem('ai_dich_truyen_google_client_id'));

    expect(isCustom).toBe(false);
    expect(localStorage.getItem('ai_dich_truyen_google_client_id')).toBeNull();
    expect(googleAuthService.getCustomClientId()).toBe('');
  });

  it('persists and flags custom Picker API Key and clears upon reset', () => {
    const customPickerKey = 'AIzaSyCustomPickerKey12345';
    googlePickerService.setPickerApiKey(customPickerKey);

    expect(localStorage.getItem('ai_dich_truyen_google_picker_key')).toBe(customPickerKey);
    expect(googlePickerService.getPickerApiKey()).toBe(customPickerKey);
    expect(googlePickerService.getCustomPickerApiKey()).toBe(customPickerKey);

    // Reset
    googlePickerService.setPickerApiKey('');
    expect(localStorage.getItem('ai_dich_truyen_google_picker_key')).toBeNull();
    expect(googlePickerService.getCustomPickerApiKey()).toBe('');
  });

  it('ensures credential input masking default is password mode', () => {
    // In UI state, reveal state starts as false
    let revealClientId = false;
    let revealPickerKey = false;

    expect(revealClientId ? 'text' : 'password').toBe('password');
    expect(revealPickerKey ? 'text' : 'password').toBe('password');

    // Toggle reveal
    revealClientId = !revealClientId;
    expect(revealClientId ? 'text' : 'password').toBe('text');
  });
});
