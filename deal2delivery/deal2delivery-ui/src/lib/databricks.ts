const HOST      = process.env.DATABRICKS_HOST!;
const TOKEN     = process.env.DATABRICKS_TOKEN!;
const HTTP_PATH = process.env.DATABRICKS_HTTP_PATH!;
const WH_ID     = HTTP_PATH?.split("/").pop()!;

const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

function toRows<T>(data: { manifest?: { schema?: { columns?: { name: string }[] } }; result?: { data_array?: string[][] } }): T[] {
  const cols: string[] = (data.manifest?.schema?.columns ?? []).map((c) => c.name);
  return (data.result?.data_array ?? []).map((row) =>
    Object.fromEntries(cols.map((col, i) => [col, row[i]])) as T
  );
}

export async function query<T = Record<string, string>>(sql: string): Promise<T[]> {
  // Submit with a 50s wait — covers normal execution
  const res = await fetch(`https://${HOST}/api/2.0/sql/statements`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ warehouse_id: WH_ID, statement: sql, wait_timeout: "50s" }),
    next: { revalidate: 300 },
  });

  if (!res.ok) throw new Error(`Databricks HTTP ${res.status}`);

  const data = await res.json();
  const state: string = data.status?.state ?? "";

  // Query completed immediately
  if (state === "SUCCEEDED") return toRows<T>(data);

  // Hard failure
  if (state === "FAILED" || state === "CANCELED" || state === "CLOSED") {
    throw new Error(data.status?.error?.message ?? `Query ${state}`);
  }

  // Warehouse was cold-starting — state is PENDING or RUNNING, poll up to 3 min
  const statementId: string = data.statement_id;
  if (!statementId) throw new Error("No statement_id returned for polling");

  const deadline = Date.now() + 180_000; // 3 minutes
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 4000));

    const poll = await fetch(`https://${HOST}/api/2.0/sql/statements/${statementId}`, {
      headers: HEADERS,
    });
    if (!poll.ok) throw new Error(`Poll HTTP ${poll.status}`);

    const pd = await poll.json();
    const ps: string = pd.status?.state ?? "";

    if (ps === "SUCCEEDED") return toRows<T>(pd);
    if (ps === "FAILED" || ps === "CANCELED" || ps === "CLOSED") {
      throw new Error(pd.status?.error?.message ?? `Query ${ps}`);
    }
    // Still PENDING/RUNNING — keep polling
  }

  throw new Error("Query timed out after 3 minutes (warehouse cold start)");
}
