import { createFileRoute } from "@tanstack/react-router";
import { ProjectsDashboard } from "@/components/projects/projects-dashboard";
import { seo } from "@/utils/seo";

export const Route = createFileRoute("/_auth/dashboard/")({
  head: () => ({
    meta: [
      ...seo({
        title: "IP Track | Dashboard",
        description: "Overview of your IP Track projects and activity.",
      }),
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <ProjectsDashboard />;
}
