import { NextRequest, NextResponse } from "next/server";
import { safeStringEqual } from "@/lib/safe-compare";

export function proxy(request: NextRequest) {
  const configuredToken = process.env.API_TOKEN;
  if (!configuredToken) {
    return NextResponse.json(
      { error: "API access is unavailable because API_TOKEN is not configured." },
      { status: 503 },
    );
  }

  const authorization = request.headers.get("authorization") ?? "";
  const suppliedToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";

  if (!safeStringEqual(suppliedToken, configuredToken)) {
    return NextResponse.json({ error: "A valid bearer token is required." }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
