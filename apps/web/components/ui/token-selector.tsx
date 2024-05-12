"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { tokens } from "@/tokens";
import { FormField } from "./form";
import { useFormContext } from "react-hook-form";

const tokenOptions = Object.entries(tokens).map(([tokenId, token]) => ({
  label: token?.ticker,
  value: tokenId,
}));

export interface TokenSelectorProps {
  disabled?: boolean;
  name: string;
}

export function TokenSelector({ disabled, name }: TokenSelectorProps) {
  const [open, setOpen] = React.useState(false);

  const form = useFormContext();
  const inputName = `${name}_token`;
  return (
    <FormField
      control={form.control}
      name={inputName}
      render={({ field }) => (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              disabled={disabled}
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-[200px] justify-between border"
            >
              <div className="flex items-center justify-start">
                {field.value ? (
                  <>
                    <img
                      className="mr-1.5 h-4 w-4"
                      src={tokens[field.value]?.logo}
                    />
                    {
                      tokenOptions.find((token) => token.value === field.value)
                        ?.label
                    }
                  </>
                ) : (
                  "Select token"
                )}
              </div>
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-0">
            <Command
              filter={(value, search) => {
                console.log("filter", { value, search });
                if (
                  tokenOptions
                    .find((option) => option.value === value)
                    ?.label?.toLowerCase()
                    .includes(search.toLowerCase())
                )
                  return 1;
                return 0;
              }}
            >
              <CommandInput placeholder="Search tokens..." />
              <CommandEmpty>No token found.</CommandEmpty>
              <CommandGroup>
                <CommandList>
                  {tokenOptions.map((token) => (
                    <CommandItem
                      key={token.value}
                      value={token.value}
                      onSelect={(currentValue) => {
                        form.setValue(inputName, currentValue, {
                          shouldValidate: true,
                          shouldDirty: true,
                          shouldTouch: true,
                        });
                        form.trigger(inputName);
                        setOpen(false);
                      }}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center">
                        <img
                          className="mr-1.5 h-4 w-4"
                          src={tokens[token.value]?.logo}
                        />

                        {token.label}
                      </div>
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          field.value === token.value
                            ? "opacity-100"
                            : "opacity-0",
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandList>
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    ></FormField>
  );
}
