import jwt from "jsonwebtoken";

export function signSocketToken(payload: { sub: string; role: string }) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET missing");
  return jwt.sign(payload, secret, { expiresIn: "2d" });
}

export function verifySocketToken(token: string): { sub: string; role: string } {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET missing");
  const decoded = jwt.verify(token, secret) as { sub: string; role: string };
  if (!decoded?.sub) throw new Error("Invalid token");
  return { sub: decoded.sub, role: decoded.role ?? "USER" };
}
