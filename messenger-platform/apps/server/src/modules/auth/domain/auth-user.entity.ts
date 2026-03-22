export interface AuthUserRecord {
  id: string;
  username: string;
  displayName: string;
  passwordHash: string;
  createdAt: string;
}

export interface AuthUserProfile {
  id: string;
  username: string;
  displayName: string;
  createdAt: string;
}

export interface AuthUserRepository {
  create(input: {
    username: string;
    displayName: string;
    passwordHash: string;
  }): Promise<AuthUserRecord>;
  findByUsername(username: string): Promise<AuthUserRecord | null>;
  findById(userId: string): Promise<AuthUserRecord | null>;
  list(query?: string): Promise<AuthUserProfile[]>;
}
