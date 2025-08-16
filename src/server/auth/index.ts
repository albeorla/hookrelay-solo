import NextAuth from "next-auth";
import { cache } from "react";
import { authConfig } from "./config";

const isTestEnv =
  process.env.NODE_ENV === "test" ||
  process.env.VITEST === "true" ||
  process.env.ENABLE_TEST_AUTH === "true";

let auth: ReturnType<typeof NextAuth>["auth"];
let handlers: ReturnType<typeof NextAuth>["handlers"];
let signIn: ReturnType<typeof NextAuth>["signIn"];
let signOut: ReturnType<typeof NextAuth>["signOut"];

if (isTestEnv) {
  // Lightweight stubs for tests; avoids NextAuth initialization in Vitest
  auth = (async () => ({
    user: {
      id: "test-user",
      name: "Test User",
      email: "admin@example.com",
      roles: ["ADMIN", "USER"],
    },
    expires: new Date(Date.now() + 60_000).toISOString(),
  })) as unknown as ReturnType<typeof NextAuth>["auth"];

  handlers = {} as ReturnType<typeof NextAuth>["handlers"];
  signIn = (async () => undefined) as unknown as ReturnType<
    typeof NextAuth
  >["signIn"];
  signOut = (async () => undefined) as unknown as ReturnType<
    typeof NextAuth
  >["signOut"];
} else {
  const {
    auth: uncachedAuth,
    handlers: hh,
    signIn: si,
    signOut: so,
  } = NextAuth(authConfig);
  auth = cache(uncachedAuth);
  handlers = hh;
  signIn = si;
  signOut = so;
}

export { auth, handlers, signIn, signOut };
