import { TokenId } from "@proto-kit/library";
import { Field, Provable, PublicKey, Struct } from "o1js";

/**
 * Represents a fecc collector with his asset
 */
export class FeeCollectorAsset extends Struct({
  feeCollector: PublicKey,
  tokenAId: TokenId
}) {
  public static from(feeCollector: PublicKey, tokenAId: TokenId): FeeCollectorAsset {
    return new FeeCollectorAsset({ feeCollector, tokenAId });
  }

}
