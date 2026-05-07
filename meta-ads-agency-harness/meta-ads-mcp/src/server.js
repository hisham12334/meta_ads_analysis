import readline from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import { MetaAdsClient } from "./metaClient.js";

const client = new MetaAdsClient();

const tools = [
  tool("get_ad_accounts", "Return Meta ad accounts accessible by the token.", {}),
  tool("get_account_summary", "Return account-level Meta Ads performance summary.", reportSchema()),
  tool("get_campaign_insights", "Return campaign-level Meta Ads performance.", reportSchema()),
  tool("get_adset_insights", "Return ad set performance, optionally filtered by campaign_id.", {
    type: "object",
    properties: {
      ...reportSchema().properties,
      campaign_id: { type: "string" }
    },
    additionalProperties: false
  }),
  tool("get_ad_insights", "Return ad performance, optionally filtered by adset_id.", {
    type: "object",
    properties: {
      ...reportSchema().properties,
      adset_id: { type: "string" }
    },
    additionalProperties: false
  }),
  tool("get_daily_performance", "Return daily performance trend rows for an account or entity.", {
    type: "object",
    properties: {
      ...reportSchema().properties,
      level: { type: "string", enum: ["account", "campaign", "adset", "ad"] },
      entity_id: { type: "string", description: "ID of the campaign, adset, or ad to filter by." }
    },
    additionalProperties: false
  }),
  tool("get_breakdown_insights", "Return performance broken down by age, gender, country, placement, or device.", {
    type: "object",
    properties: {
      ...reportSchema().properties,
      level: { type: "string", enum: ["campaign", "adset", "ad"] },
      entity_id: { type: "string", description: "ID of the entity at the chosen level." },
      breakdowns: {
        type: "array",
        items: {
          type: "string",
          enum: [
            "age",
            "gender",
            "country",
            "region",
            "publisher_platform",
            "platform_position",
            "device_platform",
            "impression_device"
          ]
        }
      }
    },
    additionalProperties: false
  }),
  tool("get_creative_fatigue_report", "Flag ads that may need creative refresh. Pass entity_id with level to scope to a campaign or adset.", {
    type: "object",
    properties: {
      ...reportSchema().properties,
      level: { type: "string", enum: ["campaign", "adset", "ad"], description: "Level to pull ads from." },
      entity_id: { type: "string", description: "ID of the campaign or adset to scope the report to." }
    },
    additionalProperties: false
  }),
  tool("diagnose_performance", "Classify winners, watchlist items, and losers using performance thresholds.", {
    type: "object",
    properties: {
      ...reportSchema().properties,
      level: { type: "string", enum: ["campaign", "adset", "ad"], description: "Level to diagnose. Pass entity_id to scope to a parent entity." },
      entity_id: { type: "string", description: "Optional parent entity ID to scope results (e.g. campaign_id when level=adset)." },
      target_roas: { type: "number" },
      target_cost_per_purchase: { type: "number" },
      minimum_spend_to_judge: { type: "number" }
    },
    additionalProperties: false
  })
];

const toolHandlers = {
  get_ad_accounts: () => client.getAdAccounts(),
  get_account_summary: (args) => client.getAccountSummary(args),
  get_campaign_insights: (args) => client.getCampaignInsights(args),
  get_adset_insights: (args) => client.getAdsetInsights(args),
  get_ad_insights: (args) => client.getAdInsights(args),
  get_daily_performance: (args) => client.getDailyPerformance(args),
  get_breakdown_insights: (args) => client.getBreakdownInsights(args),
  get_creative_fatigue_report: (args) => client.getCreativeFatigueReport(args),
  diagnose_performance: (args) => client.diagnosePerformance(args)
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
        name: "meta-ads-readonly-mcp",
        version: "0.1.0"
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

function reportSchema() {
  return {
    type: "object",
    properties: {
      date_preset: { type: "string" },
      time_range: {
        type: "object",
        properties: {
          since: { type: "string" },
          until: { type: "string" }
        },
        required: ["since", "until"],
        additionalProperties: false
      },
      limit: {
        type: "number",
        minimum: 1,
        maximum: 500
      },
      action_attribution_windows: {
        type: "array",
        items: { type: "string" }
      }
    }
  };
}
