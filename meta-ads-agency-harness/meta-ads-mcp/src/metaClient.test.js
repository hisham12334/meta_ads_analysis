import { jest } from "@jest/globals";

// Mock the adLibraryClient
jest.unstable_mockModule("./adLibraryClient.js", () => ({
  searchAdLibrary: jest.fn()
}));

const { searchAdLibrary } = await import("./adLibraryClient.js");
const { MetaAdsClient } = await import("./metaClient.js");

describe("MetaAdsClient - Market Intelligence Wiring", () => {
  let client;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new MetaAdsClient({ accessToken: "test", graphBaseUrl: "test" });
  });

  test("Returns Intelligence_Report shape on success", async () => {
    searchAdLibrary.mockResolvedValueOnce({
      ads: [
        { id: "1", ad_delivery_start_time: "2026-05-01" },
        { id: "2", ad_delivery_start_time: "2026-05-01" },
        { id: "3", ad_delivery_start_time: "2026-05-01" }
      ]
    });

    const result = await client.searchAdLibraryAndAnalyse({ query: "shoes" });

    expect(result).toHaveProperty("query", "shoes");
    expect(result).toHaveProperty("country", "US");
    expect(result).toHaveProperty("total_ads_analysed", 3);
    expect(result).toHaveProperty("top_performers");
    expect(result).toHaveProperty("low_performers");
    expect(result).toHaveProperty("unclassified");
    expect(result).toHaveProperty("pattern_analysis");
    expect(result).toHaveProperty("workflow_context");
  });

  test("Returns error object directly on error", async () => {
    const errorObj = {
      error: {
        type: "rate_limit",
        message: "Too Many Requests",
        retryable: true
      }
    };
    searchAdLibrary.mockResolvedValueOnce(errorObj);

    const result = await client.searchAdLibraryAndAnalyse({ query: "shoes" });

    expect(result).toEqual(errorObj);
  });
});
