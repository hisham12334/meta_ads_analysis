export async function searchAdLibrary(params, config) {
  const query = params.query?.trim();
  if (!query) {
    return {
      error: {
        type: "invalid_input",
        message: "query must be a non-empty string.",
        meta_code: null,
        retryable: false
      }
    };
  }

  const country = params.country || "US";
  const ad_type = params.ad_type || "ALL";
  let limit = Number(params.limit);
  if (!Number.isFinite(limit) || limit < 1) limit = 50;
  if (limit > 200) limit = 200;

  const fields = [
    "id",
    "ad_creative_bodies",
    "ad_creative_link_captions",
    "ad_creative_link_descriptions",
    "ad_creative_link_titles",
    "ad_delivery_start_time",
    "ad_delivery_stop_time",
    "ad_snapshot_url",
    "bylines",
    "currency",
    "delivery_by_region",
    "demographic_distribution",
    "estimated_audience_size",
    "impressions",
    "page_id",
    "page_name",
    "publisher_platforms",
    "spend",
    "ad_creative_media_type"
  ].join(",");

  const url = new URL(`${config.graphBaseUrl}/ads_archive`);
  url.searchParams.set("access_token", config.accessToken);
  url.searchParams.set("search_terms", query);
  url.searchParams.set("ad_reached_countries", `['${country}']`);
  url.searchParams.set("ad_active_status", "ALL");
  url.searchParams.set("ad_type", ad_type);
  url.searchParams.set("limit", limit.toString());
  url.searchParams.set("fields", fields);

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || data.error) {
      return normalizeMetaError(data.error, response.status);
    }

    return { ads: data.data || [] };
  } catch (error) {
    return {
      error: {
        type: "network_error",
        message: error.message,
        meta_code: null,
        retryable: true
      }
    };
  }
}

function normalizeMetaError(metaError, status) {
  const code = metaError?.code ?? status;
  const type =
    code === 190
      ? "auth_error"
      : status === 403 || code === 200
        ? "permission_error"
        : status === 429 || code === 4 || code === 17 || code === 613
          ? "rate_limit"
          : code === 100
            ? "invalid_field"
            : "unknown_error";

  return {
    error: {
      type,
      message: metaError?.message ?? "Meta API request failed.",
      meta_code: code,
      retryable: type === "rate_limit"
    }
  };
}
