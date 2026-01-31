import { CompanionsList } from "@/services/ai-agent/components/companions-list";
import { CompanionLayoutCard } from "@/services/ai-agent/components/companion-layout-card";

export default function CompanionsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 pb-12">
      <CompanionLayoutCard
        title="Companions"
        description="Manage your summoned companions and their details."
      >
        <CompanionsList />
      </CompanionLayoutCard>
    </div>
  );
}
