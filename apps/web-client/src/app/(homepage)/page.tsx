import { Hero } from "@/services/homepage/components/hero";
import { SocialProof } from "@/services/homepage/components/social-proof";
import { Features } from "@/services/homepage/components/features";
import { Security } from "@/services/homepage/components/security";
import { CTA } from "@/services/homepage/components/cta";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary/20">
      <main className="flex-1">
        <Hero />
        <SocialProof />
        <Features />
        <Security />
        <CTA />
      </main>
    </div>
  );
}
