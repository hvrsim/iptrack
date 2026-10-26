import { and, desc, eq, gte, lt, or, sql } from "drizzle-orm";
import { events } from "@repo/data-ops/drizzle/schema";
import { initDatabase } from "@repo/data-ops/database/setup";
import { ExportEventsSchema } from "@repo/data-ops/zod-schema/projects";

export function exportEvents(db: ReturnType<typeof initDatabase>, input: ReturnType<typeof ExportEventsSchema.parse>, signal: AbortSignal, snapshot = Date.now(), retentionDays = 30) {
  const days = { day: 1, week: 7, month: 30, all: null }[input.range];
  const encoder = new TextEncoder();
  let cursor: { timestamp: Date; id: string } | undefined;
  let first = true;
  let started = false;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (signal.aborted) { controller.close(); return; }
      if (!started) { controller.enqueue(encoder.encode("[")); started = true; return; }
      try {
        const rows = await db.select().from(events).where(and(
          eq(events.projectId, input.projectId), lt(events.timestamp, new Date(snapshot)),
          gte(events.timestamp, new Date(snapshot - Math.min(days ?? retentionDays, retentionDays) * 86400000)),
          input.search ? sql`instr(${events.ipAddress}, ${input.search}) > 0` : undefined,
          cursor ? or(lt(events.timestamp, cursor.timestamp), and(eq(events.timestamp, cursor.timestamp), lt(events.id, cursor.id))) : undefined,
        )).orderBy(desc(events.timestamp), desc(events.id)).limit(100);
        if (!rows.length) { controller.enqueue(encoder.encode("]")); controller.close(); return; }
        const output = rows.map(event => {
          const row: Record<string, unknown> = { id: event.id };
          for (const column of input.columns) row[column] = event[column];
          // Preserve independent classification flags and enrichment provenance.
          row.proxy = event.proxy; row.mobile = event.mobile; row.hosting = event.hosting;
          row.enrichmentStatus = event.enrichmentStatus;
          const prefix = first ? "" : ",";
          first = false;
          return prefix + JSON.stringify(row);
        }).join("");
        const last = rows.at(-1)!;
        cursor = { timestamp: last.timestamp, id: last.id };
        controller.enqueue(encoder.encode(output));
      } catch (error) { controller.error(error); }
    },
  });
}
