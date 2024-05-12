import { ArrowDown, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "../ui/button";
import { TokenInput } from "../ui/token-input";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { GeistMono } from "geist/font/mono";

export function SwapForm() {
  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <>
      <div className="relative">
        <TokenInput label="You pay" />

        <div className="absolute left-1/2 top-1/2 -ml-6 -mt-5">
          <Button
            size={"icon"}
            className="group rounded-xl border-4 border-zinc-950 bg-zinc-800 text-foreground hover:bg-zinc-800"
          >
            <ArrowDown className="h-4 w-4 transition-all group-hover:rotate-180" />
          </Button>
        </div>

        <div className="mt-1.5">
          <TokenInput label="You get" amountInputDisabled={true} />
        </div>
      </div>

      <Button className="mt-4 h-12 w-full rounded-lg px-10 text-lg">
        Swap
      </Button>

      <Collapsible onOpenChange={setDetailsOpen}>
        <div className="mt-4 flex justify-between">
          <div className="flex items-center">
            <p className={cn("mr-1.5 text-sm", GeistMono.className)}>
              1 MINA = 0.8 DAI
            </p>
            <p
              className={cn(
                "text-sm text-muted-foreground",
                GeistMono.className,
              )}
            >
              (0.8$)
            </p>
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
            <div>{"MINA -> DAI"}</div>
          </div>
          <div className="flex justify-between text-sm">
            <p className="text-muted-foreground">Spot price</p>
            <div className="flex">
              <p className={cn(GeistMono.className)}>1 MINA = 0.8 DAI</p>
              <p
                className={
                  (cn(GeistMono.className), "pl-1.5 text-muted-foreground")
                }
              >
                (0.8$)
              </p>
            </div>
          </div>
          <div className="flex justify-between text-sm">
            <p className="text-muted-foreground">Network cost</p>
            <div>🎉 Free</div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </>
  );
}
