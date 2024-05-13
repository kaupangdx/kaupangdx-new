import { useFormContext } from "react-hook-form";
import { Button } from "../ui/button";
import { TokenInput } from "../ui/token-input";
import { Card } from "../ui/card";
import { cn } from "@/lib/utils";
import { ArrowDown } from "lucide-react";

export interface RemoveLiquidityFormProps {
  loading: boolean;
  poolExists: boolean;
  onChangeTokens: () => void;
}

export function RemoveLiquidityForm({
  loading,
  poolExists,
  onChangeTokens,
}: RemoveLiquidityFormProps) {
  const form = useFormContext();
  const error = Object.values(form.formState.errors)[0]?.message?.toString();

  return (
    <>
      <div className="relative">
        <div className="relative grid gap-2">
          <TokenInput label="Token A" name="tokenA" amountInputDisabled />

          <div className="absolute left-1/2 top-1/2 -ml-6 -mt-5">
            <Button
              type="button"
              onClick={onChangeTokens}
              size={"icon"}
              className="group rounded-xl border-4 border-zinc-950 bg-zinc-800 text-foreground hover:bg-zinc-800"
            >
              <ArrowDown className="h-4 w-4 transition-all group-hover:rotate-180" />
            </Button>
          </div>

          <TokenInput
            label="Token B"
            name="tokenB"
            amountInputDisabled={true}
          />
        </div>
        <div>
          <TokenInput
            label="LP Token"
            name="tokenLP"
            tokenInputDisabled
            tokenInputHidden={true}
            className="mt-2"
          />
        </div>
      </div>
      <Button
        loading={loading}
        type={"submit"}
        disabled={!form.formState.isValid}
        className="mt-4 h-12 w-full rounded-lg px-10 text-lg"
      >
        Remove liquidity
      </Button>
    </>
  );
}
