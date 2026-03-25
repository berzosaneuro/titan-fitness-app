import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  if (path.startsWith("/i/") || path.startsWith("/r/")) {
    return NextResponse.next();
  }

  if (path === "/register") {
    if (process.env.ALLOW_OPEN_REGISTER === "true") {
      return NextResponse.next();
    }
    const invite = req.cookies.get("anais_invite_code");
    if (!invite?.value) {
      return NextResponse.redirect(new URL("/?access=invite", req.url));
    }
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    const signIn = new URL("/login", req.url);
    signIn.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(signIn);
  }

  if (path.startsWith("/admin") && token.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/appointments/:path*",
    "/content/:path*",
    "/chat/:path*",
    "/profile/:path*",
    "/admin/:path*",
    "/register",
    "/i/:path*",
    "/r/:path*",
  ],
};
