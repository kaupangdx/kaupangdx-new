import { Card } from "./card";
import { Input } from "./input";
import { TokenSelector } from "./token-selector";
import { cn } from "@/lib/utils";
import { Balance } from "./balance";
import { useFormContext } from "react-hook-form";

export interface TokenInputProps {
  label: string;
  name: string;
  tokenInputDisabled?: boolean;
  amountInputDisabled?: boolean;
  tokenInputHidden?: boolean;
  className?: string;
  balance?: string;
  onMaxClick?: () => void;
}

export function TokenInput({
  label,
  name,
  tokenInputDisabled,
  amountInputDisabled,
  tokenInputHidden,
  className,
  balance,
  onMaxClick,
}: TokenInputProps) {
  const form = useFormContext();

  return (
    <Card className={cn(["rounded-2xl   px-4 py-4 pb-4", className])}>
      <div className="flex justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <span>Balance:</span>
          <span className="font-mono">
            <Balance balance={balance} />
          </span>
          {onMaxClick && (
            <button
              type="button"
              onClick={onMaxClick}
              className="ml-1 text-primary hover:text-primary/80"
            >
              Max
            </button>
          )}
        </div>
      </div>
      <div className="mt-1.5 flex flex-row items-center justify-center">
        <Input
          {...form.register(`${name}_amount`)}
          disabled={amountInputDisabled}
          placeholder="0"
          className={cn([
            "mr-4 h-auto border-0  p-0 text-2xl focus-visible:ring-0 focus-visible:ring-offset-0 font-mono value number",
          ])}
        />
        {!tokenInputHidden && (
          <TokenSelector disabled={tokenInputDisabled} name={name} />
        )}
      </div>
    </Card>
  );
}
