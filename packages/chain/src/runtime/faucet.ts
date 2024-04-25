import { Balance, Balances, TokenId } from "@proto-kit/library";
import { RuntimeModule, runtimeMethod, runtimeModule } from "@proto-kit/module";
import { PublicKey } from "o1js";
import { inject } from "tsyringe";

@runtimeModule()
export class Faucet extends RuntimeModule {
  public constructor(@inject("Balances") public balances: Balances) {
    super();
  }

  public drip(tokenId: TokenId, address: PublicKey, amount: Balance) {
    const currentBalance = this.balances.getBalance(tokenId, address);
    const newBalance = currentBalance.add(amount);
    this.balances.setBalance(tokenId, address, newBalance);
  }

  @runtimeMethod()
  public dripSigned(tokenId: TokenId, amount: Balance) {
    this.drip(tokenId, this.transaction.sender.value, amount);
  }
}
