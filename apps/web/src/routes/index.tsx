import { createFileRoute } from "@tanstack/react-router";
import { NavigationBar } from "@/components/navigation";
import { HeroSection } from "@/components/landing/hero-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { GeospatialInsightsSection } from "@/components/landing/geospatial-insights-section";
import { CallToActionSection } from "@/components/landing/call-to-action-section";
import { Footer } from "@/components/landing/footer";
import { seo } from "@/utils/seo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      ...seo({
        title: "IP Track | Home",
        description: "IP analytics and tracking for your sites.",
      }),
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <NavigationBar />
      <main>
        <HeroSection />
        <GeospatialInsightsSection />
        <FeaturesSection />
        <CallToActionSection />
      </main>
      <Footer />
    </div>
  );
}
