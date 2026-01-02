import { z } from "zod";

export const CollectorEventRequestSchema = z.preprocess(
  (value) => {
    if (!value || typeof value !== "object") {
      return value;
    }

    const payload = value as Record<string, unknown>;
    const projectId =
      typeof payload.projectId === "string"
        ? payload.projectId
        : typeof payload.project_id === "string"
          ? payload.project_id
          : "";
    const timestamp =
      typeof payload.timestamp === "number"
        ? payload.timestamp
        : Number(payload.timestamp);

    return { projectId, timestamp };
  },
  z.object({
    projectId: z.string().trim().min(1),
    timestamp: z.number().finite(),
  }),
);

export type CollectorEventRequestInput = z.infer<
  typeof CollectorEventRequestSchema
>;
