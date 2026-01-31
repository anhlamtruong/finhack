import { CompanionDetail } from "@/services/ai-agent/components/companion-detail";
import { CompanionLayoutCard } from "@/services/ai-agent/components/companion-layout-card";

export default function CompanionDetailPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 pb-12">
      <CompanionLayoutCard
        title="Companion details"
        description="Inspect your guardian, stats, and companion history."
      >
        <CompanionDetail />
      </CompanionLayoutCard>
    </div>
  );
}
