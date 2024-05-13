import { useFormContext } from "react-hook-form";
import { Button } from "../ui/button";
import { TokenInput } from "../ui/token-input";
import { Card } from "../ui/card";
import { cn } from "@/lib/utils";
import { ArrowDown } from "lucide-react";
import { AddressInput } from "../ui/address-input";

export interface TransferFormProps {
  loading: boolean;
}

export function TransferForm({ loading }: TransferFormProps) {
  const form = useFormContext();
  const error = Object.values(form.formState.errors)[0]?.message?.toString();

  return (
    <>
      <div className="relative grid gap-2">
        <AddressInput name="to" label="Recipient" />
        <TokenInput label="Amount" name="amount" />
      </div>
      <Button
        loading={loading}
        type={"submit"}
        disabled={!form.formState.isValid}
        className="mt-4 h-12 w-full rounded-lg px-10 text-lg"
      >
        {error ?? "Transfer"}
      </Button>
    </>
  );
}
