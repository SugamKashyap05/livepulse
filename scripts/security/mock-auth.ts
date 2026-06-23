import { SignJWT } from "jose";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

export async function getMockAuthHeaders(): Promise<Record<string, string>> {
  const secret = process.env.NEON_AUTH_COOKIE_SECRET || "development-neon-auth-cookie-secret-32";
  const jwt = await new SignJWT({ sub: "test-user-id" })
    .setProtectedHeader({ alg: "HS256" })
    .sign(new TextEncoder().encode(secret));

  const adminSecret = process.env.ADMIN_SECRET || "Kuki@7816";

  return {
    "Cookie": `__Secure-neon-auth.local.session_data=${jwt}`,
    "Authorization": `Bearer ${adminSecret}`,
    "Content-Type": "application/json"
  };
}
