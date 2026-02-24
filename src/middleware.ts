import { updateSession } from "@/lib/supabase/middleware";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATH_PREFIXES = ["/login", "/auth/callback", "/invite/"];

export async function middleware(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_DATA_MODE !== "supabase") {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  const isPublicPath = PUBLIC_PATH_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );

  const { response, user } = await updateSession(request);

  if (!user && !isPublicPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && pathname === "/login") {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    return NextResponse.redirect(homeUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
