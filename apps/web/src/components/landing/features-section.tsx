import {
  Layers3,
  Cable,
  Clock,
  FileDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const workflowFeatures = [
  {
    icon: Layers3,
    title: "Project workspaces",
    description:
      "Organize analytics by product, environment, or client with isolated dashboards.",
    badge: "Organize",
  },
  {
    icon: Cable,
    title: "Collector scripts",
    description:
      "Allow your site’s hostname, install one script, and verify the first document-load event.",
    badge: "Deploy",
  },
  {
    icon: Clock,
    title: "Retention controls",
    description:
      "Keep event history for 1–365 days, or delete a project’s events when needed.",
    badge: "Control",
  },
  {
    icon: FileDown,
    title: "Portable exports",
    description:
      "Download event history for a chosen date range with stable event IDs.",
    badge: "Data",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h3 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Built for operators, analysts, and growth teams
          </h3>
          <p className="mt-4 text-lg text-muted-foreground">
            Everything you need to go from raw traffic to clear decisions.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-6 lg:mx-0 lg:max-w-none lg:grid-cols-2">
          {workflowFeatures.map((feature) => {
            const IconComponent = feature.icon;
            return (
              <Card
                key={feature.title}
                className="group border-border/60 bg-background/80 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <IconComponent className="h-5 w-5 text-primary" />
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {feature.badge}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
