import {
  RuntimeModule,
  runtimeMethod,
  runtimeModule,
  state,
} from "@proto-kit/module";
import { StateMap, assert } from "@proto-kit/protocol";
import { PoolKey } from "./pool-key";
import { Provable, PublicKey, Struct, UInt64 as O1UInt64, Bool, Field } from "o1js";
import { inject } from "tsyringe";
import { Balance, TokenId, UInt64 } from "@proto-kit/library";
import { TokenPair } from "./token-pair";
import { LPTokenId } from "./lp-token-id";
import { MAX_TOKEN_ID, TokenRegistry } from "../token-registry";
import { Balances } from "../balances";
import { AssetPair, FeeLBP, PoolLBP } from "./pool-lbp";
import { FeeCollectorAssetKey } from "./fee-collector-asset-key";
import { FeeCollectorAsset } from "./fee-collector-asset";
import { NoConfig } from "@proto-kit/common";
import { XYK } from "../xyk/xyk";


export const errors = {
  tokensNotDistinct: () => `Tokens must be different`,
  poolAlreadyExists: () => `Pool already exists`,
  poolDoesNotExist: () => `Pool does not exist`,
  amountAIsZero: () => `Amount A must be greater than zero`,
  amountALimitInsufficient: () => `Amount A limit is insufficient`,
  amountBLimitInsufficient: () => `Amount B limit is insufficient`,
  reserveAIsZero: () => `Reserve A must be greater than zero`,
  lpTokenSupplyIsZero: () => `LP token supply is zero`,
  amountOutIsInsufficient: () => `Amount out is insufficient`,
  feeCollectorWithAssetAlreadyUsed: () => `Not more than one fee collector per asset id`,
  InvalidBlockRange: () => `Invalid block range`,
  MaxSaleDurationExceeded: () => `Duration of the LBP sale should not exceed 2 weeks`,
  InvalidWeight: () => `Invalid weight`,
  FeeAmountInvalid: () => `Invalid fee amount`,
  SaleIsNotRunning: () => `Sale is not running`,
  poolXykAlreadyExists: () => `A xyk pool with same tokens already exists`,
  poolNotEnd: () => `The pool is still running`,
  notOwner: () => `Caller is not owner`,
  poolEmpty: () => `Pool is empty`,
};

// we need a placeholder pool value until protokit supports value-less dictonaries or state arrays
export const placeholderPoolValue = Bool(true);

export const MAX_PATH_LENGTH = 3;
/// Max weight corresponds to 100%
export const MAX_WEIGHT: UInt64 = UInt64.from(100_000_000);
/// Max sale duration is 14 days (not really 2 weeks due to time between blocks)
export const MAX_SALE_DURATION: UInt64 = UInt64.from(60 * 60 * 24 * 14);

/**
 * Runtime module responsible for providing trading/management functionalities for LBP pools.
 */
@runtimeModule()
export class LBP extends RuntimeModule<NoConfig> {
  // all existing pools in the system
  @state() public pools = StateMap.from<PoolKey, PoolLBP>(PoolKey, PoolLBP);
  // fee collected for one asset and one user, the same user cannot collect the same asset from different pools
  @state() public feeCollected = StateMap.from<FeeCollectorAssetKey, UInt64>(FeeCollectorAssetKey, UInt64);

  /**
   * Provide access to the underlying Balances runtime to manipulate balances
   * for both pools and users
   */
  public constructor(
    @inject("Balances") public balances: Balances,
    @inject("TokenRegistry") public tokenRegistry: TokenRegistry,
    @inject("XYK") public xyk: XYK
  ) {
    super();
  }

  public poolExists(poolKey: PoolKey) {
    return this.pools.get(poolKey).isSome;
  }

  public feeCollectedExists(feeCollectorAssetKey: FeeCollectorAssetKey) {
    return this.feeCollected.get(feeCollectorAssetKey).isSome;
  }

  /**
   * Zero weight at the beginning or at the end of a sale may cause a problem in the price calculation
   * Minimum allowed weight is 2%. The exponentiation used in the math can overflow when the ration between the weights is higher than 98/2.
   */
  public isValidWeight(weight: UInt64) {
    return weight.greaterThanOrEqual(MAX_WEIGHT.div(50)).and(weight.lessThan(MAX_WEIGHT));
  }

  /**
   * return true if now is in interval <pool.start, pool.end>
   */
  public isPoolRunning(poolData: PoolLBP) {
    const now = UInt64.from(this.network.block.height);
    return poolData.start.lessThanOrEqual(now).and(poolData.end.greaterThanOrEqual(now));
  }

  /**
   * Creates an LBP pool if one doesnt exist yet, and if the creator has
   * sufficient balance to do so.
   *
   * @param creator
   * @param tokenAId
   * @param tokenBId
   * @param tokenASupply
   * @param tokenBSupply
   */
  public createPool(
    creator: PublicKey,
    tokenAId: TokenId,
    tokenBId: TokenId,
    tokenAAmount: Balance,
    tokenBAmount: Balance,
    start: UInt64,
    end: UInt64,
    initialWeight: UInt64,
    finalWeight: UInt64,
    fee: FeeLBP,
    feeCollector: PublicKey,
    repayTarget: UInt64
  ) {
    const tokenPair = TokenPair.from(tokenAId, tokenBId);
    const poolKey = PoolKey.fromTokenPair(tokenPair);
    const feeCollectorAsset = FeeCollectorAsset.from(feeCollector, tokenAId);
    const feeCollectorAssetKey = FeeCollectorAssetKey.fromFeeCollectorAsset(feeCollectorAsset);
    const areTokensDistinct = tokenAId.equals(tokenBId).not();
    const poolDoesNotExist = this.poolExists(poolKey).not();
    const feeCollectorAssetDoesNotExist = this.feeCollectedExists(feeCollectorAssetKey).not();
    const now = UInt64.from(this.network.block.height);
    const nowLessThanStart = now.lessThan(start);
    const startLessThanEnd = start.lessThan(end);
    const max2Weeks = UInt64.from(end).sub(UInt64.from(start)).lessThanOrEqual(MAX_SALE_DURATION);
    const validInitialWeight = this.isValidWeight(initialWeight);
    const validFinalWeight = this.isValidWeight(finalWeight);
    const validFeeAmount = fee.fee1.greaterThan(UInt64.zero);

    // TODO: add check for minimal liquidity in pools
    assert(areTokensDistinct, errors.tokensNotDistinct());
    assert(poolDoesNotExist, errors.poolAlreadyExists());
    assert(feeCollectorAssetDoesNotExist, errors.feeCollectorWithAssetAlreadyUsed());
    assert(nowLessThanStart, errors.InvalidBlockRange());
    assert(startLessThanEnd, errors.InvalidBlockRange());
    assert(max2Weeks, errors.MaxSaleDurationExceeded());
    assert(validInitialWeight, errors.InvalidWeight());
    assert(validFinalWeight, errors.InvalidWeight());
    assert(validFeeAmount, errors.FeeAmountInvalid());

    // transfer liquidity from the creator to the pool
    this.balances.transfer(tokenAId, creator, poolKey, tokenAAmount);
    this.balances.transfer(tokenBId, creator, poolKey, tokenBAmount);

    // determine initial LP token supply
    const lpTokenId = LPTokenId.fromTokenPair(tokenPair);
    const initialLPTokenSupply = Balance.from(
      // if tokenA supply is greater than tokenB supply, use tokenA supply, otherwise use tokenB supply
      Provable.if(
        tokenAId.greaterThan(tokenBId),
        Balance,
        tokenAAmount,
        tokenBAmount
      ).value
    );

    const success = this.tokenRegistry.addTokenPair(tokenAId, tokenBId, Bool(false), Bool(true));
    assert(success, errors.poolXykAlreadyExists());

    // the pool owned the liquidity
    this.balances.mintAndIncrementSupply(
      lpTokenId,
      poolKey,
      initialLPTokenSupply
    );

    let assets = new AssetPair({ tokenAccumulatedId: tokenAId, tokenSoldId: tokenBId });
    // store pool informations and fee collector pair
    const poolLBP = new PoolLBP({ owner: creator, start, end, assets, initialWeight, finalWeight, fee, feeCollector, repayTarget });
    this.pools.set(poolKey, poolLBP);

    this.feeCollected.set(feeCollectorAssetKey, UInt64.zero);
  }


  public calculateTokenOutAmountFromReserves(
    reserveIn: Balance,
    reserveOut: Balance,
    amountIn: Balance,
    weightIn: UInt64,
    weightOut: UInt64,
    start: UInt64,
    end: UInt64
  ) {
    const numerator = amountIn.mul(reserveOut);
    const denominator = reserveIn.add(amountIn);

    const now = UInt64.from(this.network.block.height);

    const linearWeight = this.calculateLinearWeight(start, end, weightIn, weightOut, now);
    // TODO: extract to safemath
    const adjustedDenominator = Balance.from(
      Provable.if(denominator.equals(0), Balance, Balance.from(1), denominator)
        .value
    );

    assert(denominator.equals(adjustedDenominator), "denominator is zero");

    const amountOut = numerator.div(adjustedDenominator);

    const weightOutRatio = MAX_WEIGHT.sub(linearWeight);
    // simple implementation of the lbp pool as no power can be used, we multiply the amount out by the weight ratio
    const lbpPrice = amountOut.mul(linearWeight).div(weightOutRatio);
    return lbpPrice;
  }

  /**
   * Calculating weight at any given block in an interval using linear interpolation.
   * @param startX beginning of an interval
   * @param endX end of an interval
   * @param startY initial weight
   * @param endY final weight
   * @param at block timestamp at which to calculate the weight
   */
  public calculateLinearWeight(startX: UInt64, endX: UInt64, startY: UInt64, endY: UInt64, at: UInt64) {

    const poolEnded = endX.lessThan(at);
    const poolNotStarted = at.lessThan(startX);

    assert(poolEnded.not(), errors.SaleIsNotRunning());
    assert(poolNotStarted.not(), errors.SaleIsNotRunning())

    const endGreater = UInt64.from(Provable.if(poolEnded, UInt64, UInt64.from(at), endX).value);
    const atGreater = UInt64.from(Provable.if(poolNotStarted, UInt64, UInt64.from(startX), at).value);

    // todo check overflow
    const d1 = endGreater.sub(at);
    const d2 = atGreater.sub(startX);
    const dx = endGreater.sub(startX);
    const dxGreaterThanZero = dx.greaterThan(UInt64.zero);

    const paddedDivisor = Provable.if(dxGreaterThanZero.not(), UInt64, UInt64.from(1), dx).value;

    assert(dxGreaterThanZero, errors.SaleIsNotRunning());

    const leftPart = startY.mul(d1);
    const rightPart = endY.mul(d2);
    const result = (leftPart.add(rightPart)).div(UInt64.from(paddedDivisor));

    return result;
  }

  public calculateTokenOutAmount(
    tokenIn: TokenId,
    tokenOut: TokenId,
    amountIn: Balance,
    poolData: PoolLBP
  ) {
    const tokenPair = TokenPair.from(tokenIn, tokenOut);
    const pool = PoolKey.fromTokenPair(tokenPair);

    const reserveIn = this.balances.getBalance(tokenIn, pool);
    const reserveOut = this.balances.getBalance(tokenOut, pool);

    const weightIn = UInt64.from(Provable.if(tokenIn.equals(poolData.assets.tokenAccumulatedId), UInt64, poolData.initialWeight, poolData.finalWeight).value);
    const weightOut = UInt64.from(Provable.if(tokenIn.equals(poolData.assets.tokenAccumulatedId), UInt64, poolData.finalWeight, poolData.initialWeight).value);

    const start = UInt64.from(poolData.start);
    const end = UInt64.from(poolData.end);

    return this.calculateTokenOutAmountFromReserves(
      reserveIn,
      reserveOut,
      amountIn,
      weightIn,
      weightOut,
      start,
      end
    );
  }

  public calculateAmountIn(
    tokenIn: TokenId,
    tokenOut: TokenId,
    amountOut: Balance
  ) {
    const tokenPair = TokenPair.from(tokenIn, tokenOut);
    const pool = PoolKey.fromTokenPair(tokenPair);

    const reserveIn = this.balances.getBalance(tokenIn, pool);
    const reserveOut = this.balances.getBalance(tokenOut, pool);

    return this.calculateAmountInFromReserves(reserveIn, reserveOut, amountOut);
  }

  public calculateAmountInFromReserves(
    reserveIn: Balance,
    reserveOut: Balance,
    amountOut: Balance
  ) {
    const numerator = reserveIn.mul(amountOut);
    const denominator = reserveOut.sub(amountOut);

    // TODO: extract to safemath
    const adjustedDenominator = Balance.from(
      Provable.if(denominator.equals(0), Balance, Balance.from(1), denominator)
        .value
    );

    assert(denominator.equals(adjustedDenominator), "denominator is zero");

    return numerator.div(adjustedDenominator);
  }

  public sellPath(
    seller: PublicKey,
    tokenIn: TokenId,
    tokenOut: TokenId,
    amountIn: Balance,
    amountOutMinLimit: Balance
  ) {
    const initialTokenPair = TokenPair.from(tokenIn, tokenOut);
    const initialPoolKey = PoolKey.fromTokenPair(initialTokenPair);
    const pathBeginswWithExistingPool = this.poolExists(initialPoolKey);

    assert(pathBeginswWithExistingPool, errors.poolDoesNotExist());

    let amountOut = Balance.zero;

    const poolFromStorage = this.pools.get(initialPoolKey);
    const poolData = new PoolLBP(poolFromStorage.value);
    const poolRunning = this.isPoolRunning(poolData);

    assert(poolRunning, errors.SaleIsNotRunning());


    const calculatedAmountOut = this.calculateTokenOutAmount(
      tokenIn,
      tokenOut,
      Balance.from(amountIn),
      poolData
    );

    // calculate fees based on accumulated asset
    const feeAsset = poolData.assets.tokenAccumulatedId;
    const feeAmount = UInt64.from(Provable.if(feeAsset.equals(tokenIn), UInt64, this.calculateFees(poolData, amountIn), this.calculateFees(poolData, calculatedAmountOut)).value);
    const amountWithouFee = Provable.if(feeAsset.equals(tokenIn), UInt64, Balance.from(amountIn).sub(feeAmount), calculatedAmountOut.sub(feeAmount));

    amountOut = Balance.from(
      Provable.if(pathBeginswWithExistingPool, Balance, amountWithouFee, amountOut).value
    );

    amountIn = UInt64.from(
      Provable.if(pathBeginswWithExistingPool, Balance, amountIn, Balance.zero).value
    );

    const isAmountOutMinLimitSufficient =
      amountOut.greaterThanOrEqual(amountOutMinLimit);

    assert(isAmountOutMinLimitSufficient, errors.amountOutIsInsufficient());

    // update fee collected informations
    const feeCollector = PublicKey.from(poolData.feeCollector);
    const feeCollectorAsset = FeeCollectorAsset.from(feeCollector, feeAsset);
    const feeCollectorAssetKey = FeeCollectorAssetKey.fromFeeCollectorAsset(feeCollectorAsset);
    const currentCollected = UInt64.from(this.feeCollected.get(feeCollectorAssetKey).value);
    const newTotal = currentCollected.add(feeAmount);
    this.feeCollected.set(feeCollectorAssetKey, newTotal);

    // Fee is deducted from the sent out amount of accumulated asset and transferred to the fee collector
    const feePayer = Provable.if(feeAsset.equals(tokenIn), PublicKey, seller, initialPoolKey);

    // paid the fees to fee collector
    this.balances.transfer(feeAsset, feePayer, feeCollector, feeAmount);

    // transfer token in from the user to the pool
    this.balances.transfer(tokenIn, seller, initialPoolKey, amountIn);

    // transfer token out from the pool to the user
    this.balances.transfer(tokenOut, initialPoolKey, seller, amountOut);
  }

  public calculateFees(pool: PoolLBP, amount: UInt64): UInt64 {
    const fee = new FeeLBP(Provable.if(this.isRepayFeeApplied(pool), FeeLBP, FeeLBP.defaultRepayFee(), pool.fee));
    return this.calculatePoolTradeFee(amount, fee.fee0, fee.fee1);
  }

  public calculatePoolTradeFee(amount: UInt64, fee0: UInt64, fee1: UInt64): UInt64 {
    let numerator = UInt64.from(fee0);
    let denominator = UInt64.from(fee1);
    let amountIn = UInt64.from(amount);

    // 0 if one of the fee is 0, 1 if fee are the same or amount/fee1*fee0
    const isZero = numerator.equals(UInt64.zero).or(denominator.equals(UInt64.zero));
    const isAmount = isZero.not().and(denominator.equals(numerator));
    const paddedDivisor = UInt64.from(Provable.if(isZero, UInt64, UInt64.from(1), denominator).value);
    let amountCalculated = UInt64.from(Provable.if(isZero, UInt64, UInt64.zero, amountIn.div(paddedDivisor).mul(numerator)).value);
    amountCalculated = UInt64.from(Provable.if(isAmount, UInt64, amount, amountCalculated).value);
    return amountCalculated;
  }

  // repay fee is applied until repay target amount is reached
  public isRepayFeeApplied(poolData: PoolLBP): Bool {
    const feeAsset = poolData.assets.tokenAccumulatedId;
    const feeCollector = PublicKey.from(poolData.feeCollector);
    const feeCollectorAsset = FeeCollectorAsset.from(feeCollector, feeAsset);
    const feeCollectorAssetKey = FeeCollectorAssetKey.fromFeeCollectorAsset(feeCollectorAsset);
    const currentCollected = UInt64.from(this.feeCollected.get(feeCollectorAssetKey).value);
    const repayTarget = poolData.repayTarget;

    return currentCollected.lessThan(repayTarget);
  }

  public migratePool(
    creator: PublicKey,
    tokenAId: TokenId,
    tokenBId: TokenId
  ) {
    const tokenPair = TokenPair.from(tokenAId, tokenBId);
    const poolKey = PoolKey.fromTokenPair(tokenPair);
    const pathBeginswWithExistingPool = this.poolExists(poolKey);

    assert(pathBeginswWithExistingPool, errors.poolDoesNotExist());

    const poolFromStorage = this.pools.get(poolKey);
    const poolData = new PoolLBP(poolFromStorage.value);
    const now = UInt64.from(this.network.block.height);
    const poolEnded = poolData.end.lessThan(now);
    const isOwner = poolData.owner.equals(creator);

    assert(poolEnded, errors.poolNotEnd());
    assert(isOwner, errors.notOwner());

    const lpTokenId = LPTokenId.fromTokenPair(tokenPair);
    const lpTokenTotalSupply = this.balances.getTotalSupply(lpTokenId);
    const lpTokenTotalSupplyIsZero = lpTokenTotalSupply.equals(Balance.from(0));
    const adjustedLpTokenTotalSupply = Balance.from(
      Provable.if(
        lpTokenTotalSupplyIsZero,
        Balance.from(1).value,
        lpTokenTotalSupply.value
      )
    );
    const reserveA = this.balances.getBalance(tokenAId, poolKey);
    const reserveB = this.balances.getBalance(tokenBId, poolKey);

    const isEmpty = reserveA.equals(UInt64.zero).or(reserveB.equals(UInt64.zero));
    assert(isEmpty.not(), errors.poolEmpty());

    // this function will directly transfer reserve from lbp pool to the new xyk pool
    // and mint liquidity for the creator
    this.xyk.migrateLbpPool(creator, poolKey, tokenAId, tokenBId, reserveA, reserveB);

    this.balances.burnAndDecrementSupply(lpTokenId, poolKey, adjustedLpTokenTotalSupply);

  }

  @runtimeMethod()
  public createPoolSigned(
    tokenAId: TokenId,
    tokenBId: TokenId,
    tokenAAmount: Balance,
    tokenBAmount: Balance,
    start: UInt64,
    end: UInt64,
    initialWeight: UInt64,
    finalWeight: UInt64,
    fee: FeeLBP,
    feeCollector: PublicKey,
    repayTarget: UInt64
  ) {
    const creator = this.transaction.sender.value;
    this.createPool(creator, tokenAId, tokenBId, tokenAAmount, tokenBAmount, start, end, initialWeight, finalWeight, fee, feeCollector, repayTarget);
  }



  @runtimeMethod()
  public sellPathSigned(
    tokenIn: TokenId,
    tokenOut: TokenId,
    amountIn: Balance,
    amountOutMinLimit: Balance
  ) {
    this.sellPath(
      this.transaction.sender.value,
      tokenIn,
      tokenOut,
      amountIn,
      amountOutMinLimit
    );
  }

  @runtimeMethod()
  public getLinearWeight(startX: UInt64, endX: UInt64, startY: UInt64, endY: UInt64, at: UInt64) {
    return this.calculateLinearWeight(UInt64.from(startX), UInt64.from(endX), UInt64.from(startY), UInt64.from(endY), UInt64.from(at));
  }

  @runtimeMethod()
  public migratePoolSigned(
    tokenAId: TokenId,
    tokenBId: TokenId
  ) {
    const creator = this.transaction.sender.value;
    this.migratePool(creator, tokenAId, tokenBId);
  }
}
