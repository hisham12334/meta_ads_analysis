import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export function loadConfig(env = process.env) {
  loadDotEnv(env);

  const apiVersion = env.META_API_VERSION || "v23.0";
  const accessToken = env.META_ACCESS_TOKEN;
  const adAccountId = env.META_AD_ACCOUNT_ID;
  const businessId = env.META_BUSINESS_ID || null;
  const attributionWindows = parseCsv(env.META_DEFAULT_ATTRIBUTION_WINDOWS);

  return {
    apiVersion,
    accessToken,
    adAccountId,
    businessId,
    attributionWindows,
    graphBaseUrl: `https://graph.facebook.com/${apiVersion}`
  };
}

export function validateConfig(config, options = {}) {
  const needsAdAccount = options.needsAdAccount !== false;
  const errors = [];

  if (!config.accessToken) {
    errors.push("META_ACCESS_TOKEN is required.");
  }

  if (needsAdAccount && !config.adAccountId) {
    errors.push("META_AD_ACCOUNT_ID is required.");
  }

  if (config.adAccountId && !config.adAccountId.startsWith("act_")) {
    errors.push("META_AD_ACCOUNT_ID should look like act_1234567890.");
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: {
        type: "configuration_error",
        message: errors.join(" "),
        retryable: false
      }
    };
  }

  return { ok: true };
}

function parseCsv(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function loadDotEnv(env) {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (key && env[key] == null) {
      env[key] = value;
    }
  }
}
