/* eslint-disable @typescript-eslint/no-explicit-any */
import { RadialBar, RadialBarChart, Legend } from "recharts";
import { formatCurrency } from "@/lib/utils";
import { ChartConfig, ChartContainer } from "@/components/ui/chart";

type Props = {
  data?: {
    value: number;
    name: string;
  }[];
};

const chartConfig = {
  category: { label: "Category" },
} satisfies ChartConfig;

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const RadialVariant = ({ data = [] }: Props) => {
  return (
    <ChartContainer config={chartConfig} className="h-87.5 w-full">
      <RadialBarChart
        cx="50%"
        cy="30%"
        barSize={10}
        innerRadius="90%"
        outerRadius="40%"
        data={data.map((item, index) => ({
          ...item,
          fill: CHART_COLORS[index % CHART_COLORS.length],
        }))}
      >
        <RadialBar
          label={{
            position: "insideStart",
            fill: "var(--background)",
            fontSize: "12px",
          }}
          background={{ fill: "var(--muted)" }}
          dataKey="value"
          className="drop-shadow-sm"
          animationDuration={1500}
        />
        <Legend
          layout="horizontal"
          verticalAlign="bottom"
          align="right"
          iconType="circle"
          content={({ payload }) => (
            <ul className="flex flex-col space-y-2 mt-4">
              {payload?.map((entry: any, index: number) => (
                <li
                  key={`item-${index}`}
                  className="flex items-center space-x-2"
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: entry?.color }}
                  />
                  <div className="flex items-center space-x-1.5">
                    <span className="text-sm font-medium text-muted-foreground">
                      {entry?.value}
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {formatCurrency(entry?.payload.value)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        />
      </RadialBarChart>
    </ChartContainer>
  );
};

export default RadialVariant;
