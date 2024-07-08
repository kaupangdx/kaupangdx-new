import { Field, Provable, PublicKey, Struct, Poseidon, Group } from "o1js";
import { FeeCollectorAsset } from "./fee-collector-asset";

/**
 * Represents a public key corresponding to a fee collector with asset, based on fee collector account & token a in the pool.
 */
export class FeeCollectorAssetKey extends PublicKey {
  /**
   * Creates a PoolKey from the provided token pair, by
   * converting the token pair's hash to a public key via a common group element.
   */
  public static fromFeeCollectorAsset(feeCollectorAsset: FeeCollectorAsset): FeeCollectorAssetKey {
    const {
      x,
      y: { x0 },
    } = Poseidon.hashToGroup(FeeCollectorAsset.toFields(feeCollectorAsset));

    const key = FeeCollectorAssetKey.fromGroup(Group.fromFields([x, x0]));

    return key;
  }
}
