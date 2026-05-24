import { NextResponse } from "next/server";

import { getCachedUsageDashboard, refreshUsageDashboardCache } from "@/lib/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const forceRefresh = url.searchParams.get("refresh") === "1";
  const usage = forceRefresh ? await refreshUsageDashboardCache() : await getCachedUsageDashboard();

  return NextResponse.json(usage);
}
