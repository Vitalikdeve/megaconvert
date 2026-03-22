export interface AuthCredentials {
  username: string;
  password: string;
}

export interface AuthSession {
  username: string;
  userId?: string;
  token?: string;
}
