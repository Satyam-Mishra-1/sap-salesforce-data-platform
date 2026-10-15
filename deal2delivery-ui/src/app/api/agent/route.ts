import { NextResponse } from "next/server";
import OpenAI from "openai";
import { query as dbQuery } from "@/lib/databricks";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const HOST       = process.env.DATABRICKS_HOST!;
const TOKEN      = process.env.DATABRICKS_TOKEN!;
const HTTP_PATH  = process.env.DATABRICKS_HTTP_PATH!;
const WH_ID      = HTTP_PATH?.split("/").pop()!;
const SPACE_ID   = process.env.DATABRICKS_GENIE_SPACE_ID ?? "";
const JOB_ID     = process.env.DATABRICKS_JOB_ID_GOLD_VIEWS ?? "";
const DB_HEADERS = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

// Display name → SAP material number (for alert SQL queries against the real table)
const DISPLAY_TO_MATNR: Record<string, string> = {
  'Business Laptop Pro 15"':    "P100001",
  'Ultrabook Slim 13"':         "P100002",
  "Workstation Desktop i9":     "P100003",
  'All-in-One Desktop 27"':     "P100004",
  "Smartphone Pro Max 256GB":   "P100005",
  'Business Tablet 11"':        "P100006",
  "Wireless Earbuds Pro":       "P100007",
  "Smartwatch Series 5":        "P100008",
  "USB-C Hub 10-Port":          "P100009",
  "Mechanical Keyboard Wireless":"P100010",
  "4K USB Webcam Pro":          "P100011",
  "Laptop Stand & Dock":        "P100012",
};

const SYSTEM_PROMPT = `You are NovaTech AI, the intelligent operations assistant for NovaTech Electronics — a B2B electronics retailer.

WHAT YOU CAN DO (use the provided tools):
1. Query live business data — customers, revenue, inventory gaps, demand forecasts, churn risk scores
2. Flag a customer for urgent sales outreach
3. Escalate a customer to the high-priority watch list
4. Schedule a follow-up call with a customer
5. Create a stock reorder request for any product (laptops, phones, accessories, etc.)
6. Set a custom stock alert threshold for any SKU
7. Mark a product as critical priority for supply chain
8. Request a demand forecast pipeline refresh

WHAT YOU CANNOT DO:
- Send emails, SMS, or push notifications
- Modify customer records, prices, or historical data
- Access Salesforce or SAP UIs directly
- Make payments or purchase orders in external systems
- Delete or rollback data

WHEN ASKED SOMETHING OUTSIDE YOUR CAPABILITIES:
Respond with: "I'm not able to [what they asked] directly. However, I can [most relevant alternative from your tools] — would you like me to do that instead?"

Be specific. If they ask to "email a customer", say you can't send emails but you can flag them for outreach so the sales team follows up. If they ask to "change a price", say you can't modify prices but you can flag the product for review.

Keep responses short and action-oriented. For actions, confirm with: what was done, the key detail (customer name / product name), and timestamp. For queries, let the data speak.

CLARIFICATION RULE — ONE TURN ONLY:
If you need more information before calling a tool, ask for ALL missing fields in a single message. Never ask across multiple turns. For schedule_followup specifically, if the contact person, reason, or date is missing, ask for all three at once in this exact format:
"To schedule this follow-up I need a few details:
• **Contact person** at the client (name and role)
• **Purpose** of the call (e.g. renewal discussion, escalation review)
• **Date** (e.g. 2026-06-10 or 'next Monday')
Once you provide these I'll schedule it immediately."
Then call the tool with what the user provides — do not ask again.`;

// ── Tool definitions ──────────────────────────────────────────────────────
const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "query_data",
      description: "Answer any question about NovaTech customers, revenue, inventory levels, demand forecasts, churn risk, or product trends using live Databricks data.",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string", description: "The natural language question to answer" },
        },
        required: ["question"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "flag_customer",
      description: "Flag a customer for urgent sales outreach. Use when someone says 'flag', 'mark for follow-up', 'reach out to', or 'contact' a customer.",
      parameters: {
        type: "object",
        properties: {
          customer_name: { type: "string" },
          reason:        { type: "string", description: "Why they need outreach" },
          priority:      { type: "string", enum: ["High", "Medium"], description: "Urgency level" },
        },
        required: ["customer_name", "reason", "priority"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "escalate_customer",
      description: "Escalate a customer to the high-priority watch list. Use when someone is at serious churn risk or has unresolved critical issues.",
      parameters: {
        type: "object",
        properties: {
          customer_name: { type: "string" },
          notes:         { type: "string", description: "Escalation reason and context" },
        },
        required: ["customer_name", "notes"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "schedule_followup",
      description: "Schedule a follow-up call or meeting with a customer. Requires customer name, contact person at the client, date, and reason. If any are missing, ask for all three in one message.",
      parameters: {
        type: "object",
        properties: {
          customer_name:   { type: "string", description: "Company / account name" },
          contact_person:  { type: "string", description: "Name and role of the contact at the client company" },
          follow_up_date:  { type: "string", description: "ISO date string e.g. 2026-06-15" },
          notes:           { type: "string", description: "Purpose / reason for the follow-up call" },
        },
        required: ["customer_name", "contact_person", "follow_up_date", "notes"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_reorder",
      description: "Create a stock reorder request for a product that is running low.",
      parameters: {
        type: "object",
        properties: {
          product_name: { type: "string" },
          quantity:     { type: "number", description: "Number of units to reorder" },
          urgency:      { type: "string", enum: ["Critical", "Standard"] },
        },
        required: ["product_name", "quantity", "urgency"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_stock_alert",
      description: "Set a custom stock alert so the inventory page flags the product when stock drops below a threshold.",
      parameters: {
        type: "object",
        properties: {
          product_name: { type: "string" },
          threshold:    { type: "number", description: "Alert when stock falls below this unit count" },
        },
        required: ["product_name", "threshold"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mark_sku_critical",
      description: "Mark a product SKU as critical priority for the supply chain team.",
      parameters: {
        type: "object",
        properties: {
          product_name: { type: "string" },
          reason:       { type: "string" },
        },
        required: ["product_name", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "trigger_refresh",
      description: "Request a demand forecast and gold views pipeline refresh. Use when asked to refresh data, re-run forecasts, or update predictions.",
      parameters: {
        type: "object",
        properties: {
          pipeline: { type: "string", enum: ["forecast", "gold_views", "full"] },
        },
        required: ["pipeline"],
      },
    },
  },
];

// ── Fix column names Genie commonly hallucinates ─────────────────────────
const COLUMN_FIXES: Record<string, string> = {
  negative_interactions_count:  "negative_interactions",
  positive_interactions_count:  "positive_interactions",
  escalated_interactions_count: "escalated_interactions",
  total_interactions_count:     "total_interactions",
  churn_probability_score:      "churn_probability",
  churn_score_value:            "churn_probability",
  risk_score:                   "churn_probability",
  days_inactive:                "days_since_last_order",
  days_since_last_activity:     "days_since_last_order",
  open_cases:                   "open_case_count",
  total_open_cases:             "open_case_count",
  sentiment_score:              "avg_sentiment_score",
  coverage_percentage:          "coverage_pct",
  stock_coverage_pct:           "coverage_pct",
  forecast_quantity:            "forecast_qty_6m",
  forecast_qty:                 "forecast_qty_6m",
};

function sanitizeSQL(sql: string): string {
  let out = sql;
  for (const [bad, good] of Object.entries(COLUMN_FIXES)) {
    out = out.replace(new RegExp(`\\b${bad}\\b`, "gi"), good);
  }
  // Also replace any display product names that leaked into the SQL
  for (const [display, sap] of Object.entries(DISPLAY_TO_SAP)) {
    out = out.replace(new RegExp(display.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), sap);
  }
  return out;
}

// Frontend display names → SAP names stored in the Silver/Gold tables
const DISPLAY_TO_SAP: Record<string, string> = {
  'Business Laptop Pro':          'Cloud Storage - 1TB',
  'Ultrabook Slim':               'Cloud Compute - VM Instance',
  'Workstation Desktop':          'Database Service - Standard',
  'All-in-One Desktop':           'Database Service - Premium',
  'Smartphone Pro Max':           'API Management Platform',
  'Business Tablet':              'Security Suite - Enterprise',
  'Wireless Earbuds':             'Analytics Platform',
  'Smartwatch':                   'ML Model Training Credits',
  'USB-C Hub':                    'Professional Services - Consulting',
  'Mechanical Keyboard':          'Support Contract - Premium',
  'Webcam':                       'Data Integration Tool',
  'Laptop Stand':                 'Backup & Recovery Service',
};

// Translate user-facing product names to SAP names before Genie sees them
function translateProductNames(text: string): string {
  let out = text;
  for (const [display, sap] of Object.entries(DISPLAY_TO_SAP)) {
    out = out.replace(
      new RegExp(display.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"),
      sap
    );
  }
  return out;
}

// Translate SAP names back to display names in Genie's response text
function translateToDisplay(text: string): string {
  let out = text;
  for (const [display, sap] of Object.entries(DISPLAY_TO_SAP)) {
    out = out.replace(
      new RegExp(sap.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"),
      display
    );
  }
  return out;
}

// ── Genie query ───────────────────────────────────────────────────────────
async function queryGenie(question: string) {
  if (!SPACE_ID) throw new Error("DATABRICKS_GENIE_SPACE_ID is not configured.");

  const startMs = Date.now();
  const base    = `https://${HOST}/api/2.0/genie/spaces/${SPACE_ID}`;
  const headers = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

  // Translate frontend display names → SAP names so Genie queries the right data
  const translatedQuestion = translateProductNames(question);

  // Explicit SELECT instruction prevents Genie from generating DESCRIBE queries
  const content = `Using the available gold views and tables, answer this business question with a SELECT query that returns rows: ${translatedQuestion}`;

  // 1. Start conversation
  const startRes = await fetch(`${base}/start-conversation`, {
    method: "POST", headers,
    body: JSON.stringify({ content }),
  });
  if (!startRes.ok) throw new Error(`Genie start failed: ${startRes.status}`);
  const startData   = await startRes.json();
  const conversation_id = startData.conversation_id;
  // message_id can be at root or nested under message object
  const message_id  = startData.message_id ?? startData.message?.id;

  // 2. Poll until complete (30s max)
  let status = "STARTING";
  let pollMsg: Record<string, unknown> = {};
  for (let i = 0; i < 15 && status !== "COMPLETED" && status !== "FAILED"; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const pollRes = await fetch(
      `${base}/conversations/${conversation_id}/messages/${message_id}`,
      { headers }
    );
    if (!pollRes.ok) break;
    pollMsg = await pollRes.json();
    // Status can live at root or inside a nested message object
    status = (
      pollMsg.status ??
      (pollMsg.message as Record<string, unknown>)?.status ??
      status
    ) as string;
  }

  if (status !== "COMPLETED") {
    throw new Error("Genie did not complete in time. Try a simpler question.");
  }

  const attachments = (pollMsg.attachments ?? []) as Record<string, unknown>[];

  // Genie can return multiple attachments — one with query, one with text summary
  const queryAtt = attachments.find((a) => a.query);
  const textAtt  = attachments.find((a) => a.text);

  const queryObj  = queryAtt?.query as Record<string, string> | undefined;
  const sql       = queryObj?.query ?? "";
  const rawSummary = (textAtt?.text as Record<string, string>)?.content
                  ?? queryObj?.description
                  ?? "";
  // Replace SAP product names with display names in the response text
  const summary = translateToDisplay(rawSummary);

  // 3. Execute the SQL ourselves using the existing Statement API —
  //    more reliable than Genie's query-result endpoint whose shape varies.
  let rows: Record<string, string>[] = [];
  let columns: string[] = [];

  if (sql && !sql.trim().toUpperCase().startsWith("DESCRIBE")) {
    const fixedSql = sanitizeSQL(sql);
    try {
      const rawRows = await dbQuery<Record<string, string>>(fixedSql);
      rows    = rawRows.slice(0, 50); // cap at 50 rows for chat UI
      columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    } catch {
      // Non-fatal — summary still shows even if rows fail
    }
  }

  // Log trace asynchronously — does not block the response
  logUITrace({
    traceName: "genie_interaction",
    tool:      "query_data",
    inputs:    { question },   // original user question (not translated)
    outputs:   { response: summary, generated_sql: sql, row_count: rows.length },
    startMs,
  }).catch(() => {});

  return { sql, summary, rows, columns };
}

// ── MLflow trace logger ───────────────────────────────────────────────────
// Experiment ID from: /ml/experiments/1844831334536680/traces
const MLFLOW_EXPERIMENT_ID = "1844831334536680";

interface TraceParams {
  traceName: string;                   // e.g. "genie_interaction" or "flag_customer"
  inputs:    Record<string, unknown>;  // question / action args
  outputs:   Record<string, unknown>;  // response / result / sql
  tool:      string;
  startMs:   number;
}

async function logUITrace(params: TraceParams) {
  const inputs  = JSON.stringify(params.inputs);
  const outputs = JSON.stringify(params.outputs);
  const id      = crypto.randomUUID();
  const inp     = inputs.replace(/'/g, "\\'").slice(0, 2000);
  const out     = outputs.replace(/'/g, "\\'").slice(0, 4000);

  // Write to Delta table — the log_ui_traces Databricks job reads this every
  // 3 minutes and logs proper MLflow traces via mlflow.start_span()
  try {
    // Name columns explicitly — table may have been created with a different
    // column count by an earlier schema; named INSERT is always safe
    await dbQuery(`
      INSERT INTO \`demand-forecast\`.gold_pres.genie_ui_traces
        (trace_id, question, generated_sql, response, created_at)
      VALUES (
        '${id}', '${params.tool}', '${inp}', '${out}', current_timestamp()
      )
    `);
  } catch { /* silent */ }
}

// ── Table setup (idempotent, errors swallowed — table may already exist) ──
async function ensureTables() {
  const stmts = [
    `CREATE TABLE IF NOT EXISTS \`demand-forecast\`.gold_pres.customer_actions (
      action_id STRING, customer_name STRING, action_type STRING,
      priority STRING, notes STRING, follow_up_date STRING,
      created_at TIMESTAMP, status STRING
    ) USING DELTA`,
    `CREATE TABLE IF NOT EXISTS \`demand-forecast\`.gold_pres.stock_requests (
      request_id STRING, product_name STRING, request_type STRING,
      quantity BIGINT, threshold BIGINT, urgency STRING,
      notes STRING, created_at TIMESTAMP, status STRING
    ) USING DELTA`,
    `CREATE TABLE IF NOT EXISTS \`demand-forecast\`.gold_pres.pipeline_requests (
      request_id STRING, pipeline_name STRING,
      requested_at TIMESTAMP, status STRING, job_run_id BIGINT
    ) USING DELTA`,
    `CREATE TABLE IF NOT EXISTS \`demand-forecast\`.gold_pres.genie_ui_traces (
      trace_id STRING, tool STRING,
      inputs STRING, outputs STRING,
      created_at TIMESTAMP
    ) USING DELTA`,
  ];
  for (const s of stmts) {
    try { await dbQuery(s); } catch { /* already exists */ }
  }
}

// ── Action handlers — all use dbQuery() which throws on any non-SUCCEEDED state
async function handleFlagCustomer(args: Record<string, string>) {
  const id = crypto.randomUUID();
  const name   = args.customer_name.replace(/'/g, "\\'");
  const reason = args.reason.replace(/'/g, "\\'");
  await dbQuery(`
    INSERT INTO \`demand-forecast\`.gold_pres.customer_actions VALUES (
      '${id}', '${name}', 'FLAG_OUTREACH',
      '${args.priority}', '${reason}', NULL,
      current_timestamp(), 'Open'
    )`);
  return `✓ **${args.customer_name}** flagged for **${args.priority} priority** outreach.\n\nReason: ${args.reason}`;
}

async function handleEscalate(args: Record<string, string>) {
  const id    = crypto.randomUUID();
  const name  = args.customer_name.replace(/'/g, "\\'");
  const notes = args.notes.replace(/'/g, "\\'");
  await dbQuery(`
    INSERT INTO \`demand-forecast\`.gold_pres.customer_actions VALUES (
      '${id}', '${name}', 'ESCALATE',
      'High', '${notes}', NULL,
      current_timestamp(), 'Open'
    )`);
  return `✓ **${args.customer_name}** escalated to the **high-priority watch list**.\n\nNotes: ${args.notes}`;
}

async function handleScheduleFollowup(args: Record<string, string>) {
  const id      = crypto.randomUUID();
  const name    = args.customer_name.replace(/'/g, "\\'");
  const contact = (args.contact_person ?? "").replace(/'/g, "\\'");
  const notes   = (args.notes ?? "Follow-up call").replace(/'/g, "\\'");
  const fullNotes = contact ? `Contact: ${contact} — ${notes}` : notes;
  const safeNotes = fullNotes.replace(/'/g, "\\'");
  await dbQuery(`
    INSERT INTO \`demand-forecast\`.gold_pres.customer_actions VALUES (
      '${id}', '${name}', 'SCHEDULE_FOLLOWUP',
      'Medium', '${safeNotes}', '${args.follow_up_date}',
      current_timestamp(), 'Open'
    )`);
  return `✓ Follow-up with **${args.customer_name}** scheduled for **${args.follow_up_date}**.\n\n**Contact:** ${args.contact_person ?? "—"}\n**Purpose:** ${args.notes ?? "Follow-up call"}`;
}

async function handleReorder(args: { product_name: string; quantity: number; urgency: string }) {
  const id   = crypto.randomUUID();
  const name = args.product_name.replace(/'/g, "\\'");
  await dbQuery(`
    INSERT INTO \`demand-forecast\`.gold_pres.stock_requests VALUES (
      '${id}', '${name}', 'REORDER',
      ${args.quantity}, NULL, '${args.urgency}',
      'Reorder requested via NovaTech AI', current_timestamp(), 'Pending'
    )`);
  return `✓ Reorder request created: **${args.quantity} units** of **${args.product_name}** (${args.urgency} urgency).`;
}

async function handleStockAlert(args: { product_name: string; threshold: number }) {
  const { product_name, threshold } = args;

  // ── 1. Create real Databricks SQL Alert ──────────────────────────────
  let alertId   = "";
  let alertUrl  = "";
  let alertNote = "";

  try {
    // 1. Get a SQL data source ID
    const dsRes = await fetch(`https://${HOST}/api/2.0/preview/sql/data_sources`, { headers: DB_HEADERS });
    if (!dsRes.ok) throw new Error(`Data sources: HTTP ${dsRes.status}`);
    const dsList = await dsRes.json() as { id: string; name: string }[];
    const dataSourceId = Array.isArray(dsList) ? dsList[0]?.id : null;
    if (!dataSourceId) throw new Error("No SQL data source found on this workspace");

    // 2. Build WHERE clause using material number when known
    const matnr = DISPLAY_TO_MATNR[product_name];
    const where = matnr
      ? `material_number = '${matnr}'`
      : `product_description LIKE '%${product_name.replace(/'/g, "\\'").slice(0, 30)}%'`;

    // 3. Create saved query
    const qRes = await fetch(`https://${HOST}/api/2.0/preview/sql/queries`, {
      method: "POST", headers: DB_HEADERS,
      body: JSON.stringify({
        name: `NovaTech AI — Stock Level: ${product_name}`,
        query: `SELECT CAST(current_stock AS DOUBLE) AS current_stock\nFROM \`demand-forecast\`.gold_pres.gold_demand_vs_supply_gap\nWHERE ${where}`,
        data_source_id: dataSourceId,
      }),
    });
    if (!qRes.ok) {
      const body = await qRes.text();
      throw new Error(`Query creation HTTP ${qRes.status}: ${body}`);
    }
    const qData = await qRes.json() as { id?: string };
    if (!qData.id) throw new Error(`Query created but returned no ID: ${JSON.stringify(qData)}`);

    // 4. Create alert — use LESS_THAN enum (newer API) with < symbol fallback
    const alertPayload = {
      name: `Low Stock: ${product_name} (below ${threshold} units)`,
      query_id: qData.id,
      options: {
        column: "current_stock",
        op:     "<",
        value:  String(threshold),
        muted:  false,
      },
    };
    const aRes = await fetch(`https://${HOST}/api/2.0/preview/sql/alerts`, {
      method: "POST", headers: DB_HEADERS,
      body: JSON.stringify(alertPayload),
    });
    if (!aRes.ok) {
      const body = await aRes.text();
      throw new Error(`Alert creation HTTP ${aRes.status}: ${body}`);
    }
    const aData = await aRes.json() as { id?: string };
    if (!aData.id) throw new Error(`Alert returned no ID: ${JSON.stringify(aData)}`);

    alertId   = aData.id;
    alertUrl  = `https://${HOST}/sql/alerts/${alertId}`;
    alertNote = `\n\n[View alert in Databricks →](${alertUrl})`;
  } catch (e) {
    alertNote = `\n\n_Databricks alert could not be created: ${(e as Error).message}. Record saved to Actions feed._`;
  }

  // ── 2. Always write to Delta table for the Actions feed ──────────────
  const id   = crypto.randomUUID();
  const name = product_name.replace(/'/g, "\\'");
  await dbQuery(`
    INSERT INTO \`demand-forecast\`.gold_pres.stock_requests VALUES (
      '${id}', '${name}', 'ALERT_THRESHOLD',
      NULL, ${threshold}, 'Standard',
      '${alertId ? `Databricks alert ${alertId}` : "Alert set via NovaTech AI"}',
      current_timestamp(), 'Active'
    )`);

  return `✓ Stock alert created for **${product_name}**: triggers when stock drops below **${threshold} units**.${alertNote}`;
}

async function handleMarkCritical(args: Record<string, string>) {
  const id     = crypto.randomUUID();
  const name   = args.product_name.replace(/'/g, "\\'");
  const reason = args.reason.replace(/'/g, "\\'");
  await dbQuery(`
    INSERT INTO \`demand-forecast\`.gold_pres.stock_requests VALUES (
      '${id}', '${name}', 'CRITICAL_FLAG',
      NULL, NULL, 'Critical',
      '${reason}', current_timestamp(), 'Active'
    )`);
  return `✓ **${args.product_name}** marked as **critical priority** for the supply chain team.`;
}

async function handleTriggerRefresh(args: { pipeline: string }) {
  if (JOB_ID) {
    try {
      const res = await fetch(`https://${HOST}/api/2.1/jobs/run-now`, {
        method: "POST",
        headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: Number(JOB_ID) }),
      });
      const data = await res.json();
      return `✓ **${args.pipeline}** refresh triggered. Databricks job run **#${data.run_id}** started — results live in ~5 minutes.`;
    } catch { /* fall through */ }
  }
  const id = crypto.randomUUID();
  await dbQuery(`
    INSERT INTO \`demand-forecast\`.gold_pres.pipeline_requests VALUES (
      '${id}', '${args.pipeline}', current_timestamp(), 'Requested', NULL
    )`);
  return `✓ **${args.pipeline}** refresh requested and logged. The pipeline will pick this up on its next scheduled run.`;
}

// ── Main handler ──────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const { message, history = [] } = await req.json();

    await ensureTables();

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history,
      { role: "user", content: message },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      tools: TOOLS,
      tool_choice: "auto",
      temperature: 0.2,
    });

    const choice = completion.choices[0];

    // No tool call — model responded in text (capability redirect or greeting)
    if (!choice.message.tool_calls?.length) {
      return NextResponse.json({
        type: "text",
        content: choice.message.content ?? "I'm not sure how to help with that.",
        assistantMessage: choice.message,
      });
    }

    const call     = choice.message.tool_calls[0];
    const toolName = call.function.name;
    const args     = JSON.parse(call.function.arguments);

    if (toolName === "query_data") {
      const { sql, summary, rows, columns } = await queryGenie(args.question);
      return NextResponse.json({ type: "query", sql, summary, rows, columns, assistantMessage: choice.message });
    }

    // Action tools
    const actionStartMs = Date.now();
    const actionResult =
      toolName === "flag_customer"     ? await handleFlagCustomer(args)    :
      toolName === "escalate_customer" ? await handleEscalate(args)        :
      toolName === "schedule_followup" ? await handleScheduleFollowup(args):
      toolName === "create_reorder"    ? await handleReorder(args)         :
      toolName === "set_stock_alert"   ? await handleStockAlert(args)      :
      toolName === "mark_sku_critical" ? await handleMarkCritical(args)    :
      toolName === "trigger_refresh"   ? await handleTriggerRefresh(args)  :
      "Unknown action.";

    // Trace every action tool call so it appears in the MLflow experiments UI
    logUITrace({
      traceName: toolName,
      tool:      toolName,
      inputs:    args,
      outputs:   { result: typeof actionResult === "string" ? actionResult : String(actionResult) },
      startMs:   actionStartMs,
    }).catch(() => {});

    return NextResponse.json({
      type: "action",
      tool: toolName,
      content: actionResult,
      assistantMessage: choice.message,
    });

  } catch (e: unknown) {
    return NextResponse.json({ type: "error", content: (e as Error).message }, { status: 500 });
  }
}
