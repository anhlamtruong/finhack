/* eslint-disable @typescript-eslint/no-explicit-any */
import { PieChart, Pie, Cell, Legend } from "recharts";
import { formatPercentage } from "@/lib/utils";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

type Props = {
  data?: {
    value: number;
    name: string;
  }[];
};

const chartConfig = {
  category: {
    label: "Category",
  },
} satisfies ChartConfig;

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const PieVariant = ({ data = [] }: Props) => {
  return (
    <ChartContainer config={chartConfig} className="h-87.5 w-full">
      <PieChart>
        <ChartTooltip
          content={<ChartTooltipContent indicator="dot" className="w-45" />}
        />
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          outerRadius={90}
          innerRadius={60}
          paddingAngle={2}
          dataKey="value"
          labelLine={false}
          className="drop-shadow-sm"
          animationDuration={1500}
        >
          {data.map((_entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={CHART_COLORS[index % CHART_COLORS.length]}
              stroke="var(--background)"
              strokeWidth={2}
            />
          ))}
        </Pie>
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
                      {formatPercentage(entry?.payload.percent * 100)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        />
      </PieChart>
    </ChartContainer>
  );
};

export default PieVariant;
