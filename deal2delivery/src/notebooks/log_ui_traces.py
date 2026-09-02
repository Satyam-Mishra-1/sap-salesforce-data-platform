# Databricks notebook source
# MAGIC %md
# MAGIC ## Log UI Traces to MLflow
# MAGIC Reads new rows from the genie_ui_traces Delta table (written by the Next.js app)
# MAGIC and logs each one as a proper MLflow trace using mlflow.start_span().
# MAGIC Runs on a 3-minute schedule so UI interactions appear in the Traces tab promptly.

# COMMAND ----------

# MAGIC %sh
# MAGIC pip install "mlflow[genai]" databricks-sdk "typing_extensions>=4.12.0"

# COMMAND ----------

import mlflow
import json
from databricks.sdk import WorkspaceClient

w = WorkspaceClient()

SPACE_ID       = "01f157352a661fb4a3eb291a0b3c2ed8"
EXPERIMENT_NAME = f"/Users/{w.current_user.me().user_name}/genie_eval"

mlflow.set_experiment(EXPERIMENT_NAME)

# COMMAND ----------

# Collect already-traced UI trace IDs to avoid duplicates across runs
experiment = mlflow.get_experiment_by_name(EXPERIMENT_NAME)
existing_traces = mlflow.search_traces(
    locations=[experiment.experiment_id], return_type="list"
)
already_traced = {
    t.info.tags.get("message_id")
    for t in existing_traces
    if t.info.tags.get("message_id")
}
already_ui_traced = {
    t.info.tags.get("ui_trace_id")
    for t in existing_traces
    if t.info.tags.get("ui_trace_id")
}

# COMMAND ----------

# Pull every Genie-UI conversation from the space and log as MLflow traces
conversations = w.genie.list_conversations(space_id=SPACE_ID, include_all=True)

genie_logged = 0
for convo in conversations.conversations or []:
    messages = w.genie.list_conversation_messages(
        space_id=SPACE_ID, conversation_id=convo.conversation_id
    )
    for msg in messages.messages or []:
        if not msg.content:
            continue
        if msg.message_id in already_traced:
            continue

        attachments = msg.attachments or []
        sql_att  = next((a for a in attachments if a.query), None)
        text_att = next((a for a in attachments if a.text),  None)

        with mlflow.start_span(name="genie_interaction") as span:
            span.set_inputs({"question": msg.content})
            span.set_outputs({
                "response":      text_att.text.content if text_att else None,
                "generated_sql": sql_att.query.query   if sql_att  else None,
                "error":         str(msg.error) if msg.error else None,
            })
            mlflow.update_current_trace(tags={"message_id": msg.message_id})

        genie_logged += 1

print(f"Logged {genie_logged} new Genie-UI traces")

# COMMAND ----------

# Read new rows from genie_ui_traces Delta table and log as MLflow traces
# This captures every query/action made through the NovaTech AI (Next.js) tab
try:
    ui_rows = spark.sql("""
        SELECT trace_id, tool, inputs, outputs, created_at
        FROM `demand-forecast`.gold_pres.genie_ui_traces
        ORDER BY created_at DESC
        LIMIT 500
    """).collect()
except Exception as e:
    ui_rows = []
    print(f"genie_ui_traces not yet available: {e}")

ui_logged = 0
for row in ui_rows:
    if row["trace_id"] in already_ui_traced:
        continue
    try:
        inp = json.loads(row["inputs"])  if row["inputs"]  else {}
        out = json.loads(row["outputs"]) if row["outputs"] else {}
    except Exception:
        inp = {"raw": str(row["inputs"])}
        out = {"raw": str(row["outputs"])}

    with mlflow.start_span(name=row["tool"]) as span:
        span.set_inputs(inp)
        span.set_outputs(out)
        mlflow.update_current_trace(tags={
            "ui_trace_id": row["trace_id"],
            "source":      "novatech_ai_ui",
            "tool":        row["tool"],
        })
    ui_logged += 1

print(f"Logged {ui_logged} new UI traces from genie_ui_traces Delta table")
print(f"Total new traces this run: {genie_logged + ui_logged}")
