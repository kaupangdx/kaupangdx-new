import { TokenId } from "@proto-kit/library";
import { Group, Poseidon, PublicKey } from "o1js";
import { TokenPair } from "./token-pair";

/**
 * Represents a public key corresponding to a pool, based on tokenA & tokenB in the pool.
 */
export class PoolKey extends PublicKey {
  /**
   * Creates a PoolKey from the provided token pair, by
   * converting the token pair's hash to a public key via a common group element.
   */
  public static fromTokenPair(tokenPair: TokenPair): PoolKey {
    const {
      x,
      y: { x0 },
    } = Poseidon.hashToGroup(TokenPair.toFields(tokenPair));

    const key = PoolKey.fromGroup(Group.fromFields([x, x0]));

    return key;
  }
}
