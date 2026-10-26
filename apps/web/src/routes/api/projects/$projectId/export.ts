import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { getAuth } from "@repo/data-ops/auth/server";
import { initDatabase } from "@repo/data-ops/database/setup";
import { projects } from "@repo/data-ops/drizzle/schema";
import { ExportEventsSchema } from "@repo/data-ops/zod-schema/projects";
import { and, eq } from "drizzle-orm";
import { exportEvents } from "@/core/lib/export-events";

export const Route = createFileRoute("/api/projects/$projectId/export")({
  server: { handlers: { GET: async ({ request, params }) => {
    const session = await getAuth().api.getSession({ headers: request.headers });
    if (!session) return new Response("Unauthorized", { status: 401 });
    const url = new URL(request.url);
    const parsed = ExportEventsSchema.safeParse({ projectId: params.projectId,
      range: url.searchParams.get("range"), search: url.searchParams.get("search") ?? undefined,
      columns: (url.searchParams.get("columns") ?? "timestamp,ipAddress,type,country,city,isp").split(","),
    });
    if (!parsed.success) return new Response("Invalid export options", { status: 400 });
    const db = initDatabase(env.DB);
    const project = await db.select({ id: projects.id, retentionDays: projects.retentionDays }).from(projects).where(and(eq(projects.id, params.projectId), eq(projects.userId, session.user.id))).get();
    if (!project) return new Response("Project not found", { status: 404 });
    return new Response(exportEvents(db, parsed.data, request.signal, Date.now(), project.retentionDays), { headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(project.id)}-${parsed.data.range}.json"`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    } });
  } } },
});
