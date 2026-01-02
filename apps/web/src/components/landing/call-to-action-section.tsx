import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function CallToActionSection() {
  return (
    <section className="w-full py-20 bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-5xl mx-auto text-center">
          <Badge className="mb-4" variant="secondary">
            Launch in minutes
          </Badge>

          <h2 className="text-3xl md:text-4xl font-semibold mb-4">
            Turn traffic into geographic intelligence
          </h2>

          <p className="text-lg text-muted-foreground mb-10">
            Start collecting events now and see your audience shape up across
            regions, providers, and device classes. Everything updates live.
          </p>

          <div className="grid md:grid-cols-2 gap-6 mb-10 text-left">
            <div className="rounded-2xl border border-border/60 bg-background/80 p-6">
              <h3 className="font-semibold text-lg mb-3">
                What you get on day one
              </h3>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5" />
                  <span className="text-sm">Live geo map with clustering</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5" />
                  <span className="text-sm">IP-level event stream</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5" />
                  <span className="text-sm">Proxy + mobile classification</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5" />
                  <span className="text-sm">Export-ready datasets</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-background/80 p-6">
              <h3 className="font-semibold text-lg mb-3">
                Designed for modern teams
              </h3>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5" />
                  <span className="text-sm">Multi-project dashboards</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5" />
                  <span className="text-sm">Role-aware access</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5" />
                  <span className="text-sm">Privacy-first collection</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5" />
                  <span className="text-sm">Edge-ready performance</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/dashboard">
              <Button size="lg" className="group">
                Start monitoring
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
