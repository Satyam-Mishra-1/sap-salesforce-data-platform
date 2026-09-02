import { NextResponse } from "next/server";
import { query } from "@/lib/databricks";

// No caching — this endpoint must always reach Databricks
export const revalidate = 0;

export async function GET() {
  const start = Date.now();
  try {
    await query("SELECT 1 AS ping");
    return NextResponse.json({
      ok: true,
      latency_ms: Date.now() - start,
      ts: new Date().toISOString(),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message, ts: new Date().toISOString() },
      { status: 500 }
    );
  }
}
