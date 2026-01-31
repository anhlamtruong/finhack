import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Target, Radar, FileSearch } from "lucide-react";

import { useState } from "react";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import PieVariant from "./pie-variant";
import RadarVariant from "./radar-variant";
import RadialVariant from "./radial-variant";
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  data?: {
    value: number;
    name: string;
  }[];
};

enum ChartType {
  Pie = "pie",
  Radar = "radar",
  Radial = "radial",
}

export const SpendingPieChart = ({ data = [] }: Props) => {
  const [chartType, setChartType] = useState<ChartType>(ChartType.Pie);

  const onChangeType = (type: ChartType) => {
    setChartType(type);
  };

  return (
    <Card className="border bg-card text-card-foreground shadow-xs transition-all hover:shadow-md">
      <CardHeader className="flex space-y-2 lg:space-y-0 lg:flex-row lg:items-center justify-between pb-2">
        <CardTitle className="text-xl font-semibold tracking-tight line-clamp-1">
          Categories
        </CardTitle>
        <Select defaultValue={chartType} onValueChange={onChangeType}>
          <SelectTrigger className="lg:w-auto h-9 rounded-md">
            <SelectValue placeholder="Select chart type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ChartType.Pie}>
              <div className="flex items-center">
                <PieChart className="size-4 mr-2 shrink-0" />
                <p className="line-clamp-1">Pie Chart</p>
              </div>
            </SelectItem>
            <SelectItem value={ChartType.Radar}>
              <div className="flex items-center">
                <Radar className="size-4 mr-2 shrink-0" />
                <p className="line-clamp-1">Radar Chart</p>
              </div>
            </SelectItem>
            <SelectItem value={ChartType.Radial}>
              <div className="flex items-center">
                <Target className="size-4 mr-2 shrink-0" />
                <p className="line-clamp-1">Radial Chart</p>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="mt-2">
        {data.length === 0 ? (
          <div className="flex flex-col gap-y-4 items-center justify-center h-87.5 w-full">
            <FileSearch className="size-6 text-muted-foreground" />
            <p className="text-muted-foreground text-sm font-medium">
              No data for this period
            </p>
          </div>
        ) : (
          <>
            {chartType === ChartType.Pie && <PieVariant data={data} />}
            {chartType === ChartType.Radar && <RadarVariant data={data} />}
            {chartType === ChartType.Radial && <RadialVariant data={data} />}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export const SpendingPieLoading = () => {
  return (
    <Card className="border shadow-xs h-112.5">
      <CardHeader className="flex lg:flex-row lg:items-center justify-between lg:space-y-0 space-y-2 pb-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 lg:w-35 w-full" />
      </CardHeader>
      <CardContent className="mt-2">
        <div className="h-87.5 w-full flex items-center justify-center">
          <Skeleton className="size-62.5 rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
};
