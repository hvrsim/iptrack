import { relations } from "drizzle-orm/relations";
import { auth_user } from "./auth-schema";
import { projectDomains, projects } from "./schema";

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(auth_user, {
    fields: [projects.userId],
    references: [auth_user.id],
  }),
  domains: many(projectDomains),
}));

export const projectDomainsRelations = relations(projectDomains, ({ one }) => ({
  project: one(projects, {
    fields: [projectDomains.projectId],
    references: [projects.id],
  }),
}));
