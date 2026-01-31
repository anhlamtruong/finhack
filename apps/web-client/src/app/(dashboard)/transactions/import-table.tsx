import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableHeadSelect } from "./table-head-select";

type Props = {
  headers: string[];
  body: string[][];
  selectedColumns: Record<string, string | null>;
  onTableHeaderSelectChange: (
    columnIndex: number,
    value: string | null,
  ) => void;
};

export const ImportTable = ({
  headers,
  body,
  selectedColumns,
  onTableHeaderSelectChange,
}: Props) => {
  return (
    <div className=" rounded-md border overflow-hidden">
      <Table>
        <TableCaption>A list of your recent imported csv.</TableCaption>
        <TableHeader className="bg-muted">
          <TableRow>
            {headers.map((header, index) => {
              return (
                <TableHead key={index}>
                  <TableHeadSelect
                    columnIndex={index}
                    selectedColumns={selectedColumns}
                    onChange={onTableHeaderSelectChange}
                  />
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {body.map((row: string[], index) => {
            return (
              <TableRow key={index}>
                {row.map((cell, index) => {
                  return <TableCell key={index}>{cell}</TableCell>;
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
