import { Balance, TokenId } from "@proto-kit/library";
import { RuntimeModule, runtimeMethod, runtimeModule } from "@proto-kit/module";
import { Provable, PublicKey } from "o1js";
import { inject } from "tsyringe";
import { Balances } from "./balances";

@runtimeModule()
export class Faucet extends RuntimeModule {
  public constructor(@inject("Balances") public balances: Balances) {
    super();
  }

  public drip(tokenId: TokenId, address: PublicKey, amount: Balance) {
    this.balances.mintAndIncrementSupply(tokenId, address, amount);
  }

  @runtimeMethod()
  public dripSigned(tokenId: TokenId, amount: Balance) {
    this.drip(tokenId, this.transaction.sender.value, amount);
  }
}
