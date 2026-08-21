export interface GoogleUserProfile {
  id: string;
  email: string;
  name: string;
  picture: string;
}

export interface GoogleAuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
  expiresAt: number | null;
  user: GoogleUserProfile | null;
  clientId: string;
  error: string | null;
}

export interface PKCEChallenge {
  codeVerifier: string;
  codeChallenge: string;
  state: string;
}
