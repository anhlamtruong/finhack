import {
  Radar,
  RadarChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
} from "recharts";
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
  value: {
    label: "Spending",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const RadarVariant = ({ data = [] }: Props) => {
  return (
    <ChartContainer config={chartConfig} className="h-87.5 w-full">
      <RadarChart cx="50%" cy="50%" outerRadius="60%" data={data}>
        <PolarGrid className="stroke-muted" />
        <PolarAngleAxis
          dataKey="name"
          className="text-muted-foreground text-xs font-medium"
        />
        <PolarRadiusAxis
          angle={30}
          domain={[0, "auto"]}
          className="text-muted-foreground text-xs font-medium"
        />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent indicator="dot" />}
        />
        <Radar
          dataKey="value"
          stroke="var(--chart-1)"
          fill="var(--chart-1)"
          fillOpacity={0.6}
          animationDuration={1500}
        />
      </RadarChart>
    </ChartContainer>
  );
};

export default RadarVariant;
