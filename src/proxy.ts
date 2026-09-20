import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** localhost и 127.0.0.1 — разные origin, cookie и корзина не общие. Сводим на один хост. */
export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  if (host.toLowerCase().startsWith("localhost:")) {
    const url = request.nextUrl.clone();
    url.hostname = "127.0.0.1";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|suppliers/).*)"],
};
