import { Metadata } from "next";
import { WizardContainer } from "@/services/ai-agent/components/creation-wizard/wizard-container";
import { CompanionLayoutCard } from "@/services/ai-agent/components/companion-layout-card";

export const metadata: Metadata = {
  title: "Companion Summoning | FinHack Finance",
  description:
    "Create and awaken your AI financial companion with a personalized wizard.",
};

export default function CompanionNewPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 pb-12">
      <CompanionLayoutCard
        title="Create your companion"
        description="Summon a draft, preview the vibe, and awaken your financial guardian."
      >
        <WizardContainer />
      </CompanionLayoutCard>
    </div>
  );
}
