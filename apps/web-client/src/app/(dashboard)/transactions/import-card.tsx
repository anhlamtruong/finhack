/* eslint-disable @typescript-eslint/no-explicit-any */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { ImportTable } from "./import-table";
import { Ban } from "lucide-react";
import { convertAmountFromMiliunits } from "@/lib/utils";
import { format, parse } from "date-fns";

const DATE_FORMAT = "yyyy-MM-dd HH:mm:ss";
const OUTPUT_DATE_FORMAT = "yyyy-MM-dd";
const REQUIRE_OPTIONS = ["amount", "date", "payee"];

interface SelectedColumnState {
  [key: string]: string | null;
}
type Props = {
  id?: string;
  data: string[][];
  onCancel: () => void;
  onSubmit: (data: any) => void;
};

//TODO: Improve UX
export const ImportCard = ({ data, onCancel, onSubmit }: Props) => {
  const [selectedColumns, setSelectedColumns] = useState<SelectedColumnState>(
    {},
  );

  const headers = data[0];
  const body = data.slice(1);

  const onTableHeadSelectChange = (
    columnIndex: number,
    value: string | null,
  ) => {
    setSelectedColumns((prev) => {
      const newSelectedColumns = { ...prev };
      for (const key in newSelectedColumns) {
        if (newSelectedColumns[key] === value) {
          newSelectedColumns[key] = null;
        }
      }
      if (value === "skip") {
        value = null;
      }

      newSelectedColumns[`column_${columnIndex}`] = value;
      return newSelectedColumns;
    });
  };

  const progress = Object.values(selectedColumns).filter(Boolean).length;

  const handleContinue = () => {
    const getColumnIndex = (column: string) => {
      return column.split("_")[1];
    };
    const mappedData = {
      headers: headers.map((_header, index) => {
        const columnIndex = getColumnIndex(`column_${index}`);
        return selectedColumns[`column_${columnIndex}`] || null;
      }),
      body: body
        .map((row) => {
          const transformedRow = row.map((cell, index) => {
            const columnIndex = getColumnIndex(`column_${index}`);
            return selectedColumns[`column_${columnIndex}`] ? cell : null;
          });
          return transformedRow.every((item) => item === null)
            ? []
            : transformedRow;
        })
        .filter((row) => row.length > 0),
    };

    const arrayOfData = mappedData.body.map((row) => {
      return row.reduce((acc: any, cell, index) => {
        const header = mappedData.headers[index];
        if (header !== null) {
          acc[header] = cell;
        }
        return acc;
      }, {});
    });
    const formattedData = arrayOfData.map((item) => {
      return {
        ...item,
        amount: convertAmountFromMiliunits(item.amount),
        date: format(
          parse(item.date, DATE_FORMAT, new Date()),
          OUTPUT_DATE_FORMAT,
        ),
      };
    });
    onSubmit(formattedData);
  };

  return (
    <div className="max-w-7xl mx-auto w-full pb-10 -mt-24">
      <Card className=" border-none drop-shadow-sm">
        <CardHeader className=" gap-y-2 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className=" text-xl line-clamp-1">
            Import Transaction By CSV
          </CardTitle>
          <Button variant={"destructive"} onClick={onCancel} size={"sm"}>
            Cancel
            <Ban className="size-4" />
          </Button>
          <Button
            disabled={progress < REQUIRE_OPTIONS.length}
            onClick={handleContinue}
            size={"sm"}
          >
            Continue ({progress}/{REQUIRE_OPTIONS.length})
          </Button>
        </CardHeader>
        <CardContent>
          <ImportTable
            headers={headers}
            body={body}
            selectedColumns={selectedColumns}
            onTableHeaderSelectChange={onTableHeadSelectChange}
          />
        </CardContent>
      </Card>
    </div>
  );
};
