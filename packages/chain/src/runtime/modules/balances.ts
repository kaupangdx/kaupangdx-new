import { runtimeMessage, runtimeModule } from "@proto-kit/module";
import { StateMap, state, Deposit } from "@proto-kit/protocol";
import {
  Balance,
  Balances as BaseBalances,
  BalancesKey,
  TokenId,
} from "@proto-kit/library";
import { Provable, PublicKey } from "o1js";

interface BalancesConfig {
  totalSupply: Balance;
}

@runtimeModule()
export class Balances extends BaseBalances<BalancesConfig> {
  @state() public totalSupply = StateMap.from<TokenId, Balance>(
    TokenId,
    Balance
  );

  public async getTotalSupply(tokenId: TokenId) {
    return Balance.from((await this.totalSupply.get(tokenId)).value);
  }

  public async mintAndIncrementSupply(
    tokenId: TokenId,
    address: PublicKey,
    amount: Balance
  ): Promise<void> {
    const totalSupply = await this.totalSupply.get(tokenId);
    const newtotalSupply = Balance.from(totalSupply.value).add(amount);
    // assert(
    //   newtotalSupply.lessThanOrEqual(this.config.totalSupply),
    //   "Circulating supply would be higher than total supply"
    // );
    await this.totalSupply.set(tokenId, newtotalSupply);
    await this.mint(tokenId, address, amount);
  }

  public async burnAndDecrementSupply(
    tokenId: TokenId,
    address: PublicKey,
    amount: Balance
  ): Promise<void> {
    const totalSupply = await this.totalSupply.get(tokenId);
    const newtotalSupply = Balance.from(totalSupply.value).sub(amount);
    await this.totalSupply.set(tokenId, newtotalSupply);
    await this.burn(tokenId, address, amount);
  }

  @runtimeMessage()
  public async deposit(deposit: Deposit) {
    const key = new BalancesKey({
      tokenId: TokenId.from(deposit.tokenId),
      address: deposit.address,
    });
    const balance = await this.balances.get(key);
    Provable.log("deposited", deposit);
    await this.balances.set(
      key,
      balance.value.add(Balance.Unsafe.fromField(deposit.amount.value))
    );
  }
}
