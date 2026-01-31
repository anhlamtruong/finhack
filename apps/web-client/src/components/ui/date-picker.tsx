import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { Calendar } from "@/components/ui/calendar";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "./button";
import { cn } from "@/lib/utils";
type Props = {
  value?: Date;
  onChange?: (date?: Date) => void;
  disabled: boolean;
};

export function DatePicker({ value, onChange, disabled }: Props) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          id="date"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal transition-colors",
            !value && "text-muted-foreground",
            value && "border-primary/50 text-foreground",
          )}
        >
          <CalendarIcon
            className={cn(
              "size-4 mr-2",
              value ? "text-primary" : "text-muted-foreground",
            )}
          />
          {value ? format(value, "PPP") : "Select a date"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto overflow-hidden p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          captionLayout="dropdown"
          onSelect={onChange}
          disabled={disabled}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
