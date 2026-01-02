import { z } from "zod";

export const CreateProjectSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

export const DeleteProjectSchema = z.object({
  id: z.string().min(1),
});

export type DeleteProjectInput = z.infer<typeof DeleteProjectSchema>;

export const RenameProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(120),
});

export type RenameProjectInput = z.infer<typeof RenameProjectSchema>;

export const ProjectIdSchema = z.object({
  projectId: z.string().min(1),
});

export type ProjectIdInput = z.infer<typeof ProjectIdSchema>;

export const EventSortKeySchema = z.enum([
  "timestamp",
  "ipAddress",
  "type",
  "country",
  "region",
  "city",
  "zip",
  "isp",
  "asName",
]);

export const ListProjectEventsSchema = z.object({
  projectId: z.string().min(1),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
  search: z.string().trim().optional(),
  sortBy: EventSortKeySchema.default("timestamp"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export type ListProjectEventsInput = z.infer<typeof ListProjectEventsSchema>;
