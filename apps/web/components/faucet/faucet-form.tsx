import { Button } from "../ui/button";
import { TokenInput } from "../ui/token-input";

export function FaucetForm() {
  return (
    <div className="relative">
      <TokenInput label="Test tokens" />
      <Button className="mt-4 h-12 w-full rounded-lg px-10 text-lg">
        Drip
      </Button>
    </div>
  );
}
