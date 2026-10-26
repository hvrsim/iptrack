export function assertMutationRequest(request: Request) {
  if (request.method !== "POST") throw new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } });
  const origin = request.headers.get("Origin");
  if (!origin || origin !== new URL(request.url).origin || request.headers.get("Sec-Fetch-Site") === "cross-site") {
    throw new Response("Forbidden origin", { status: 403 });
  }
}
