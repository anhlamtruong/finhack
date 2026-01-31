import CurrencyInput from "react-currency-input-field";
import { Info, MinusCircle, PlusCircle } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
};

export const AmountInput = ({
  value,
  onChange,
  placeholder,
  disabled,
  id,
}: Props) => {
  const parsedValue = parseFloat(value);
  const isIncome = parsedValue > 0;
  const isExpense = parsedValue < 0;

  const onReverseValue = () => {
    if (!value) return;
    const newValue = parseFloat(value) * -1;
    onChange(newValue.toString());
  };

  return (
    <div className="relative">
      <TooltipProvider>
        <Tooltip delayDuration={100}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onReverseValue}
              className={cn(
                "absolute left-1.5 top-1.5 flex size-7 items-center justify-center rounded-md p-2 transition",

                !isIncome && !isExpense && "bg-muted hover:bg-accent",

                isIncome && "bg-primary hover:bg-primary/90",

                isExpense && "bg-destructive hover:bg-destructive/90",
              )}
            >
              {!parsedValue && (
                <Info className="size-3 text-muted-foreground" />
              )}
              {isIncome && (
                <PlusCircle className="size-3 text-primary-foreground" />
              )}
              {isExpense && (
                <MinusCircle className="size-3 text-destructive-foreground" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            Click to flip sign ([+] Income vs [-] Expense)
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <CurrencyInput
        id={id}
        prefix="$"
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-10 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",

          isExpense
            ? "focus-visible:ring-destructive"
            : "focus-visible:ring-ring",
        )}
        placeholder={placeholder}
        value={value}
        decimalsLimit={2}
        decimalScale={2}
        onValueChange={onChange}
        disabled={disabled}
      />
      <div className="mt-1 flex justify-between px-1">
        <p
          className={cn(
            "text-xs",
            isIncome && "text-primary font-medium",
            isExpense && "text-destructive font-medium",
            !isIncome && !isExpense && "text-muted-foreground",
          )}
        >
          {isIncome && "Income (+)"}
          {isExpense && "Expense (-)"}
          {!isIncome && !isExpense && "Enter an amount"}
        </p>
        <p className="text-xs text-muted-foreground">USD</p>
      </div>
    </div>
  );
};
