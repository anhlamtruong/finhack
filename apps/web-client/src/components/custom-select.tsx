"use client";

import { useMemo } from "react";
import { SingleValue } from "react-select";
import CreateableSelect from "react-select/creatable";

type Props = {
  onChange: (value?: string) => void;
  onCreate?: (value: string) => void;
  options?: { label: string; value: string }[];
  value?: string | null | undefined;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
};

export const CustomSelect = ({
  value,
  onChange,
  disabled,
  onCreate,
  options = [],
  placeholder,
  id,
}: Props) => {
  const onSelect = (option: SingleValue<{ label: string; value: string }>) => {
    onChange(option?.value);
  };

  const formattedValue = useMemo(() => {
    return options.find((option) => option.value === value);
  }, [options, value]);

  return (
    <CreateableSelect
      inputId={id}
      placeholder={placeholder}
      className="text-sm h-10"
      classNames={{
        control: ({ isFocused }) =>
          `!bg-background !border-input hover:!bg-background/90 ${
            isFocused
              ? "!ring-2 !ring-ring !ring-offset-2 !border-ring !shadow-none"
              : "!border"
          }`,
        placeholder: () => "!text-muted-foreground",
        singleValue: () => "!text-foreground",
        input: () => "!text-foreground",
        menu: () =>
          "!bg-popover !border !border-border !shadow-md !rounded-md mt-1",
        option: ({ isFocused, isSelected }) =>
          `cursor-pointer py-2 px-3 rounded-sm text-sm ${
            isSelected
              ? "!bg-primary !text-primary-foreground"
              : isFocused
              ? "!bg-accent !text-accent-foreground"
              : "!text-popover-foreground"
          }`,
      }}
      styles={{
        control: (base) => ({
          ...base,
          boxShadow: "none",
          border: "none",
        }),
        menu: (base) => ({
          ...base,
          boxShadow: "none",
          zIndex: 50,
        }),
      }}
      value={formattedValue}
      onChange={onSelect}
      options={options}
      onCreateOption={onCreate}
      isDisabled={disabled}
    />
  );
};
