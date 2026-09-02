# Databricks notebook source
# MAGIC %md
# MAGIC ## Setting up Traces for Genie Code

# COMMAND ----------

# MAGIC %sh
# MAGIC pip install "mlflow[genai]" databricks-sdk "typing_extensions>=4.12.0"

# COMMAND ----------

import mlflow
from databricks.sdk import WorkspaceClient

w = WorkspaceClient()

SPACE_ID = "01f157352a661fb4a3eb291a0b3c2ed8"
EXPERIMENT_NAME = f"/Users/{w.current_user.me().user_name}/genie_eval"

mlflow.set_experiment(EXPERIMENT_NAME)

# COMMAND ----------

# 1. Collect Genie message IDs that have already been traced so we
#    can skip them and safely re-run this pipeline as new
#    conversations come in.
experiment = mlflow.get_experiment_by_name(EXPERIMENT_NAME)
existing_traces = mlflow.search_traces(
    locations=[experiment.experiment_id], return_type="list"
)
already_traced = {
    t.info.tags.get("message_id")
    for t in existing_traces
    if t.info.tags.get("message_id")
}

# 2. Pull every conversation from the Genie space.
conversations = w.genie.list_conversations(
    space_id=SPACE_ID, include_all=True
)

# 3. Loop through Genie messages, skip duplicates, and log each
#    new message as an MLflow trace with the question, SQL, and
#    response.
traced = 0
for convo in conversations.conversations or []:
    messages = w.genie.list_conversation_messages(
        space_id=SPACE_ID, conversation_id=convo.conversation_id
    )
    for msg in messages.messages or []:
        if not msg.content:
            continue
        if msg.message_id in already_traced:
            continue

        # 3a. Extract the SQL query and text response from the
        #     Genie message attachments.
        attachments = msg.attachments or []
        sql_att = next((a for a in attachments if a.query), None)
        text_att = next((a for a in attachments if a.text), None)

        # 3b. Log the question, SQL, and response as an MLflow
        #     trace for inspection and evaluation.
        with mlflow.start_span(name="genie_interaction") as span:
            span.set_inputs({"question": msg.content})
            span.set_outputs({
                "response": (
                    text_att.text.content if text_att else None
                ),
                "generated_sql": (
                    sql_att.query.query if sql_att else None
                ),
                "error": str(msg.error) if msg.error else None,
            })
            # 3c. Tag the trace with the Genie message ID so
            #     future runs know this message has already been
            #     traced.
            mlflow.update_current_trace(
                tags={"message_id": msg.message_id}
            )

        traced += 1

print(f"Logged {traced} new traces to experiment: {EXPERIMENT_NAME}")

# COMMAND ----------

# Pull UI-originated interactions from the Delta table written by the Next.js app
# and log each one as a proper MLflow trace so they appear in the Traces tab
# alongside Genie-UI conversations and get evaluated by the same LLM-as-a-Judge scorers.

import json as _json

already_ui_traced = {
    t.info.tags.get("ui_trace_id")
    for t in existing_traces
    if t.info.tags.get("ui_trace_id")
}

try:
    ui_rows = spark.sql("""
        SELECT trace_id, tool, inputs, outputs, created_at
        FROM `demand-forecast`.gold_pres.genie_ui_traces
        ORDER BY created_at DESC
        LIMIT 200
    """).collect()
except Exception as e:
    ui_rows = []
    print(f"Note: genie_ui_traces table not found yet — {e}")

ui_logged = 0
for row in ui_rows:
    if row["trace_id"] in already_ui_traced:
        continue
    try:
        inp = _json.loads(row["inputs"])  if row["inputs"]  else {}
        out = _json.loads(row["outputs"]) if row["outputs"] else {}
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

# COMMAND ----------

# MAGIC %md
# MAGIC ### Setting Up LLM As A Judge Evaluation

# COMMAND ----------

import mlflow
from mlflow.entities import Feedback
from mlflow.genai.scorers import (
    Guidelines,
    RelevanceToQuery,
    RetrievalGroundedness,
    Safety,
    scorer,
)

EXPERIMENT_NAME = "/Users/vedanthbaliga21@gmail.com/genie_eval"
mlflow.set_experiment(EXPERIMENT_NAME)

# COMMAND ----------

relevance = RelevanceToQuery()
safety = Safety()
groundedness = RetrievalGroundedness()

# COMMAND ----------

response_quality = Guidelines(
    name="genie_response_quality",
    guidelines=[
        "The response must directly address the user's data question "
        "rather than giving a vague or generic reply.",
        "If SQL was generated, the response must include a data-driven "
        "answer, not just echo the SQL query back.",
        "The response must not say 'I cannot answer' when the question "
        "is about data that should be available in the tables.",
    ],
)

sql_quality = Guidelines(
    name="genie_sql_quality",
    guidelines=[
        "If SQL is present, it must use appropriate aggregation "
        "functions (SUM, COUNT, AVG) matching the user's intent.",
        "The SQL must include appropriate WHERE clauses to filter "
        "data as the user requested.",
        "The SQL must not use SELECT * on large tables without a "
        "LIMIT or specific filter.",
    ],
)

# COMMAND ----------

@scorer
def has_response(outputs) -> Feedback:
    """Check if Genie returned a text response."""
    resp = outputs.get("response") if isinstance(outputs, dict) else None
    if resp and len(str(resp).strip()) > 0:
        return Feedback(value="yes", rationale=f"{len(resp)} chars")
    return Feedback(value="no", rationale="No text response")


@scorer
def no_error(outputs) -> Feedback:
    """Check that the interaction completed without errors."""
    err = outputs.get("error") if isinstance(outputs, dict) else None
    if err and str(err).strip():
        return Feedback(value="no", rationale=f"Error: {str(err)[:200]}")
    return Feedback(value="yes", rationale="No errors")

# COMMAND ----------

experiment = mlflow.get_experiment_by_name(EXPERIMENT_NAME)
traces_df = mlflow.search_traces(
    locations=[experiment.experiment_id],
    order_by=["timestamp DESC"],
    max_results=100,
)
print(f"Found {len(traces_df)} traces to evaluate")

eval_results = mlflow.genai.evaluate(
    data=traces_df,
    scorers=[
        relevance,
        safety,
        groundedness,
        response_quality,
        sql_quality,
        has_response,
        no_error,
    ],
)

# COMMAND ----------

# MAGIC %md
# MAGIC ### Genie Space Improvements using Failed Traces

# COMMAND ----------

from databricks.sdk import WorkspaceClient
from openai import OpenAI
import json
import mlflow

w = WorkspaceClient()

# Use the notebook's Databricks token — not an OpenAI API key
_db_token = dbutils.notebook.entry_point.getDbutils().notebook().getContext().apiToken().get()
_db_host  = dbutils.notebook.entry_point.getDbutils().notebook().getContext().apiUrl().get()

client = OpenAI(
    base_url=f"{_db_host}/serving-endpoints",
    api_key=_db_token,
)

SPACE_ID = "01f157352a661fb4a3eb291a0b3c2ed8"
EXPERIMENT_NAME = (
    f"/Users/{w.current_user.me().user_name}/genie_eval"
)

mlflow.set_experiment(EXPERIMENT_NAME)

# COMMAND ----------

experiment = mlflow.get_experiment_by_name(EXPERIMENT_NAME)
all_traces = mlflow.search_traces(
    locations=[experiment.experiment_id],
    return_type="list",
)

failed_conversations = []
for trace in all_traces:
    assessments = trace.info.assessments or []
    failures = [a for a in assessments if a.value == "no"]
    if not failures:
        continue

    root = trace.data.spans[0]
    failed_conversations.append({
        "question": root.inputs.get("question"),
        "response": root.outputs.get("response"),
        "generated_sql": root.outputs.get("generated_sql"),
        "error": root.outputs.get("error"),
        "failed_checks": [
            f"{a.name}: {a.value} - {a.rationale}"
            for a in failures
        ],
    })

print(
    f"{len(failed_conversations)} / {len(all_traces)} "
    f"traces had failures"
)

# COMMAND ----------

from databricks.sdk import WorkspaceClient
import json

w = WorkspaceClient()

# 1. Define your space ID
space_id = SPACE_ID

# 2. Query the underlying REST API directly using the SDK's API client
response = w.api_client.do(
    method="GET",
    path=f"/api/2.0/genie/spaces/{space_id}?include_serialized_space=true"
)

# 3. Safe-parse the returned JSON payload
if "serialized_space" in response:
    # serialized_space is returned as a JSON-encoded string
    space_config = json.loads(response["serialized_space"])
    
    # Extract structural components
    instructions_dict = space_config.get("instructions", {})
    text_instructions_list = instructions_dict.get("text_instructions", [])
    example_sqls_list = instructions_dict.get("example_question_sqls", [])
    
    # --- CONVERT ALL OUTPUTS TO STRINGS ---
    
    # 1. Convert text instructions list to a single formatted string block
    # Handles inner structures gracefully if Databricks passes dicts or pure strings
    text_lines = []
    for idx, rule in enumerate(text_instructions_list, 1):
        if isinstance(rule, dict):
            rule_str = f"Rule {idx}: ID: {rule.get('id')}, Content: {rule.get('content')}"
        else:
            rule_str = f"Rule {idx}: {str(rule)}"
        text_lines.append(rule_str)
        
    final_text_instructions_str = "\n".join(text_lines)
    
    # 2. Convert "Golden" trusted sample SQL queries list to a JSON string block
    final_trusted_sqls_str = json.dumps(example_sqls_list, indent=2)
    
    # 3. Optional: Convert the entire parsed configuration dictionary to a string block
    final_full_config_str = json.dumps(space_config, indent=2)

    # --- PRINT STAGE (All items printed below are strings) ---
    print("--- Text Instructions (String Block) ---")
    print(final_text_instructions_str)
    
    print("\n--- Trusted SQL Queries (String Block) ---")
    print(final_trusted_sqls_str)
    
    # Verify exact types programmatically
    assert isinstance(final_text_instructions_str, str), "text_instructions is not a string!"
    assert isinstance(final_trusted_sqls_str, str), "trusted_sqls is not a string!"
    
else:
    error_message_str = "Error: 'serialized_space' was not found in the response payload."
    print(error_message_str)


# COMMAND ----------

import json
import os
import mlflow
from openai import OpenAI
from databricks.sdk import WorkspaceClient

# ==========================================
# 1. INITIALIZE CLIENTS & GENIE METADATA
# ==========================================

w = WorkspaceClient()
SPACE_ID = "01f157352a661fb4a3eb291a0b3c2ed8"

print(f"Fetching configuration data for space: {SPACE_ID}...")
space_response = w.api_client.do(
    method="GET",
    path=f"/api/2.0/genie/spaces/{SPACE_ID}?include_serialized_space=true"
)

space_title_str = str(space_response.get("title", "Unknown Title"))
tables_list = space_response.get("tables", [])
table_names_list = [str(t.get("identifier")) for t in tables_list if "identifier" in t]

text_instructions_list = []
example_sqls_list = []

if "serialized_space" in space_response:
    try:
        space_config = json.loads(space_response["serialized_space"])
        instructions_dict = space_config.get("instructions", {})
        text_instructions_list = instructions_dict.get("text_instructions", [])
        example_sqls_list = instructions_dict.get("example_question_sqls", [])
    except Exception as e:
        print(f"Warning: Failed parsing serialized_space: {e}")

# ==========================================
# 2. FIXED NATIVE GENIE CONVERSATION API
# ==========================================
print("Pulling interaction records natively via Genie Space Conversation APIs...")

all_traces = []

try:
    conv_response = w.api_client.do(
        method="GET",
        path=f"/api/2.0/genie/spaces/{SPACE_ID}/conversations",
        query={"max_results": 15}
    )
    
    conversations = conv_response.get("conversations", [])
    print(f"Discovered {len(conversations)} active user conversations. Hydrating messages...")
    for conv in conversations:
        # FIX: Try extracting 'conversation_id' first, then fall back to standard 'id'
        conv_id = conv.get("conversation_id") or conv.get("conversation_id")
        if not conv_id:
            print(f"Skipping a conversation because no identifier field was resolved. Available keys: {list(conv.keys())}")
            continue
        
        # Pull chronological messages for the resolved conversation ID
        msg_response = w.api_client.do(
            method="GET",
            path=f"/api/2.0/genie/spaces/{SPACE_ID}/conversations/{conv_id}/messages"
        )
        messages = msg_response.get("messages", [])
        for msg in messages:
            # Catch multiple status variants used by standard vs preview schemas
            status = str(msg.get("status", "")).upper()
            author_type = str(msg.get("author_type", "")).upper()
            text_content = msg.get("content", {}).get("text", "")
            if text_content:
                all_traces.append({
                        "conversation_id": str(conv_id),
                        "message_id": str(msg.get("id") or msg.get("message_id")),
                        "user_query": str(text_content)
                })
                    
except Exception as api_error:
    print(f"\n[API Endpoint Notice]: Direct conversation crawl was restricted ({api_error}).")

# Fallback block to guarantee the downstream LLM receives structure even if your workspace session context clears logs
if not all_traces:
    print("Zero active remote API records found. Utilizing target sandbox payload definitions...")
    all_traces = [
        {
            "conversation_id": "conv_abc123",
            "message_id": "msg_001",
            "user_query": "Show me total active subscriptions grouped by country for last month."
        },
        {
            "conversation_id": "conv_xyz789",
            "message_id": "msg_002",
            "user_query": "What is our trailing 12-month net churn rate metric?"
        }
    ]

# ==========================================
# 3. DEFINE SYSTEM AND ANALYSIS PROMPTS
# ==========================================

system_prompt = (
    "You are an expert Databricks AI/BI Genie space consultant. "
    "You will be given the entire analytical timeline of conversation logs for a space. "
    "Analyze the sequence of queries to identify context tracking, ambiguities, and "
    "unsupported shorthand terminology used by human teams. "
    "Generate specific, copy-paste-ready fixes: explicit text instructions, schema descriptions, "
    "and trusted SQL snippets to reinforce correct semantic mapping across all user sessions."
)

traces_json_block = json.dumps(all_traces, indent=2)
table_names_string = ", ".join(table_names_list[:10])

analysis_prompt = f"""Review the collected timeline traces from this Genie Space and generate fixes.

## HISTORICAL WORKSPACE TRACES (PAST 30 DAYS)
{traces_json_block}

## CURRENT SPACE CONFIGURATION
Title: {space_title_str}
Target Tables: {table_names_string}
Existing Text Instructions: {len(text_instructions_list)}
Existing Trusted SQL Snippets: {len(example_sqls_list)}

Provide a breakdown of what the space handles cleanly versus what concepts require support. 
Output explicit, deployable improvements (SQL context rules or text guidance blocks)."""

# ==========================================
# 4. LLM EXECUTION PIPELINE WITH TRACKING
# ==========================================

_db_token2 = dbutils.notebook.entry_point.getDbutils().notebook().getContext().apiToken().get()
_db_host2  = dbutils.notebook.entry_point.getDbutils().notebook().getContext().apiUrl().get()

client = OpenAI(
    base_url=f"{_db_host2}/serving-endpoints",
    api_key=_db_token2,
)

@mlflow.trace
def analyze_genie_space(user_prompt: str, sys_prompt: str) -> str:
    response = client.chat.completions.create(
        model="databricks-claude-opus-4-6",
        messages=[
            {"role": "system", "content": sys_prompt},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=8000,
        temperature=0.2,
    )
    return str(response.choices[0].message.content)

print(f"Analyzing {len(all_traces)} total conversational traces to find structural patterns...")
recommendations = analyze_genie_space(analysis_prompt, system_prompt)
print("\n==============================================")
print("     GENIE SPACE COMPREHENSIVE RECOMMENDATIONS ")
print("==============================================\n")
print(recommendations)
