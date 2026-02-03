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

  public async drip(tokenId: TokenId, address: PublicKey, amount: Balance) {
    await this.balances.mintAndIncrementSupply(tokenId, address, amount);
  }

  @runtimeMethod()
  public async dripSigned(tokenId: TokenId, amount: Balance) {
    await this.drip(tokenId, this.transaction.sender.value, amount);
  }

  // testing method for the UI
  @runtimeMethod()
  public async dripBundle() {
    await this.drip(
      TokenId.from("0"),
      this.transaction.sender.value,
      Balance.from(1000n * 10n ** 2n)
    );

    await this.drip(
      TokenId.from("1"),
      this.transaction.sender.value,
      Balance.from(1000n * 10n ** 2n)
    );

    await this.drip(
      TokenId.from("2"),
      this.transaction.sender.value,
      Balance.from(1000n * 10n ** 2n)
    );
  }
}