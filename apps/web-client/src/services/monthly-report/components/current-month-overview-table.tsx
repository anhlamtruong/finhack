"use client";

import { DataTable } from "@/components/ui/data-table";
import {
  currentMonthOverviewColumns,
  type CurrentMonthCategoryRow,
} from "@/services/monthly-report/components/current-month-overview-columns";

type CurrentMonthOverviewTableProps = {
  data: CurrentMonthCategoryRow[];
};

export const CurrentMonthOverviewTable = ({
  data,
}: CurrentMonthOverviewTableProps) => (
  <DataTable
    defaultFilterKey="name"
    columns={currentMonthOverviewColumns}
    data={data}
    onDelete={() => undefined}
  />
);
