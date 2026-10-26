import { describe, expect, it } from "vitest";
import { assertMutationRequest } from "../src/core/lib/mutation-request";
describe("mutation request boundary", () => {
  it("accepts only same-origin POST", () => {
    expect(() => assertMutationRequest(new Request("https://app.example/_serverFn/test", { method: "POST", headers: { Origin: "https://app.example" } }))).not.toThrow();
    for (const request of [
      new Request("https://app.example/_serverFn/test"),
      new Request("https://app.example/_serverFn/test", { method: "POST", headers: { Origin: "https://evil.example" } }),
      new Request("https://app.example/_serverFn/test", { method: "POST" }),
      new Request("https://app.example/_serverFn/test", { method: "POST", headers: { Origin: "https://app.example", "Sec-Fetch-Site": "cross-site" } }),
    ]) expect(() => assertMutationRequest(request)).toThrow();
  });
});
