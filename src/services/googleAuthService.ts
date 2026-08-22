import { GoogleAuthState, GoogleUserProfile } from '../types/googleAuth';
import { generatePKCEChallenge } from './pkceHelper';

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo';

const SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/drive.file',
].join(' ');

const PKCE_STATE_KEY = 'ai_dich_truyen_pkce_state';
const PKCE_VERIFIER_KEY = 'ai_dich_truyen_pkce_verifier';
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
   * Lấy redirect URI hiện tại của ứng dụng
   */
  public getRedirectUri(): string {
    if (typeof window === 'undefined') return 'http://localhost:5173';
    return window.location.origin + window.location.pathname;
  }

  /**
   * Khởi tạo luồng OAuth 2.0 PKCE và chuyển hướng tới Google Sign-In
   */
  public async initiateLogin(): Promise<void> {
    const clientId = this.getClientId();
    if (!clientId) {
      this.state.error = 'Chưa cấu hình Google Client ID. Vui lòng nhập Client ID trong phần Đồng bộ Google Drive.';
      this.notify();
      throw new Error(this.state.error);
    }

    const challenge = await generatePKCEChallenge();
    sessionStorage.setItem(PKCE_STATE_KEY, challenge.state);
    sessionStorage.setItem(PKCE_VERIFIER_KEY, challenge.codeVerifier);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: this.getRedirectUri(),
      response_type: 'code',
      scope: SCOPES,
      code_challenge: challenge.codeChallenge,
      code_challenge_method: 'S256',
      state: challenge.state,
      access_type: 'online',
      prompt: 'select_account',
    });

    window.location.href = `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
  }

  /**
   * Xử lý Authorization Code trả về từ URL redirect
   */
  public async handleAuthCallback(code: string, returnedState: string): Promise<boolean> {
    const savedState = sessionStorage.getItem(PKCE_STATE_KEY);
    const codeVerifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);

    sessionStorage.removeItem(PKCE_STATE_KEY);
    sessionStorage.removeItem(PKCE_VERIFIER_KEY);

    if (!savedState || savedState !== returnedState) {
      this.state.error = 'Lỗi xác thực OAuth: Trạng thái (state) không khớp hoặc phiên đã hết hạn.';
      this.notify();
      return false;
    }

    if (!codeVerifier) {
      this.state.error = 'Lỗi xác thực OAuth: Không tìm thấy PKCE code verifier.';
      this.notify();
      return false;
    }

    const clientId = this.getClientId();
    if (!clientId) {
      this.state.error = 'Không tìm thấy Google Client ID để hoàn tất xác thực.';
      this.notify();
      return false;
    }

    try {
      const bodyParams = new URLSearchParams({
        client_id: clientId,
        code_verifier: codeVerifier,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: this.getRedirectUri(),
      });

      const tokenRes = await fetch(GOOGLE_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: bodyParams.toString(),
      });

      if (!tokenRes.ok) {
        const errData = await tokenRes.json().catch(() => ({}));
        throw new Error(errData.error_description || errData.error || `Trao đổi token thất bại (HTTP ${tokenRes.status})`);
      }

      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;
      const expiresInSeconds = tokenData.expires_in || 3600;
      const expiresAt = Date.now() + expiresInSeconds * 1000;

      // Lấy thông tin user profile
      const user = await this.fetchUserProfile(accessToken);

      this.state = {
        isAuthenticated: true,
        accessToken,
        expiresAt,
        user,
        clientId,
        error: null,
      };

      this.saveSessionToStorage();
      this.notify();
      return true;
    } catch (err: any) {
      console.error('Lỗi hoàn tất đăng nhập Google OAuth PKCE:', err);
      this.state = {
        isAuthenticated: false,
        accessToken: null,
        expiresAt: null,
        user: null,
        clientId,
        error: err.message || 'Đăng nhập Google thất bại.',
      };
      this.notify();
      return false;
    }
  }

  /**
   * Lấy User Profile từ Google userinfo endpoint
   */
  public async fetchUserProfile(accessToken: string): Promise<GoogleUserProfile> {
    const res = await fetch(GOOGLE_USERINFO_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
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

  /**
   * Lấy Access Token hợp lệ, trả về null nếu hết hạn hoặc chưa đăng nhập
   */
  public getValidAccessToken(): string | null {
    if (!this.state.isAuthenticated || !this.state.accessToken) {
      return null;
    }
    if (this.state.expiresAt && Date.now() >= this.state.expiresAt - 60000) {
      // Token hết hạn hoặc sắp hết hạn trong 1 phút
      this.logout();
      return null;
    }
    return this.state.accessToken;
  }

  /**
   * Đăng xuất và xóa sạch token trong bộ nhớ
   */
  public logout(): void {
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
      sessionStorage.removeItem(PKCE_STATE_KEY);
      sessionStorage.removeItem(PKCE_VERIFIER_KEY);
    }
    this.notify();
  }
}

export const googleAuthService = new GoogleAuthService();
