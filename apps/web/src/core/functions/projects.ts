import { createServerFn } from "@tanstack/react-start";
import { eq, and, desc, asc, sql, isNotNull, gte, lt } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { initDatabase } from "@repo/data-ops/database/setup";
import {
  RetentionSchema,
  ProjectIdSchema,
  CreateProjectSchema,
  DeleteProjectSchema,
  AddProjectDomainSchema,
  DeleteProjectDomainSchema,
  ListProjectDomainsSchema,
  ListProjectEventsSchema,
  ListProjectLocationsSchema,
  ProjectOverviewSchema,
  RenameProjectSchema,
  UpdateProjectDomainSchema,
  type CreateProjectInput,
  type AddProjectDomainInput,
  type DeleteProjectDomainInput,
  type ListProjectDomainsInput,
  type DeleteProjectInput,
  type ListProjectEventsInput,
  type ListProjectLocationsInput,
  type ProjectOverviewInput,
  type RenameProjectInput,
  type UpdateProjectDomainInput,
} from "@repo/data-ops/zod-schema/projects";
import { events, projectDomains, projects, ingestionDiagnostics, enrichmentCache } from "@repo/data-ops/drizzle/schema";
import { protectedFunctionMiddleware, mutationMiddleware } from "@/core/middleware/auth";

const baseFunction = createServerFn({ method: "GET" }).middleware([
  protectedFunctionMiddleware,
]);

const mutationFunction = createServerFn({ method: "POST" }).middleware([mutationMiddleware, protectedFunctionMiddleware]);

export const listProjects = baseFunction.handler(async (ctx) => {
  const db = initDatabase(env.DB);

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

export const createProject = mutationFunction
  .inputValidator((data: CreateProjectInput) =>
    CreateProjectSchema.parse(data),
  )
  .handler(async (ctx) => {
    const db = initDatabase(env.DB);
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

export const deleteProject = mutationFunction
  .inputValidator((data: DeleteProjectInput) =>
    DeleteProjectSchema.parse(data),
  )
  .handler(async (ctx) => {
    const db = initDatabase(env.DB);

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
      db.delete(enrichmentCache).where(sql`${enrichmentCache.ipAddress} in (select ip_address from events where project_id = ${project.id})`),
      db.delete(events).where(eq(events.projectId, project.id)),
      db.delete(ingestionDiagnostics).where(eq(ingestionDiagnostics.projectId, project.id)),
      db.delete(projectDomains).where(eq(projectDomains.projectId, project.id)),
      db.delete(projects).where(eq(projects.id, project.id)),
    ]);

    return { success: true };
  });

export const renameProject = mutationFunction
  .inputValidator((data: RenameProjectInput) =>
    RenameProjectSchema.parse(data),
  )
  .handler(async (ctx) => {
    const db = initDatabase(env.DB);
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
  db: ReturnType<typeof initDatabase>,
) {
  return db
    .select({ id: projects.id, retentionDays: projects.retentionDays })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .get();
}

export const listProjectEvents = baseFunction
  .inputValidator((data: ListProjectEventsInput) =>
    ListProjectEventsSchema.parse(data),
  )
  .handler(async (ctx) => {
    const db = initDatabase(env.DB);
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
      gte(events.timestamp, new Date(Date.now() - project.retentionDays * 86400000)),
      lt(events.timestamp, new Date(Date.now())),
      searchTerm ? sql`instr(${events.ipAddress}, ${searchTerm}) > 0` : undefined,
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
          proxy: events.proxy, mobile: events.mobile, hosting: events.hosting,
          enrichmentStatus: events.enrichmentStatus,
          country: events.country,
          region: events.region,
          city: events.city,
          zip: events.zip,
          isp: events.isp,
          asName: events.asName,
        })
        .from(events)
        .where(and(...filters))
        .orderBy(orderBy(sortColumn), orderBy(events.id))
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

export const listProjectLocations = baseFunction
  .inputValidator((data: ListProjectLocationsInput) =>
    ListProjectLocationsSchema.parse(data),
  )
  .handler(async (ctx) => {
    const db = initDatabase(env.DB);
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
        id: events.id,
        lat: events.lat,
        lon: events.lon,
        ipAddress: events.ipAddress,
        timestamp: events.timestamp,
        type: events.type,
        mobile: events.mobile,
      })
      .from(events)
      .where(
        and(
          eq(events.projectId, ctx.data.projectId),
          gte(events.timestamp, new Date(Date.now() - project.retentionDays * 86400000)),
          lt(events.timestamp, new Date(Date.now())),
          isNotNull(events.lat),
          isNotNull(events.lon),
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
      mobile: item.mobile,
    }));
  });

export const getProjectOverview = baseFunction
  .inputValidator((data: ProjectOverviewInput) =>
    ProjectOverviewSchema.parse(data),
  )
  .handler(async (ctx) => {
    const db = initDatabase(env.DB);
    const project = await db
      .select({ id: projects.id, name: projects.name, retentionDays: projects.retentionDays })
      .from(projects)
      .where(and(eq(projects.id, ctx.data.projectId), eq(projects.userId, ctx.context.userId)))
      .get();

    if (!project) {
      throw new Error("Project not found");
    }

    const now = Date.now();
    const sinceMs = now - Math.min(30, project.retentionDays) * 86400000;
    const [summary, lastEvent, diagnostics, domains] = await Promise.all([
      db.select({
        total: sql<number>`count(*)`,
        mobile: sql<number>`coalesce(sum(case when ${events.mobile} = 1 then 1 else 0 end), 0)`,
        classified: sql<number>`count(${events.mobile})`,
        uniqueIps: sql<number>`count(distinct ${events.ipAddress})`,
      }).from(events).where(and(eq(events.projectId, project.id), gte(events.timestamp, new Date(sinceMs)), lt(events.timestamp, new Date(now)))).get(),
      db.select({ timestamp: events.timestamp }).from(events).where(and(eq(events.projectId, project.id), gte(events.timestamp, new Date(now - project.retentionDays * 86400000)), lt(events.timestamp, new Date(now))))
        .orderBy(desc(events.timestamp), desc(events.id)).limit(1).get(),
      db.select().from(ingestionDiagnostics).where(and(eq(ingestionDiagnostics.projectId, project.id), gte(ingestionDiagnostics.day, Math.floor(now / 86400000) - 1))),
      db.select({ id: projectDomains.id }).from(projectDomains).where(eq(projectDomains.projectId, project.id)),
    ]);
    return {
      projectId: project.id, name: project.name, retentionDays: project.retentionDays,
      totalEvents: summary?.total ?? 0, mobileEvents: summary?.mobile ?? 0,
      classifiedEvents: summary?.classified ?? 0, uniqueIps: summary?.uniqueIps ?? 0,
      lastEventAt: lastEvent?.timestamp ?? null, diagnostics, domainCount: domains.length,
      collectorOrigin: env.COLLECTOR_ORIGIN ?? "", since: new Date(sinceMs),
    };
  });

export const listProjectDomains = baseFunction
  .inputValidator((data: ListProjectDomainsInput) =>
    ListProjectDomainsSchema.parse(data),
  )
  .handler(async (ctx) => {
    const db = initDatabase(env.DB);
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

export const addProjectDomain = mutationFunction
  .inputValidator((data: AddProjectDomainInput) =>
    AddProjectDomainSchema.parse(data),
  )
  .handler(async (ctx) => {
    const db = initDatabase(env.DB);
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

export const updateProjectDomain = mutationFunction
  .inputValidator((data: UpdateProjectDomainInput) =>
    UpdateProjectDomainSchema.parse(data),
  )
  .handler(async (ctx) => {
    const db = initDatabase(env.DB);
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

export const deleteProjectDomain = mutationFunction
  .inputValidator((data: DeleteProjectDomainInput) =>
    DeleteProjectDomainSchema.parse(data),
  )
  .handler(async (ctx) => {
    const db = initDatabase(env.DB);
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

export const updateRetention = mutationFunction.inputValidator(data => RetentionSchema.parse(data)).handler(async ctx => {
  const db = initDatabase(env.DB);
  if (!await assertProjectOwner(ctx.data.projectId, ctx.context.userId, db)) throw new Error("Project not found");
  await db.update(projects).set({ retentionDays: ctx.data.retentionDays }).where(eq(projects.id, ctx.data.projectId));
  return { success: true };
});

export const deleteProjectEvents = mutationFunction.inputValidator(data => ProjectIdSchema.parse(data)).handler(async ctx => {
  const db = initDatabase(env.DB);
  if (!await assertProjectOwner(ctx.data.projectId, ctx.context.userId, db)) throw new Error("Project not found");
  await db.batch([
    db.delete(enrichmentCache).where(sql`${enrichmentCache.ipAddress} in (select ip_address from events where project_id = ${ctx.data.projectId})`),
    db.delete(events).where(eq(events.projectId, ctx.data.projectId)),
    db.delete(ingestionDiagnostics).where(eq(ingestionDiagnostics.projectId, ctx.data.projectId)),
  ]);
  return { success: true };
});
