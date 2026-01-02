import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Header } from "@/components/layout/header";
import { GitHubLogin } from "@/components/auth/github-login";
import { authClient } from "@/lib/auth-client";
import { seo } from "@/utils/seo";

export const Route = createFileRoute("/_auth")({
  head: () => ({
    meta: [
      ...seo({
        title: "IP Track | Sign in",
        description: "Sign in to manage your IP Track projects.",
      }),
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const session = authClient.useSession();

  return (
    <>
      {session.isPending ? (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : session.data ? (
        <div className="flex h-screen bg-background overflow-hidden">
          <div className="flex flex-1 flex-col overflow-hidden">
            <Header />

            <main className="flex-1 overflow-y-auto bg-muted/20 p-6">
              <div className="mx-auto max-w-7xl">
                <Outlet />
              </div>
            </main>
          </div>
        </div>
      ) : (
        <GitHubLogin />
      )}
    </>
  );
}
