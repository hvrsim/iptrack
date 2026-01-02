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

export const ListProjectLocationsSchema = ProjectIdSchema.extend({
  limit: z.number().int().min(1).max(100).default(30),
});

export type ListProjectLocationsInput = z.infer<
  typeof ListProjectLocationsSchema
>;

export const ProjectOverviewSchema = ProjectIdSchema;

export type ProjectOverviewInput = z.infer<typeof ProjectOverviewSchema>;

export const DomainValueSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine((value) => {
    const lower = value.toLowerCase();
    const hostname =
      /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/i;
    const wildcard =
      /^\*\.(?=.{1,251}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/i;
    const local = lower === "localhost" || lower === "127.0.0.1";
    return local || hostname.test(lower) || wildcard.test(lower);
  }, "Invalid domain format");

export const ListProjectDomainsSchema = ProjectIdSchema;

export type ListProjectDomainsInput = z.infer<
  typeof ListProjectDomainsSchema
>;

export const AddProjectDomainSchema = ProjectIdSchema.extend({
  value: DomainValueSchema,
});

export type AddProjectDomainInput = z.infer<typeof AddProjectDomainSchema>;

export const UpdateProjectDomainSchema = ProjectIdSchema.extend({
  id: z.string().min(1),
  value: DomainValueSchema,
});

export type UpdateProjectDomainInput = z.infer<
  typeof UpdateProjectDomainSchema
>;

export const DeleteProjectDomainSchema = ProjectIdSchema.extend({
  id: z.string().min(1),
});

export type DeleteProjectDomainInput = z.infer<
  typeof DeleteProjectDomainSchema
>;
