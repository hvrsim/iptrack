import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Sparkles,
  Radar,
  ShieldCheck,
  Globe2,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";

export function HeroSection() {
  const session = authClient.useSession();
  const isLoggedIn = Boolean(session.data);
  const primaryHref = "/dashboard";
  const primaryLabel = isLoggedIn ? "Open dashboard" : "Get started";

  return (
    <section className="relative px-6 lg:px-8 py-24 sm:py-32 overflow-hidden">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <div className="mb-6 flex flex-wrap gap-2">
              <Badge variant="secondary">
                <Sparkles className="mr-1 h-3 w-3" />
                Advanced Analytics
              </Badge>
              <Badge variant="secondary">
                <Globe2 className="mr-1 h-3 w-3" />
                Geospatial Intelligence
              </Badge>
              <Badge variant="secondary">
                <ShieldCheck className="mr-1 h-3 w-3" />
                Privacy-First
              </Badge>
            </div>

            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
              Turn global traffic into{" "}
              <span className="text-primary">actionable intelligence</span>
            </h1>

            <p className="mt-6 text-lg leading-8 text-muted-foreground max-w-2xl">
              Understand visitors instantly with live event streams, precision
              geo insights, and anomaly signals. Built for teams that need
              depth, not just dashboards.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <Link to={primaryHref}>
                <Button size="lg" className="group">
                  {primaryLabel}
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>

              <Link to="/#features">
                <Button variant="outline" size="lg">
                  Explore features
                </Button>
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Radar className="h-4 w-4 text-primary" />
                Real-time event signal
              </div>
              <div className="flex items-center gap-2">
                <Globe2 className="h-4 w-4 text-primary" />
                City-level geo precision
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                No PII storage
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-10 rounded-full bg-gradient-to-tr from-primary/20 via-transparent to-secondary/20 blur-3xl" />
            <div className="relative mx-auto w-full max-w-md">
              <div className="relative aspect-square rounded-full border border-border/60 bg-background/80 shadow-2xl">
                <div className="absolute inset-6 rounded-full border border-primary/20 shadow-[inset_0_0_40px_rgba(16,185,129,0.12)]" />
                <div className="absolute inset-0 rounded-full globe-pulse-ring" />
                <svg
                  className="relative h-full w-full"
                  viewBox="0 0 400 400"
                  aria-hidden="true"
                >
                  <circle
                    cx="200"
                    cy="200"
                    r="150"
                    className="fill-primary/10"
                  />
                  <circle
                    cx="200"
                    cy="200"
                    r="150"
                    className="stroke-primary/30"
                    fill="none"
                    strokeWidth="2"
                  />
                  <g className="globe-spin">
                    <ellipse
                      cx="200"
                      cy="200"
                      rx="120"
                      ry="150"
                      className="stroke-foreground/15"
                      fill="none"
                      strokeWidth="1.2"
                    />
                    <ellipse
                      cx="200"
                      cy="200"
                      rx="80"
                      ry="150"
                      className="stroke-foreground/10"
                      fill="none"
                      strokeWidth="1"
                    />
                    <circle
                      cx="200"
                      cy="200"
                      r="105"
                      className="stroke-foreground/10"
                      fill="none"
                      strokeWidth="1"
                    />
                    <circle
                      cx="200"
                      cy="200"
                      r="55"
                      className="stroke-foreground/10"
                      fill="none"
                      strokeWidth="1"
                    />
                  </g>
                  <g className="globe-spin-slow">
                    <path
                      d="M55 180 C 130 120 270 120 345 180"
                      className="stroke-primary/50 globe-dash"
                      fill="none"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M70 240 C 150 285 250 285 330 240"
                      className="stroke-secondary/50 globe-dash-alt"
                      fill="none"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M120 120 C 200 160 240 240 280 300"
                      className="stroke-primary/40 globe-dash"
                      fill="none"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </g>
                  <g>
                    <circle
                      cx="140"
                      cy="170"
                      r="4"
                      className="fill-primary globe-pulse"
                    />
                    <circle
                      cx="260"
                      cy="150"
                      r="3"
                      className="fill-secondary globe-pulse globe-pulse-delay"
                    />
                    <circle
                      cx="230"
                      cy="260"
                      r="4"
                      className="fill-primary globe-pulse globe-pulse-delay-2"
                    />
                    <circle
                      cx="170"
                      cy="250"
                      r="2.5"
                      className="fill-foreground/70 globe-pulse"
                    />
                  </g>
                </svg>
                <div className="absolute inset-12 rounded-full border border-foreground/10" />
              </div>
              <div className="mt-6 flex items-center justify-center text-xs text-muted-foreground">
                <span className="sr-only">IP Track globe animation</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
