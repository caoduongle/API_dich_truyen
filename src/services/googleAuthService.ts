import { GoogleAuthState, GoogleUserProfile } from '../types/googleAuth';

declare const google: any;

const GOOGLE_GSI_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const GOOGLE_USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo';

const SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/drive.file',
].join(' ');

const AUTH_SESSION_KEY = 'ai_dich_truyen_google_auth';
const CUSTOM_CLIENT_ID_KEY = 'ai_dich_truyen_google_client_id';

class GoogleAuthService {
  private state: GoogleAuthState = {
    isAuthenticated: false,
    accessToken: null,
    expiresAt: null,
    user: null,
    clientId: this.getInitialClientId(),
    error: null,
  };

  private listeners: Array<(state: GoogleAuthState) => void> = [];
  private tokenClient: any = null;
  private gsiLoadingPromise: Promise<void> | null = null;

  constructor() {
    this.restoreSessionFromStorage();
  }

  private getInitialClientId(): string {
    if (typeof window === 'undefined') return '';
    const stored = localStorage.getItem(CUSTOM_CLIENT_ID_KEY);
    if (stored && stored.trim()) return stored.trim();
    return (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
  }

  public setClientId(clientId: string): void {
    const cleanId = (clientId || '').trim();
    this.state.clientId = cleanId;
    this.tokenClient = null; // Reset để lần đăng nhập kế tiếp khởi tạo lại với Client ID mới
    if (typeof window !== 'undefined') {
      if (cleanId) {
        localStorage.setItem(CUSTOM_CLIENT_ID_KEY, cleanId);
      } else {
        localStorage.removeItem(CUSTOM_CLIENT_ID_KEY);
      }
    }
    this.notify();
  }

  public getClientId(): string {
    return this.state.clientId || this.getInitialClientId();
  }

  public getCustomClientId(): string {
    if (typeof window === 'undefined') return '';
    const stored = localStorage.getItem(CUSTOM_CLIENT_ID_KEY);
    return (stored && stored.trim()) || '';
  }

  public getAuthState(): GoogleAuthState {
    return { ...this.state };
  }

  public getUser(): GoogleUserProfile | null {
    return this.state.user;
  }

  // GIỮ NGUYÊN như bản gốc — KHÔNG chuyển sang gọi getValidAccessToken().
  // src/hooks/useChapterCRDT.ts đang phụ thuộc đúng hành vi này.
  public getAccessToken(): string | null {
    return this.state.accessToken;
  }

  public onAuthStateChanged(callback: (state: GoogleAuthState) => void): () => void {
    this.listeners.push(callback);
    callback(this.getAuthState());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  private notify(): void {
    const current = this.getAuthState();
    this.listeners.forEach((l) => {
      try {
        l(current);
      } catch (err) {
        console.error('Lỗi khi thông báo auth state listener:', err);
      }
    });
  }

  private restoreSessionFromStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(AUTH_SESSION_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed.accessToken && parsed.expiresAt && Date.now() < parsed.expiresAt) {
        this.state = {
          isAuthenticated: true,
          accessToken: parsed.accessToken,
          expiresAt: parsed.expiresAt,
          user: parsed.user,
          clientId: this.getClientId(),
          error: null,
        };
      } else {
        sessionStorage.removeItem(AUTH_SESSION_KEY);
      }
    } catch {
      sessionStorage.removeItem(AUTH_SESSION_KEY);
    }
  }

  private saveSessionToStorage(): void {
    if (typeof window === 'undefined') return;
    if (this.state.isAuthenticated && this.state.accessToken) {
      sessionStorage.setItem(
        AUTH_SESSION_KEY,
        JSON.stringify({
          accessToken: this.state.accessToken,
          expiresAt: this.state.expiresAt,
          user: this.state.user,
        })
      );
    } else {
      sessionStorage.removeItem(AUTH_SESSION_KEY);
    }
  }

  /**
   * Tải động thư viện Google Identity Services (GSI), chỉ tải 1 lần cho cả session.
   */
  private async ensureGsiLoaded(): Promise<void> {
    if (typeof window === 'undefined') return;
    if (typeof google !== 'undefined' && google.accounts?.oauth2) return;

    if (!this.gsiLoadingPromise) {
      this.gsiLoadingPromise = new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = GOOGLE_GSI_SCRIPT_URL;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Không thể kết nối đến Google Identity Services (accounts.google.com).'));
        document.body.appendChild(script);
      });
    }
    return this.gsiLoadingPromise;
  }

  /**
   * Khởi tạo đăng nhập Google qua popup (Google Identity Services Token Client).
   * Google trả access_token thẳng cho callback — không có bước đổi code lấy
   * token nên không cần client_secret.
   */
  public async initiateLogin(): Promise<void> {
    const clientId = this.getClientId();
    if (!clientId) {
      this.state.error = 'Chưa cấu hình Google Client ID. Vui lòng nhập Client ID trong phần Đồng bộ Google Drive.';
      this.notify();
      throw new Error(this.state.error);
    }

    await this.ensureGsiLoaded();

    return new Promise<void>((resolve, reject) => {
      try {
        this.tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPES,
          callback: async (tokenResponse: any) => {
            if (tokenResponse.error) {
              const message = tokenResponse.error_description || tokenResponse.error;
              this.state = { ...this.state, isAuthenticated: false, error: `Lỗi đăng nhập Google: ${message}` };
              this.notify();
              reject(new Error(message));
              return;
            }
            try {
              const accessToken = tokenResponse.access_token;
              const expiresInSeconds = Number(tokenResponse.expires_in) || 3600;
              const expiresAt = Date.now() + expiresInSeconds * 1000;
              const user = await this.fetchUserProfile(accessToken);

              this.state = { isAuthenticated: true, accessToken, expiresAt, user, clientId, error: null };
              this.saveSessionToStorage();
              this.notify();
              resolve();
            } catch (err: any) {
              console.error('Lỗi hoàn tất đăng nhập Google OAuth:', err);
              this.state = {
                isAuthenticated: false,
                accessToken: null,
                expiresAt: null,
                user: null,
                clientId,
                error: err.message || 'Đăng nhập Google thất bại.',
              };
              this.notify();
              reject(err);
            }
          },
        });
        this.tokenClient.requestAccessToken({ prompt: 'select_account' });
      } catch (err: any) {
        this.state.error = err.message || 'Lỗi khởi tạo Google Identity Services.';
        this.notify();
        reject(err);
      }
    });
  }

  /**
   * Lấy User Profile từ Google userinfo endpoint — GIỮ NGUYÊN không đổi.
   */
  public async fetchUserProfile(accessToken: string): Promise<GoogleUserProfile> {
    const res = await fetch(GOOGLE_USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`Không thể lấy thông tin tài khoản Google (HTTP ${res.status})`);
    }
    const data = await res.json();
    return {
      id: data.sub || data.id,
      email: data.email || '',
      name: data.name || data.email || 'Người dùng Google',
      picture: data.picture || '',
    };
  }

  public getValidAccessToken(): string | null {
    if (!this.state.isAuthenticated || !this.state.accessToken) return null;
    if (this.state.expiresAt && Date.now() >= this.state.expiresAt - 60000) {
      this.logout();
      return null;
    }
    return this.state.accessToken;
  }

  public logout(): void {
    if (this.state.accessToken && typeof google !== 'undefined' && google.accounts?.oauth2) {
      try {
        google.accounts.oauth2.revoke(this.state.accessToken, () => {});
      } catch {
        // Bỏ qua lỗi revoke — không chặn việc đăng xuất cục bộ
      }
    }
    this.state = {
      isAuthenticated: false,
      accessToken: null,
      expiresAt: null,
      user: null,
      clientId: this.getClientId(),
      error: null,
    };
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(AUTH_SESSION_KEY);
    }
    this.notify();
  }
}

export const googleAuthService = new GoogleAuthService();
