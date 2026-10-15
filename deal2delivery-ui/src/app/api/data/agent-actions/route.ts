import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/databricks";

export const revalidate = 0;

// Completed actions are hidden from the feed
const ACTIVE_FILTER = `AND status != 'Complete'`;

export async function GET() {
  try {
    const [customers, stock, pipeline] = await Promise.all([
      query(`SELECT * FROM \`demand-forecast\`.gold_pres.customer_actions
             WHERE 1=1 ${ACTIVE_FILTER}
             ORDER BY created_at DESC LIMIT 50`).catch(() => []),
      query(`SELECT * FROM \`demand-forecast\`.gold_pres.stock_requests
             WHERE 1=1 ${ACTIVE_FILTER}
             ORDER BY created_at DESC LIMIT 50`).catch(() => []),
      query(`SELECT * FROM \`demand-forecast\`.gold_pres.pipeline_requests
             WHERE status != 'Complete'
             ORDER BY requested_at DESC LIMIT 20`).catch(() => []),
    ]);
    return NextResponse.json({ customers, stock, pipeline });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

const TABLE_CONFIG: Record<string, { table: string; idCol: string }> = {
  customer_actions:  { table: "customer_actions",  idCol: "action_id"  },
  stock_requests:    { table: "stock_requests",    idCol: "request_id" },
  pipeline_requests: { table: "pipeline_requests", idCol: "request_id" },
};

export async function PATCH(req: NextRequest) {
  try {
    const { id, table, status } = await req.json() as { id: string; table: string; status: string };

    const cfg = TABLE_CONFIG[table];
    if (!cfg) return NextResponse.json({ error: "Unknown table" }, { status: 400 });

    const safeId     = id.replace(/'/g, "\\'");
    const safeStatus = status.replace(/'/g, "\\'");

    await query(`
      UPDATE \`demand-forecast\`.gold_pres.${cfg.table}
      SET status = '${safeStatus}'
      WHERE ${cfg.idCol} = '${safeId}'
    `);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
