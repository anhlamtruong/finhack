"use client";

import { CalendarIcon, ChevronDown } from "lucide-react";
import { useState } from "react";
import { format, subDays } from "date-fns";
import { DateRange } from "react-day-picker";
import qs from "query-string";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn, formatDateRange } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";

const DateFilter = () => {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const accountId = params.get("accountId") || "";
  const from = params.get("from") || "";
  const to = params.get("to") || "";

  const defaultTo = new Date();
  const defaultFrom = subDays(defaultTo, 30);
  const paramState = {
    from: from ? new Date(from) : defaultFrom,
    to: to ? new Date(to) : defaultTo,
  };

  const [date, setDate] = useState<DateRange | undefined>(paramState);

  const pushToUrl = (rangeDate?: DateRange | undefined) => {
    const query = {
      from: format(rangeDate?.from || defaultFrom, "yyyy-MM-dd"),
      to: format(rangeDate?.to || defaultTo, "yyyy-MM-dd"),
      accountId: accountId || undefined,
    };

    const url = qs.stringifyUrl(
      { url: pathname, query },
      { skipNull: true, skipEmptyString: true }
    );
    router.push(url);
  };

  const onReset = () => {
    setDate({ from: defaultFrom, to: defaultTo });
    pushToUrl({ from: defaultFrom, to: defaultTo });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className={cn(
            "lg:w-auto w-full h-9 px-4 rounded-full font-medium bg-white/10 hover:bg-white hover:text-primary border border-white/10 backdrop-blur-md text-white outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-0 transition-all duration-200 flex items-center justify-between gap-x-2",
            !date && "opacity-70"
          )}
        >
          <div className="flex items-center gap-x-2">
            <CalendarIcon className="size-4 opacity-70" />
            <span>{formatDateRange(paramState)}</span>
          </div>
          <ChevronDown className="size-4 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="lg:w-auto w-full p-0 shadow-xl border-border bg-card rounded-xl"
        align="start"
      >
        <Calendar
          initialFocus
          mode="range"
          defaultMonth={date?.from}
          selected={date}
          onSelect={setDate}
          numberOfMonths={2}
        />

        <div className="p-3 bg-muted/30 border-t flex items-center justify-end gap-x-2">
          <PopoverClose asChild>
            <Button
              disabled={!date?.from || !date?.to}
              onClick={onReset}
              variant="ghost"
              size="sm"
            >
              Reset
            </Button>
          </PopoverClose>
          <PopoverClose asChild>
            <Button
              disabled={!date?.from || !date?.to}
              onClick={() => pushToUrl(date)}
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Apply Filter
            </Button>
          </PopoverClose>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default DateFilter;
