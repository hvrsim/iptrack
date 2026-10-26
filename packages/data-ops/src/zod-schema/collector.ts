import { z } from "zod";

// Keep the legacy project_id spelling, but never coerce arbitrary timestamps.
export const CollectorEventRequestSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object") return value;
  const payload = value as Record<string, unknown>;
  return { ...payload, projectId: payload.projectId ?? payload.project_id };
}, z.object({
  projectId: z.string().uuid(),
  eventId: z.string().uuid().optional(),
  timestamp: z.number().int().min(0).max(8640000000000000).optional(),
}));
export type CollectorEventRequestInput = z.infer<typeof CollectorEventRequestSchema>;

export const IpEnrichmentSchema = z.object({
  status: z.literal("success"),
  proxy: z.boolean(), mobile: z.boolean(), hosting: z.boolean(),
  lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180),
  country: z.string().max(256), regionName: z.string().max(256), city: z.string().max(256),
  zip: z.string().max(256), isp: z.string().max(256), as: z.string().max(256),
});
