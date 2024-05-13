import { ArrowDown, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "../ui/button";
import { TokenInput } from "../ui/token-input";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { GeistMono } from "geist/font/mono";
import { USDBalance } from "../ui/usd-balance";
import { useFormContext } from "react-hook-form";
import { tokens } from "@/tokens";

export interface SwapFormProps {
  loading: boolean;
  route: string[];
  unitPrice?: string;
}

export function SwapForm({ loading, route, unitPrice }: SwapFormProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const form = useFormContext();
  const error = Object.values(form.formState.errors)[0]?.message?.toString();

  const unitPriceWrapped = useMemo(() => {
    const fields = form.getValues();

    if (!unitPrice || !fields.tokenIn_token || !fields.tokenOut_token) return;
    return {
      tokenIn: tokens[fields.tokenIn_token]?.ticker,
      tokenOut: tokens[fields.tokenOut_token]?.ticker,
      unitPrice,
    };
  }, [unitPrice]);

  return (
    <>
      <div className="relative">
        <TokenInput name="tokenIn" label="You pay" />

        <div className="absolute left-1/2 top-1/2 -ml-6 -mt-5">
          <Button
            type={"button"}
            size={"icon"}
            className="group rounded-xl border-4 border-zinc-950 bg-zinc-800 text-foreground hover:bg-zinc-800"
          >
            <ArrowDown className="h-4 w-4 transition-all group-hover:rotate-180" />
          </Button>
        </div>

        <div className="mt-2">
          <TokenInput
            name="tokenOut"
            label="You get"
            amountInputDisabled={true}
          />
        </div>
      </div>

      <Button
        loading={loading}
        disabled={!form.formState.isValid}
        className="mt-4 h-12 w-full rounded-lg px-10 text-lg"
      >
        {error ?? "Swap"}
      </Button>

      <Collapsible onOpenChange={setDetailsOpen}>
        <div className="mt-4 flex justify-between">
          <div className="flex items-center">
            <p className={cn("mr-1.5 text-sm", GeistMono.className)}>
              {unitPriceWrapped ? (
                `1 ${unitPriceWrapped.tokenIn} = ${unitPrice} ${unitPriceWrapped.tokenOut}`
              ) : (
                <></>
              )}
            </p>
            {unitPriceWrapped && (
              <p
                className={cn(
                  "text-sm text-muted-foreground",
                  GeistMono.className,
                )}
              >
                (<USDBalance />)
              </p>
            )}
          </div>
          <CollapsibleTrigger className="group flex flex-grow items-center text-right text-muted-foreground">
            <div className="flex flex-grow items-center justify-end">
              <p className="text-sm">Show details</p>
              {detailsOpen ? (
                <ChevronUp className="ml-1 h-4 w-4" />
              ) : (
                <ChevronDown className="ml-1 h-4 w-4" />
              )}
            </div>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="mt-3 grid gap-2">
          <div className="flex justify-between text-sm">
            <p className="text-muted-foreground">Route</p>
            <div>
              {route && route.length ? (
                <>
                  {route.map((token, i) => (
                    <>
                      {tokens[token]?.ticker}
                      {route.length - 1 !== i && (
                        <span className="mx-1 text-muted-foreground">
                          {"->"}
                        </span>
                      )}
                    </>
                  ))}
                </>
              ) : (
                <>—</>
              )}
            </div>
          </div>
          {/* <div className="flex justify-between text-sm">
            <p className="text-muted-foreground">Spot price</p>
            <div className="flex">
              <p className={cn(GeistMono.className)}>1 MINA = 0.8 DAI</p>
              <p
                className={
                  (cn(GeistMono.className), "pl-1.5 text-muted-foreground")
                }
              >
                (<USDBalance />)
              </p>
            </div>
          </div> */}
          {/* <div className="flex justify-between text-sm">
            <p className="text-muted-foreground">Network cost</p>
            <div>🎉 Free</div>
          </div> */}
        </CollapsibleContent>
      </Collapsible>
    </>
  );
}
