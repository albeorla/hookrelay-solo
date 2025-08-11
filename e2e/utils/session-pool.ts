import { createTestSession } from "../setup/create-test-session";
import { logger } from "./logger";

interface SessionData {
  sessionToken: string;
  userId: string;
  userEmail: string | null;
  userRole: "USER" | "ADMIN";
}

interface SessionPool {
  sessions: Map<string, SessionData>;
  getSession(role: "USER" | "ADMIN", email?: string): Promise<SessionData>;
  clearPool(): void;
  getPoolSize(): number;
}

class TestSessionPool implements SessionPool {
  sessions = new Map<string, SessionData>();

  async getSession(
    role: "USER" | "ADMIN",
    email?: string,
  ): Promise<SessionData> {
    const key = `${role}-${email || "default"}`;

    // Return cached session if available
    if (this.sessions.has(key)) {
      logger.debug(`📦 Using cached session for ${role} user`);
      return this.sessions.get(key)!;
    }

    // Create new session and cache it
    logger.debug(`🆕 Creating new session for ${role} user`);

    const session = await createTestSession({ role, email });
    this.sessions.set(key, session);

    logger.verbose(
      `✅ Session created and cached for ${role} user (pool size: ${this.sessions.size})`,
    );

    return session;
  }

  clearPool(): void {
    const size = this.sessions.size;
    this.sessions.clear();
    logger.debug(`🧹 Session pool cleared (removed ${size} sessions)`);
  }

  getPoolSize(): number {
    return this.sessions.size;
  }

  // Get pool statistics for debugging
  getPoolStats(): { size: number; sessions: string[] } {
    return {
      size: this.sessions.size,
      sessions: Array.from(this.sessions.keys()),
    };
  }
}

export const sessionPool = new TestSessionPool();
