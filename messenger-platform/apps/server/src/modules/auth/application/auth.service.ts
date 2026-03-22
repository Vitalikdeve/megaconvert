import bcrypt from "bcrypt";

import type { AuthUserProfile, AuthUserRepository } from "../domain/auth-user.entity";

const toDisplayName = (username: string) =>
  username
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

export class AuthService {
  constructor(private readonly repository: AuthUserRepository) {}

  async register(credentials: {
    username: string;
    password: string;
  }) {
    const passwordHash = await bcrypt.hash(credentials.password, 12);

    const user = await this.repository.create({
      username: credentials.username,
      displayName: toDisplayName(credentials.username),
      passwordHash
    });

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      createdAt: user.createdAt
    } satisfies AuthUserProfile;
  }

  async login(credentials: { username: string; password: string }) {
    const user = await this.repository.findByUsername(credentials.username);

    if (!user) {
      return null;
    }

    const isValid = await bcrypt.compare(credentials.password, user.passwordHash);

    if (!isValid) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      createdAt: user.createdAt
    } satisfies AuthUserProfile;
  }

  listUsers(query?: string) {
    return this.repository.list(query);
  }
}
