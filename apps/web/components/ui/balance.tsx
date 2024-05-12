"use client";
import { cn } from "@/lib/utils";
import { tokens } from "@/tokens";
import { GeistMono } from "geist/font/mono";
import { UInt64 } from "o1js";
import { useMemo } from "react";

export const precision = 2;

export interface BalanceProps {
  balance?: string;
  tokenId?: string;
}

export function removeTrailingZeroes(balance: string) {
  const leftovers = `0.${balance}`
    .replace(/^0+(?!\.)|(?:\.|(\..*?))0+$/gm, "$1")
    .replace("0.", "");

  if (leftovers.endsWith(".")) return leftovers.replace(".", "");

  if (leftovers === "0") return "0";

  return leftovers;
}

export function Balance({ balance, tokenId }: BalanceProps) {
  const formattedBalance = useMemo(() => {
    if (!balance) return;

    const { quotient, rest } = UInt64.from(balance).divMod(10 ** precision);
    const trimmedRest = removeTrailingZeroes(rest.toString());
    return (
      <>
        {quotient.toString()}
        {trimmedRest ? (
          <>
            <span>.</span>
            {trimmedRest}
          </>
        ) : (
          <></>
        )}
      </>
    );
  }, [balance]);

  return (
    <span className={cn(GeistMono.className)}>
      {formattedBalance ?? "—"} {tokenId ? tokens[tokenId]?.ticker : <></>}
    </span>
  );
}
