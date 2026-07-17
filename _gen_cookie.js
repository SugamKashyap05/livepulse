const { SignJWT } = require('jose');

async function main() {
  const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET || "development-neon-auth-cookie-secret-32";
  const secret = new TextEncoder().encode(cookieSecret);
  
  const token = await new SignJWT({ 
    user: { id: "test-admin-123", email: "admin@test.com" },
    sub: "test-admin-123" 
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(secret);
    
  console.log(`__Secure-neon-auth.session_data=${token}`);
}
main().catch(console.error);
