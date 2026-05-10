import { jest } from "@jest/globals";
import fc from "fast-check";
import { searchAdLibrary } from "./adLibraryClient.js";

describe("searchAdLibrary", () => {
  const mockConfig = {
    accessToken: "test-token",
    graphBaseUrl: "https://graph.facebook.com/v19.0"
  };

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test("Property 7: whitespace query rejected without network call", async () => {
    // Feature: market-intelligence-tool, Property 7: whitespace query rejected without network call
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom(" ", "\t", "\n", "\r"), { minLength: 1 }).map(arr => arr.join("")),
        async (whitespaceStr) => {
          jest.clearAllMocks();
          const result = await searchAdLibrary({ query: whitespaceStr }, mockConfig);
          expect(result).toEqual({
            error: {
              type: "invalid_input",
              message: "query must be a non-empty string.",
              meta_code: null,
              retryable: false
            }
          });
          expect(global.fetch).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  test("Successful response returns ads array", async () => {
    const mockAds = [{ id: "1" }, { id: "2" }];
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockAds })
    });

    const result = await searchAdLibrary({ query: "shoes" }, mockConfig);
    expect(result).toEqual({ ads: mockAds });
  });

  test("HTTP 429 returns rate_limit error", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: "Too Many Requests", code: 4 } })
    });

    const result = await searchAdLibrary({ query: "shoes" }, mockConfig);
    expect(result).toEqual({
      error: {
        type: "rate_limit",
        message: "Too Many Requests",
        meta_code: 4,
        retryable: true
      }
    });
  });

  test("HTTP 403 returns permission_error error", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: { message: "Forbidden", code: 200 } })
    });

    const result = await searchAdLibrary({ query: "shoes" }, mockConfig);
    expect(result).toEqual({
      error: {
        type: "permission_error",
        message: "Forbidden",
        meta_code: 200,
        retryable: false
      }
    });
  });

  test("Network failure returns network_error error", async () => {
    global.fetch.mockRejectedValueOnce(new Error("Network down"));

    const result = await searchAdLibrary({ query: "shoes" }, mockConfig);
    expect(result).toEqual({
      error: {
        type: "network_error",
        message: "Network down",
        meta_code: null,
        retryable: true
      }
    });
  });

  test("Default country/limit applied when not provided", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] })
    });

    await searchAdLibrary({ query: "shoes" }, mockConfig);
    
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const requestedUrl = new URL(global.fetch.mock.calls[0][0]);
    expect(requestedUrl.searchParams.get("ad_reached_countries")).toBe("['US']");
    expect(requestedUrl.searchParams.get("limit")).toBe("50");
    expect(requestedUrl.searchParams.get("ad_type")).toBe("ALL");
  });
  
  test("Clamps limit to 200", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] })
    });

    await searchAdLibrary({ query: "shoes", limit: 500 }, mockConfig);
    
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const requestedUrl = new URL(global.fetch.mock.calls[0][0]);
    expect(requestedUrl.searchParams.get("limit")).toBe("200");
  });
});
