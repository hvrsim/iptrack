import { Badge } from "@/components/ui/badge";
import { MapPinned, Radio, Route } from "lucide-react";

export function GeospatialInsightsSection() {
  return (
    <section
      id="geospatial-insights"
      className="py-20 bg-gradient-to-b from-background to-muted/20"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline" className="mb-4">
            <MapPinned className="h-3 w-3 mr-1" />
            Geospatial Context
          </Badge>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            See geography, not just numbers
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            IP Track plots the latest 30 geolocated document loads. Locations
            are approximate and refresh while your dashboard is active.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-border/60 bg-background/80 p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
              <MapPinned className="h-5 w-5 text-primary" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              Recent locations
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Explore the approximate locations of your latest geolocated events.
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/80 p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
              <Radio className="h-5 w-5 text-primary" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              Network context
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              See network details when optional classification is available. Missing results stay unknown.
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/80 p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
              <Route className="h-5 w-5 text-primary" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              Document loads
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Count initial document loads. SPA route changes, sessions, and visitor journeys are not tracked.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
