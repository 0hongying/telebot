export interface JwtUser {
  aud: string;
  exp: number;
  sub: string;
  email: string;
  phone: string;
  app_metadata: {
    provider: string;
    providers: Array<string>;
  };
  user_metadata: {
    name: string;
  };
  role: string;
  aal: string;
  amr: Array<{
    method: string;
    timestamp: number;
  }>;
  session_id: string;
}
