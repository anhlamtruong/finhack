import { DashboardAgentTrigger } from "@/services/ai-agent/components/dashboard-agent-trigger";
import { DataCharts } from "@/services/dashboard/components/data-charts";
import { DataGrid } from "@/services/dashboard/components/data-grid";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard | FinHack Finance",
  description:
    "Your financial command center. View your live net worth, monitor shared accounts, and get AI-powered insights on your spending limits.",
  openGraph: {
    title: "Financial Dashboard | FinHack Finance",
    description: "View your live net worth and monitor shared accounts.",
    url: "https://chuchube.co/dashboard",
  },
};

export default function DashboardPage() {
  return (
    <div className="max-w-7xl mx-auto w-full pb-10 -mt-16 ">
      <DataGrid />
      <DataCharts />
      <DashboardAgentTrigger />
    </div>
  );
}
