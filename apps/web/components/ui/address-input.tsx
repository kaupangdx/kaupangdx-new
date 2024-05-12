"use client";
import { ArrowDown } from "lucide-react";
import { Button } from "./button";
import { Card } from "./card";
import { Input } from "./input";
import { TokenSelector } from "./token-selector";
import { GeistMono } from "geist/font/mono";
import { cn } from "@/lib/utils";
import { PublicKey } from "o1js";

export interface AddressInputProps {
  label: string;
  placeholder?: string;
  disabled?: boolean;
}

export function AddressInput({
  label,
  disabled,
  placeholder,
}: AddressInputProps) {
  function validate(address?: string) {
    if (address) {
      try {
        PublicKey.fromBase58(address);
      } catch (e) {
        console.error(e);
      }
    } else {
      console.error("Address is required");
    }
  }
  return (
    <Card className="rounded-2xl px-4 py-4 pb-6">
      <div className="flex justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
      <div className="mt-1.5 flex flex-row items-center justify-center">
        <Input
          disabled={disabled}
          onChange={(e) => validate(e.target.value)}
          placeholder={placeholder ?? "Enter address"}
          className={cn([
            "h-auto border-0  p-0 text-2xl focus-visible:ring-0 focus-visible:ring-offset-0",
            GeistMono.className,
          ])}
        />
      </div>
    </Card>
  );
}
