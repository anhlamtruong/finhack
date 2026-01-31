import { DashboardAgentTrigger } from "@/services/ai-agent/components/dashboard-agent-trigger";
import { DataCharts } from "@/services/dashboard/components/data-charts";
import { DataGrid } from "@/services/dashboard/components/data-grid";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard | Chuchube Finance",
  description:
    "Your financial command center. View your live net worth, monitor shared accounts, and get AI-powered insights on your spending limits.",
  openGraph: {
    title: "Financial Dashboard | Chuchube Finance",
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
