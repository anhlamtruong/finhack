import { format, isValid, parseISO } from "date-fns";
import { XAxis, AreaChart, Area, CartesianGrid, YAxis } from "recharts";

import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

type Props = {
  data: {
    date: string;
    income: number;
    expenses: number;
  }[];
};

const chartConfig = {
  income: {
    label: "Income",
    color: "var(--chart-2)",
  },
  expenses: {
    label: "Expenses",
    color: "var(--chart-5)",
  },
} satisfies ChartConfig;

const AreaVariant = ({ data = [] }: Props) => {
  return (
    <ChartContainer config={chartConfig} className="h-87.5 w-full">
      <AreaChart
        data={data}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          className="stroke-muted"
        />

        <defs>
          <linearGradient id="fillIncome" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopColor="var(--color-income)"
              stopOpacity={0.8}
            />
            <stop
              offset="95%"
              stopColor="var(--color-income)"
              stopOpacity={0.1}
            />
          </linearGradient>
          <linearGradient id="fillExpenses" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopColor="var(--color-expenses)"
              stopOpacity={0.8}
            />
            <stop
              offset="95%"
              stopColor="var(--color-expenses)"
              stopOpacity={0.1}
            />
          </linearGradient>
        </defs>

        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={12}
          minTickGap={32}
          className="text-muted-foreground text-xs font-medium"
          tickFormatter={(value) => {
            if (!value) return "";

            const date =
              typeof value === "string" ? parseISO(value) : new Date(value);

            if (!isValid(date)) {
              return String(value);
            }
            return format(date, "MMM dd");
          }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          className="text-muted-foreground text-xs font-medium"
          tickFormatter={(value) => `$${value}`}
        />

        <ChartTooltip
          cursor={{
            stroke: "hsl(var(--muted-foreground))",
            strokeWidth: 1,
            strokeDasharray: "4 4",
          }}
          content={<ChartTooltipContent indicator="dot" className="w-45" />}
        />
        <ChartLegend content={<ChartLegendContent />} />

        <Area
          type="natural"
          dataKey="expenses"
          stackId="expenses"
          stroke="var(--color-expenses)"
          strokeWidth={3}
          fill="url(#fillExpenses)"
          className="drop-shadow-sm"
          animationDuration={1500}
          animationEasing="ease-in-out"
        />
        <Area
          type="natural"
          dataKey="income"
          stackId="income"
          stroke="var(--color-income)"
          strokeWidth={3}
          fill="url(#fillIncome)"
          className="drop-shadow-sm"
          animationDuration={1500}
          animationEasing="ease-in-out"
        />
      </AreaChart>
    </ChartContainer>
  );
};

export default AreaVariant;
