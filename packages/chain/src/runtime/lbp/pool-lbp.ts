import { Balance, TokenId, UInt64 } from "@proto-kit/library";
import { Provable, PublicKey, Struct } from "o1js";

/**
 * Standard fee amount for a LBP pool
 */
export class FeeLBP extends Struct({
  fee0: UInt64,
  fee1: UInt64
}) {

  static defaultRepayFee() {
    /**
     * Inspirated from hydra dx 
        pub fn repay_fee() -> (u32, u32) {
          (2, 10)
        }
     */
    return new FeeLBP({ fee0: UInt64.from(2), fee1: UInt64.from(10) });
  }
}

export class AssetPair extends Struct({
  tokenAccumulatedId: TokenId,
  tokenSoldId: TokenId
}) {
}

/**
 * Pool information for LBP
 */
export class PoolLBP extends Struct({
  /// owner of the pool after `CreatePoolOrigin` creates it
  owner: PublicKey,
  /// start block
  start: UInt64,
  /// end  block
  end: UInt64,
  /// Asset ids of the tokens (accumulating asset, sold asset) 
  assets: AssetPair,
  /// initial weight of the asset_a where the minimum value is 0 (equivalent to 0% weight), and the maximum value is 100_000_000 (equivalent to 100% weight)
  initialWeight: UInt64,
  /// final weights of the asset_a where the minimum value is 0 (equivalent to 0% weight), and the maximum value is 100_000_000 (equivalent to 100% weight)
  finalWeight: UInt64,
  /// standard fee amount
  fee: FeeLBP,
  /// person that receives the fee
  feeCollector: PublicKey,
  /// repayment target of the accumulated asset in fee collectors account, when this target is reached fee drops from 20% to fee
  repayTarget: UInt64

}) {
}
