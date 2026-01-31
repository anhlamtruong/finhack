import { format, parseISO, isValid } from "date-fns";
import { XAxis, LineChart, Line, CartesianGrid, YAxis } from "recharts";

import {
  ChartConfig,
  ChartContainer,
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

const LineVariant = ({ data = [] }: Props) => {
  return (
    <ChartContainer config={chartConfig} className="h-87.5 w-full">
      <LineChart
        data={data}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          className="stroke-muted"
        />

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
            if (!isValid(date)) return String(value);
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
          content={
            <ChartTooltipContent
              indicator="dot"
              className="w-45"
              labelFormatter={(label) => {
                const date = parseISO(label as string);
                return isValid(date) ? format(date, "MMM dd, yyyy") : label;
              }}
            />
          }
        />

        <Line
          type="natural"
          dataKey="expenses"
          stroke="var(--color-expenses)"
          strokeWidth={3}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
          className="drop-shadow-sm"
          animationDuration={1500}
          animationEasing="ease-in-out"
        />
        <Line
          type="natural"
          dataKey="income"
          stroke="var(--color-income)"
          strokeWidth={3}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
          className="drop-shadow-sm"
          animationDuration={1500}
          animationEasing="ease-in-out"
        />
      </LineChart>
    </ChartContainer>
  );
};

export default LineVariant;
