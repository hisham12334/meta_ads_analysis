import readline from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import { MetaAdsClient } from "./metaClient.js";


const client = new MetaAdsClient();

const tools = [
  // ---------------------------------------------------------------------------
  // Creative Intelligence Engine tools
  // (use meta-ads-official for raw campaign/adset/ad reads)
  // ---------------------------------------------------------------------------

  tool("detect_anomalies", "Detect metric anomalies in daily performance data with root-cause classification and plain-English explanations.", {
    type: "object",
    properties: {
      date_preset: { type: "string", description: "Meta date preset (e.g. last_14d). Defaults to last_14d." },
      time_range: {
        type: "object",
        properties: { since: { type: "string" }, until: { type: "string" } },
        required: ["since", "until"],
        additionalProperties: false
      },
      level: { type: "string", enum: ["campaign", "adset"], description: "Level to analyze. Defaults to campaign." },
      entity_id: { type: "string", description: "Optional campaign or adset ID to scope the analysis." },
      anomaly_threshold: { type: "number", description: "Fractional deviation threshold (default 0.2 = 20%)." },
      monthly_budget: { type: "number", description: "Monthly budget in account currency. Enables budget_pacing anomaly detection." },
      minimum_spend_to_judge: { type: "number", description: "Minimum daily spend to flag a tracking_break anomaly. Defaults to 1500." }
    },
    additionalProperties: false
  }),

  tool("generate_creative_brief", "Generate a data-driven creative brief from top-performing ads. Returns 3 variation directions, Meta specs, and skill references.", {
    type: "object",
    properties: {
      ad_id: { type: "string", description: "Specific ad ID to base the brief on." },
      adset_id: { type: "string", description: "Adset ID — brief is based on top ads in this adset." },
      campaign_id: { type: "string", description: "Campaign ID — brief is based on top ads in this campaign." },
      date_preset: { type: "string", description: "Meta date preset for performance data. Defaults to last_14d." },
      top_n: { type: "number", description: "Number of top ads to analyze (default 3, max 10)." },
      brand_context: { type: "string", description: "Optional brand/offer context to incorporate into the brief copy directions." }
    },
    additionalProperties: false
  }),

  tool("get_spend_pacing", "Project month-end spend against a monthly budget and compute cash-flow metrics including breakeven ROAS and projected profit/loss.", {
    type: "object",
    properties: {
      monthly_budget: { type: "number", description: "Monthly budget cap in account currency. Required." },
      gross_margin_pct: { type: "number", description: "Gross margin as a decimal between 0 and 1 (e.g. 0.4 for 40%). Required." },
      target_roas: { type: "number", description: "Optional target ROAS for profit projection context." },
      time_range: {
        type: "object",
        properties: { since: { type: "string" }, until: { type: "string" } },
        required: ["since", "until"],
        additionalProperties: false,
        description: "Date range for spend data. Defaults to current calendar month."
      }
    },
    required: ["monthly_budget", "gross_margin_pct"],
    additionalProperties: false
  }),

  // ---------------------------------------------------------------------------
  // Market Intelligence Tools
  // ---------------------------------------------------------------------------

  tool("search_ad_library", "Search Meta Ad Library and analyse competitor ads.", {
    type: "object",
    properties: {
      query: { type: "string", description: "Search keyword or niche." },
      country: { type: "string", description: "ISO country code, default US." },
      limit: { type: "number", minimum: 1, maximum: 200, description: "Max records to return, default 50." },
      ad_type: { type: "string", description: "Ad type filter, default ALL." }
    },
    required: ["query"],
    additionalProperties: false
  }),
  
  tool("analyse_market", "Search Meta Ad Library and generate a full market intelligence report incorporating brand context.", {
    type: "object",
    properties: {
      query: { type: "string", description: "Search keyword or niche." },
      country: { type: "string", description: "ISO country code, default US." },
      limit: { type: "number", minimum: 1, maximum: 200, description: "Max records to return, default 50." },
      ad_type: { type: "string", description: "Ad type filter, default ALL." },
      brand_context: { type: "string", description: "Optional brand/offer context to incorporate into the report hints." }
    },
    required: ["query"],
    additionalProperties: false
  })
];

const toolHandlers = {
  detect_anomalies: (args) => client.detectAnomalies(args),
  generate_creative_brief: (args) => client.generateCreativeBrief(args),
  get_spend_pacing: (args) => client.getSpendPacing(args),
  search_ad_library: (args) => client.searchAdLibraryAndAnalyse(args),
  analyse_market: (args) => client.analyseMarket(args)
};

const rl = readline.createInterface({ input, crlfDelay: Infinity });

rl.on("line", async (line) => {
  if (!line.trim()) return;

  let request;
  try {
    request = JSON.parse(line);
  } catch (error) {
    send(null, jsonRpcError(-32700, "Parse error"));
    return;
  }

  // Notifications have no id — handle and discard without responding.
  if (request.method?.startsWith("notifications/")) {
    return;
  }

  try {
    await handleRequest(request);
  } catch (error) {
    send(request.id, jsonRpcError(-32603, error.message));
  }
});

async function handleRequest(request) {
  if (request.method === "initialize") {
    send(request.id, {
      protocolVersion: request.params?.protocolVersion ?? "2024-11-05",
      capabilities: {
        tools: {}
      },
      serverInfo: {
        name: "meta-ads-intelligence",
        version: "0.2.0"
      }
    });
    return;
  }

  if (request.method === "tools/list") {
    send(request.id, { tools });
    return;
  }

  if (request.method === "tools/call") {
    const name = request.params?.name;
    const args = request.params?.arguments ?? {};
    const handler = toolHandlers[name];

    if (!handler) {
      send(request.id, jsonRpcError(-32602, `Unknown tool: ${name}`));
      return;
    }

    const result = await handler(args);
    send(request.id, {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ],
      isError: Boolean(result?.error)
    });
    return;
  }

  if (request.id != null) {
    send(request.id, jsonRpcError(-32601, `Unsupported method: ${request.method}`));
  }
}

function send(id, result) {
  const message = result?.error
    ? { jsonrpc: "2.0", id, error: result.error }
    : { jsonrpc: "2.0", id, result };
  output.write(`${JSON.stringify(message)}\n`);
}

function jsonRpcError(code, message) {
  return {
    error: {
      code,
      message
    }
  };
}

function tool(name, description, inputSchema) {
  // Accept a fully-formed schema object or a flat properties map.
  const schema =
    inputSchema?.type === "object"
      ? inputSchema
      : {
          type: "object",
          properties: inputSchema,
          additionalProperties: false
        };

  return { name, description, inputSchema: schema };
}

