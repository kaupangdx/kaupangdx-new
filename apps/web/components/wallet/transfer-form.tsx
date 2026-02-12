import { useFormContext } from "react-hook-form";
import { Button } from "../ui/button";
import { TokenInput } from "../ui/token-input";
import { AddressInput } from "../ui/address-input";

export interface TransferFormProps {
  loading: boolean;
  balance?: string;
  onMaxClick?: () => void;
}

export function TransferForm({ loading, balance, onMaxClick }: TransferFormProps) {
  const form = useFormContext();
  const error = Object.values(form.formState.errors)[0]?.message?.toString();

  return (
    <>
      <div className="relative grid gap-2">
        <AddressInput name="to" label="Recipient" />
        <TokenInput label="Amount" name="amount" balance={balance} onMaxClick={onMaxClick} />
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