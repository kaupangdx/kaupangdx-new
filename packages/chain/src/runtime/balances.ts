import { runtimeModule, state, runtimeMethod } from "@proto-kit/module";
import { State, StateMap, assert } from "@proto-kit/protocol";
import {
  Balance,
  BalancesKey,
  Balances as BaseBalances,
  TokenId,
} from "@proto-kit/library";
import { Field, PrivateKey, PublicKey, Struct } from "o1js";

interface BalancesConfig {
  totalSupply: Balance;
}

export class Test extends Struct({
  foo: Field,
  bar: Field,
}) {}

@runtimeModule()
export class Balances extends BaseBalances<BalancesConfig> {
  @state() public totalSupply = StateMap.from<TokenId, Balance>(
    TokenId,
    Balance
  );

  @state() public test = StateMap.from(Test, Test);

  public getTotalSupply(tokenId: TokenId) {
    const test = this.test.get(new Test({ foo: Field(1), bar: Field(0) }));
    return Balance.from(this.totalSupply.get(tokenId).value);
  }

  public mintAndIncrementSupply(
    tokenId: TokenId,
    address: PublicKey,
    amount: Balance
  ): void {
    const totalSupply = this.totalSupply.get(tokenId);
    const newtotalSupply = Balance.from(totalSupply.value).add(amount);
    // assert(
    //   newtotalSupply.lessThanOrEqual(this.config.totalSupply),
    //   "Circulating supply would be higher than total supply"
    // );
    this.totalSupply.set(tokenId, newtotalSupply);
    this.mint(tokenId, address, amount);
  }

  public burnAndDecrementSupply(
    tokenId: TokenId,
    address: PublicKey,
    amount: Balance
  ): void {
    const totalSupply = this.totalSupply.get(tokenId);
    const newtotalSupply = Balance.from(totalSupply.value).sub(amount);
    this.totalSupply.set(tokenId, newtotalSupply);
    this.burn(tokenId, address, amount);
  }
}
