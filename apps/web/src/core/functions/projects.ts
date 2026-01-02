import { createServerFn } from "@tanstack/react-start";
import { eq, and, desc, asc, like, sql, isNotNull } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "@repo/data-ops/database/setup";
import {
  CreateProjectSchema,
  DeleteProjectSchema,
  ListProjectEventsSchema,
  RenameProjectSchema,
  type CreateProjectInput,
  type DeleteProjectInput,
  type ListProjectEventsInput,
  type RenameProjectInput,
} from "@repo/data-ops/zod-schema/projects";
import { events, projectDomains, projects } from "@repo/data-ops/drizzle/schema";
import { protectedFunctionMiddleware } from "@/core/middleware/auth";

const baseFunction = createServerFn().middleware([
  protectedFunctionMiddleware,
]);

export const listProjects = baseFunction.handler(async (ctx) => {
  const db = getDb();

  return db
    .select({
      id: projects.id,
      name: projects.name,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .where(eq(projects.userId, ctx.context.userId))
    .orderBy(desc(projects.createdAt));
});

export const createProject = baseFunction
  .inputValidator((data: CreateProjectInput) =>
    CreateProjectSchema.parse(data),
  )
  .handler(async (ctx) => {
    const db = getDb();
    const now = new Date();
    const project = {
      id: crypto.randomUUID(),
      userId: ctx.context.userId,
      name: ctx.data.name.trim(),
      createdAt: now,
    };

    await db.insert(projects).values(project);
    return project;
  });

export const deleteProject = baseFunction
  .inputValidator((data: DeleteProjectInput) =>
    DeleteProjectSchema.parse(data),
  )
  .handler(async (ctx) => {
    const db = getDb();

    const project = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.id, ctx.data.id),
          eq(projects.userId, ctx.context.userId),
        ),
      )
      .get();

    if (!project) {
      return { success: true };
    }

    await db.batch([
      db.delete(events).where(eq(events.projectId, project.id)),
      db.delete(projectDomains).where(eq(projectDomains.projectId, project.id)),
      db.delete(projects).where(eq(projects.id, project.id)),
    ]);

    return { success: true };
  });

export const renameProject = baseFunction
  .inputValidator((data: RenameProjectInput) =>
    RenameProjectSchema.parse(data),
  )
  .handler(async (ctx) => {
    const db = getDb();
    const trimmedName = ctx.data.name.trim();

    await db
      .update(projects)
      .set({ name: trimmedName })
      .where(
        and(eq(projects.id, ctx.data.id), eq(projects.userId, ctx.context.userId)),
      );

    return { success: true };
  });

function assertProjectOwner(
  projectId: string,
  userId: string,
  db: ReturnType<typeof getDb>,
) {
  return db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .get();
}

export const listProjectEvents = baseFunction
  .inputValidator((data: ListProjectEventsInput) =>
    ListProjectEventsSchema.parse(data),
  )
  .handler(async (ctx) => {
    const db = getDb();
    const latColumn = (events as { lat?: typeof events.timestamp }).lat;
    const lonColumn = (events as { lon?: typeof events.timestamp }).lon;
    const project = await assertProjectOwner(
      ctx.data.projectId,
      ctx.context.userId,
      db,
    );

    if (!project) {
      throw new Error("Project not found");
    }

    const searchTerm = ctx.data.search?.toLowerCase();
    const filters = [
      eq(events.projectId, ctx.data.projectId),
      searchTerm ? like(events.ipAddress, `%${searchTerm}%`) : undefined,
    ].filter(Boolean);

    const sortColumn = {
      timestamp: events.timestamp,
      ipAddress: events.ipAddress,
      type: events.type,
      country: events.country,
      region: events.region,
      city: events.city,
      zip: events.zip,
      isp: events.isp,
      asName: events.asName,
    }[ctx.data.sortBy];

    const orderBy = ctx.data.sortDir === "asc" ? asc : desc;
    const offset = (ctx.data.page - 1) * ctx.data.pageSize;

    const [items, totalResult] = await Promise.all([
      db
        .select({
          id: events.id,
          timestamp: events.timestamp,
          ipAddress: events.ipAddress,
          type: events.type,
          country: events.country,
          region: events.region,
          city: events.city,
          zip: events.zip,
          isp: events.isp,
          asName: events.asName,
        })
        .from(events)
        .where(and(...filters))
        .orderBy(orderBy(sortColumn))
        .limit(ctx.data.pageSize)
        .offset(offset),
      db
        .select({
          count: sql<number>`count(*)`,
        })
        .from(events)
        .where(and(...filters))
        .get(),
    ]);

    return {
      items,
      total: totalResult?.count ?? 0,
      page: ctx.data.page,
      pageSize: ctx.data.pageSize,
    };
  });

const ListProjectLocationsSchema = ProjectIdSchema.extend({
  limit: z.number().int().min(1).max(100).default(30),
});

export const listProjectLocations = baseFunction
  .inputValidator((data: z.infer<typeof ListProjectLocationsSchema>) =>
    ListProjectLocationsSchema.parse(data),
  )
  .handler(async (ctx) => {
    const db = getDb();
    const latColumn = (events as { lat?: typeof events.timestamp }).lat;
    const lonColumn = (events as { lon?: typeof events.timestamp }).lon;
    const project = await assertProjectOwner(
      ctx.data.projectId,
      ctx.context.userId,
      db,
    );

    if (!project) {
      throw new Error("Project not found");
    }

    if (!latColumn || !lonColumn) {
      return [];
    }

    const items = await db
      .select({
        id: events.id,
        lat: latColumn,
        lon: lonColumn,
        ipAddress: events.ipAddress,
        timestamp: events.timestamp,
        type: events.type,
      })
      .from(events)
      .where(
        and(
          eq(events.projectId, ctx.data.projectId),
          isNotNull(latColumn),
          isNotNull(lonColumn),
        ),
      )
      .orderBy(desc(events.timestamp))
      .limit(ctx.data.limit);

    return items.map((item) => ({
      id: item.id,
      lat: item.lat ?? 0,
      lon: item.lon ?? 0,
      ipAddress: item.ipAddress,
      visitedAt: item.timestamp,
      mobile: item.type === "mobile",
    }));
  });

const ProjectOverviewSchema = ProjectIdSchema;

export const getProjectOverview = baseFunction
  .inputValidator((data: z.infer<typeof ProjectOverviewSchema>) =>
    ProjectOverviewSchema.parse(data),
  )
  .handler(async (ctx) => {
    const db = getDb();
    const project = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(and(eq(projects.id, ctx.data.projectId), eq(projects.userId, ctx.context.userId)))
      .get();

    if (!project) {
      throw new Error("Project not found");
    }

    const sinceMs = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const [total, mobile, uniqueIps] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(events)
        .where(
          and(eq(events.projectId, project.id), sql`${events.timestamp} >= ${sinceMs}`),
        )
        .get(),
      db
        .select({ count: sql<number>`count(*)` })
        .from(events)
        .where(
          and(
            eq(events.projectId, project.id),
            eq(events.type, "mobile"),
            sql`${events.timestamp} >= ${sinceMs}`,
          ),
        )
        .get(),
      db
        .select({ count: sql<number>`count(distinct ${events.ipAddress})` })
        .from(events)
        .where(
          and(eq(events.projectId, project.id), sql`${events.timestamp} >= ${sinceMs}`),
        )
        .get(),
    ]);

    return {
      projectId: project.id,
      name: project.name,
      totalEvents: total?.count ?? 0,
      mobileEvents: mobile?.count ?? 0,
      uniqueIps: uniqueIps?.count ?? 0,
      collectorOrigin: env.COLLECTOR_ORIGIN ?? "",
      since: new Date(sinceMs),
    };
  });

const DomainValueSchema = z
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

const ListProjectDomainsSchema = ProjectIdSchema;

export const listProjectDomains = baseFunction
  .inputValidator((data: z.infer<typeof ListProjectDomainsSchema>) =>
    ListProjectDomainsSchema.parse(data),
  )
  .handler(async (ctx) => {
    const db = getDb();
    const project = await assertProjectOwner(
      ctx.data.projectId,
      ctx.context.userId,
      db,
    );

    if (!project) {
      throw new Error("Project not found");
    }

    const items = await db
      .select({
        id: projectDomains.id,
        hostname: projectDomains.hostname,
        wildcard: projectDomains.wildcard,
      })
      .from(projectDomains)
      .where(eq(projectDomains.projectId, ctx.data.projectId));

    return items.map((item) => ({
      id: item.id,
      value: item.wildcard ? `*.${item.hostname}` : item.hostname,
    }));
  });

const AddProjectDomainSchema = ProjectIdSchema.extend({
  value: DomainValueSchema,
});

export const addProjectDomain = baseFunction
  .inputValidator((data: z.infer<typeof AddProjectDomainSchema>) =>
    AddProjectDomainSchema.parse(data),
  )
  .handler(async (ctx) => {
    const db = getDb();
    const project = await assertProjectOwner(
      ctx.data.projectId,
      ctx.context.userId,
      db,
    );

    if (!project) {
      throw new Error("Project not found");
    }

    const value = ctx.data.value.toLowerCase();
    const wildcard = value.startsWith("*.");
    const hostname = wildcard ? value.replace(/^\*\./, "") : value;
    const id = crypto.randomUUID();

    await db.insert(projectDomains).values({
      id,
      projectId: ctx.data.projectId,
      hostname,
      wildcard,
    });

    return { id, value: wildcard ? `*.${hostname}` : hostname };
  });

const UpdateProjectDomainSchema = ProjectIdSchema.extend({
  id: z.string().min(1),
  value: DomainValueSchema,
});

export const updateProjectDomain = baseFunction
  .inputValidator((data: z.infer<typeof UpdateProjectDomainSchema>) =>
    UpdateProjectDomainSchema.parse(data),
  )
  .handler(async (ctx) => {
    const db = getDb();
    const project = await assertProjectOwner(
      ctx.data.projectId,
      ctx.context.userId,
      db,
    );

    if (!project) {
      throw new Error("Project not found");
    }

    const value = ctx.data.value.toLowerCase();
    const wildcard = value.startsWith("*.");
    const hostname = wildcard ? value.replace(/^\*\./, "") : value;

    await db
      .update(projectDomains)
      .set({ hostname, wildcard })
      .where(
        and(
          eq(projectDomains.id, ctx.data.id),
          eq(projectDomains.projectId, ctx.data.projectId),
        ),
      );

    return { id: ctx.data.id, value: wildcard ? `*.${hostname}` : hostname };
  });

const DeleteProjectDomainSchema = ProjectIdSchema.extend({
  id: z.string().min(1),
});

export const deleteProjectDomain = baseFunction
  .inputValidator((data: z.infer<typeof DeleteProjectDomainSchema>) =>
    DeleteProjectDomainSchema.parse(data),
  )
  .handler(async (ctx) => {
    const db = getDb();
    const project = await assertProjectOwner(
      ctx.data.projectId,
      ctx.context.userId,
      db,
    );

    if (!project) {
      throw new Error("Project not found");
    }

    await db
      .delete(projectDomains)
      .where(
        and(
          eq(projectDomains.id, ctx.data.id),
          eq(projectDomains.projectId, ctx.data.projectId),
        ),
      );

    return { success: true };
  });
