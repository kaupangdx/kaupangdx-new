import "reflect-metadata";
import { Balance, TokenId, UInt64 } from "@proto-kit/library";
import { PrivateKey, Provable, PublicKey, UInt64 as O1UInt64, Field, Poseidon } from "o1js";
import { fromRuntime } from "../../testing-appchain";
import { config, modules } from "../../../src/runtime";
import { LBP, errors } from "../../../src/runtime/lbp/lbp";
import { KaupangTestingAppChain, drip } from "../../helpers";
import { PoolKey } from "../../../src/runtime/lbp/pool-key";
import { PoolKey as PoolKeyXyk } from "../../../src/runtime/xyk/pool-key";
import { TokenPair } from "../../../src/runtime/lbp/token-pair";
import { TokenPair as TokenPairXYK } from "../../../src/runtime/xyk/token-pair";
import { LPTokenId } from "../../../src/runtime/lbp/lp-token-id";
import { LPTokenId as LPTokenIdXYK } from "../../../src/runtime/xyk/lp-token-id";
import { AssetPair, FeeLBP } from "../../../src/runtime/lbp/pool-lbp";
import { XYK, errors as errorsXyk } from "../../../src/runtime/xyk/xyk";

describe("lbp", () => {
  const alicePrivateKey = PrivateKey.random();
  const alice = alicePrivateKey.toPublicKey();

  const bobPrivateKey = PrivateKey.random();
  const bob = bobPrivateKey.toPublicKey();

  const tokenAId = TokenId.from(0);
  const tokenBId = TokenId.from(1);
  const tokenAInitialLiquidity = Balance.from(1_000_000);
  const tokenBInitialLiquidity = Balance.from(1_000_000);
  const start = UInt64.from(10);
  const end = UInt64.from(1010);
  // 80 %
  const initialWeight = UInt64.from(80_000_000);
  // 20 %
  const finalWeight = UInt64.from(20_000_000);
  const feeLBP = new FeeLBP({ fee0: UInt64.from(2), fee1: UInt64.from(10) });
  const repayTarget = UInt64.from(1000);

  const lpTokenId = LPTokenId.fromTokenPair(TokenPair.from(tokenAId, tokenBId));

  let appChain: ReturnType<typeof fromRuntime<typeof modules>>;
  let lbp: LBP;
  let xyk: XYK;

  let nonce = 0;

  async function produceBlocks(nb: number) {
    for (let index = 0; index < nb; index++) {
      await appChain.produceBlock();
    }
  }

  async function createPoolSigned(
    appChain: KaupangTestingAppChain,
    senderPrivateKey: PrivateKey,
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
    repayTarget: UInt64,
    options?: { nonce: number }
  ) {
    appChain.setSigner(senderPrivateKey);

    const tx = await appChain.transaction(
      senderPrivateKey.toPublicKey(),
      () => {
        lbp.createPoolSigned(tokenAId, tokenBId, tokenAAmount, tokenBAmount, start, end, initialWeight, finalWeight, fee, feeCollector, repayTarget);
      },
      options
    );

    await tx.sign();
    await tx.send();

    return tx;
  }

  async function createPoolSignedXyk(
    appChain: KaupangTestingAppChain,
    senderPrivateKey: PrivateKey,
    tokenAId: TokenId,
    tokenBId: TokenId,
    tokenAAmount: Balance,
    tokenBAmount: Balance,
    options?: { nonce: number }
  ) {
    appChain.setSigner(senderPrivateKey);

    const tx = await appChain.transaction(
      senderPrivateKey.toPublicKey(),
      () => {
        xyk.createPoolSigned(tokenAId, tokenBId, tokenAAmount, tokenBAmount);
      },
      options
    );

    await tx.sign();
    await tx.send();

    return tx;
  }

  async function migratePool(
    appChain: KaupangTestingAppChain,
    senderPrivateKey: PrivateKey,
    tokenAId: TokenId,
    tokenBId: TokenId,
    options?: { nonce: number }
  ) {
    appChain.setSigner(senderPrivateKey);

    const tx = await appChain.transaction(
      senderPrivateKey.toPublicKey(),
      () => {
        lbp.migratePoolSigned(tokenAId, tokenBId);
      },
      options
    );

    await tx.sign();
    await tx.send();

    return tx;
  }

  async function sellPathSigned(
    appChain: KaupangTestingAppChain,
    senderPrivateKey: PrivateKey,
    tokenIn: TokenId,
    tokenOut: TokenId,
    amountIn: Balance,
    amountOutMinLimit: Balance,
    options?: { nonce: number }
  ) {
    appChain.setSigner(senderPrivateKey);

    const tx = await appChain.transaction(
      senderPrivateKey.toPublicKey(),
      () => {
        lbp.sellPathSigned(tokenIn, tokenOut, amountIn, amountOutMinLimit);
      },
      options
    );

    await tx.sign();
    await tx.send();

    return tx;
  }

  async function queryPool(
    appChain: KaupangTestingAppChain,
    tokenAId: TokenId,
    tokenBId: TokenId
  ) {
    const address = PoolKey.fromTokenPair(TokenPair.from(tokenAId, tokenBId));
    return {
      pool: await appChain.query.runtime.LBP.pools.get(address),
      liquidity: {
        tokenA: await appChain.query.runtime.Balances.balances.get({
          address,
          tokenId: tokenAId,
        }),
        tokenB: await appChain.query.runtime.Balances.balances.get({
          address,
          tokenId: tokenBId,
        }),
      },
    };
  }

  async function queryPoolXyk(
    appChain: KaupangTestingAppChain,
    tokenAId: TokenId,
    tokenBId: TokenId
  ) {
    const address = PoolKeyXyk.fromTokenPair(TokenPairXYK.from(tokenAId, tokenBId));
    return {
      pool: await appChain.query.runtime.XYK.pools.get(address),
      liquidity: {
        tokenA: await appChain.query.runtime.Balances.balances.get({
          address,
          tokenId: tokenAId,
        }),
        tokenB: await appChain.query.runtime.Balances.balances.get({
          address,
          tokenId: tokenBId,
        }),
      },
    };
  }

  async function queryBalance(
    appChain: KaupangTestingAppChain,
    tokenId: TokenId,
    address: PublicKey
  ) {
    return {
      balance: await appChain.query.runtime.Balances.balances.get({
        tokenId,
        address,
      }),
    };
  }

  describe("create pool", () => {
    beforeAll(async () => {
      appChain = fromRuntime(modules);

      appChain.configurePartial({
        Runtime: config,
      });

      await appChain.start();
      appChain.setSigner(alicePrivateKey);

      lbp = appChain.runtime.resolve("LBP");
    });

    it("should generate tokenId", async () => {
      const tokenPair = Provable.if(
        tokenAId.greaterThan(tokenBId),
        TokenPair,
        new TokenPair({ tokenAId: tokenAId, tokenBId: tokenBId }),
        new TokenPair({ tokenAId: tokenBId, tokenBId: tokenAId })
      );
      // check tokenId is correctly generated and different from xyk
      const toFields = tokenPair.tokenAId.toFields().concat(tokenPair.tokenBId.toFields()).concat(Field(1));
      const toTokenId = TokenId.from(Poseidon.hash(toFields));
      const lpTokenIdXYK = LPTokenIdXYK.fromTokenPair(TokenPairXYK.from(tokenAId, tokenBId));
      expect(toTokenId).toEqual(lpTokenId);
      expect(lpTokenIdXYK).not.toEqual(lpTokenId);
    });

    it("should create a pool", async () => {
      await drip(appChain, alicePrivateKey, tokenAId, tokenAInitialLiquidity, {
        nonce: nonce++,
      });
      await drip(appChain, alicePrivateKey, tokenBId, tokenBInitialLiquidity, {
        nonce: nonce++,
      });

      await createPoolSigned(
        appChain,
        alicePrivateKey,
        tokenAId,
        tokenBId,
        tokenAInitialLiquidity,
        tokenBInitialLiquidity,
        start,
        end,
        initialWeight,
        finalWeight,
        feeLBP,
        bob,
        repayTarget,
        { nonce: nonce++ }
      );

      await appChain.produceBlock();

      const { pool, liquidity } = await queryPool(appChain, tokenAId, tokenBId);

      const poolKey = PoolKey.fromTokenPair(TokenPair.from(tokenAId, tokenBId));
      const { balance: poolLpBalance } = await queryBalance(
        appChain,
        lpTokenId,
        poolKey
      );

      // check pool value match
      expect(pool).toBeDefined();
      expect(pool?.assets).toEqual(new AssetPair({ tokenAccumulatedId: tokenAId, tokenSoldId: tokenBId }));
      expect(pool?.end.toBigInt()).toEqual(end.toBigInt());
      expect(pool?.start.toBigInt()).toEqual(start.toBigInt());
      expect(pool?.owner).toEqual(alice);
      expect(pool?.initialWeight.toBigInt()).toEqual(initialWeight.toBigInt());
      expect(pool?.finalWeight.toBigInt()).toEqual(finalWeight.toBigInt());
      expect(pool?.fee.fee0.toBigInt()).toEqual(feeLBP.fee0.toBigInt());
      expect(pool?.fee.fee1.toBigInt()).toEqual(feeLBP.fee1.toBigInt());
      expect(pool?.feeCollector).toEqual(bob);
      expect(pool?.repayTarget.toBigInt()).toEqual(repayTarget.toBigInt());
      expect(pool?.feeCollector).not.toEqual(alice);

      expect(liquidity.tokenA?.toString()).toEqual(
        tokenAInitialLiquidity.toString()
      );
      expect(liquidity.tokenB?.toString()).toEqual(
        tokenBInitialLiquidity.toString()
      );
      expect(poolLpBalance?.toString()).toEqual(
        tokenAInitialLiquidity.toString()
      );
    });

    it("should not create a pool if the pool already exists", async () => {
      await createPoolSigned(
        appChain,
        alicePrivateKey,
        tokenAId,
        tokenBId,
        tokenAInitialLiquidity,
        tokenBInitialLiquidity,
        start,
        end,
        initialWeight,
        finalWeight,
        feeLBP,
        bob,
        repayTarget,
        { nonce: nonce++ }
      );

      const block = await appChain.produceBlock();
      const tx = block?.transactions[0];

      expect(tx?.status.toBoolean()).toBe(false);
      expect(tx?.statusMessage).toBe(errors.poolAlreadyExists());
    });
  });

  describe("calculate linear weight", () => {
    beforeAll(async () => {
      appChain = fromRuntime(modules);

      appChain.configurePartial({
        Runtime: config,
      });

      await appChain.start();
      appChain.setSigner(alicePrivateKey);

      lbp = appChain.runtime.resolve("LBP");
    });

    it("should calculate linear weight", async () => {

      const startX = UInt64.from(1000);
      const endX = UInt64.from(2000);
      const startY = UInt64.from(80_000);
      const endY = UInt64.from(20_000);
      const at = UInt64.from(1500);

      const result = lbp.getLinearWeight(startX, endX, startY, endY, at);
      // 50% expected at mid-course
      expect(result?.toString()).toEqual("50000");

      const resultStart = lbp.getLinearWeight(startX, endX, startY, endY, startX);
      // 80% expected at start
      expect(resultStart?.toString()).toEqual("80000");

      const resultEnd = lbp.getLinearWeight(startX, endX, startY, endY, endX);
      // 20% expected at end
      expect(resultEnd?.toString()).toEqual("20000");

      const resultDecreased = lbp.getLinearWeight(startX, endX, endY, startY, at);
      // 50% expected at mid-course
      expect(resultDecreased?.toString()).toEqual("50000");

      const resultDecreasedStart = lbp.getLinearWeight(startX, endX, endY, startY, startX);
      // 20% expected at start
      expect(resultDecreasedStart?.toString()).toEqual("20000");

      const resultDecreasedEnd = lbp.getLinearWeight(startX, endX, endY, startY, endX);
      // 80% expected at end
      expect(resultDecreasedEnd?.toString()).toEqual("80000");

      const resultDecreasedNearEnd = lbp.getLinearWeight(startX, endX, endY, startY, UInt64.from(1800));
      // 68% expected 
      expect(resultDecreasedNearEnd?.toString()).toEqual("68000");
    });

  });

  describe("sell", () => {
    beforeAll(async () => {
      nonce = 0;
      appChain = fromRuntime(modules);

      appChain.configurePartial({
        Runtime: config,
      });

      await appChain.start();
      appChain.setSigner(alicePrivateKey);

      lbp = appChain.runtime.resolve("LBP");

      await drip(
        appChain,
        alicePrivateKey,
        tokenAId,
        Balance.from(tokenAInitialLiquidity.toBigInt() * 2n),
        {
          nonce: nonce++,
        }
      );
      await drip(
        appChain,
        alicePrivateKey,
        tokenBId,
        Balance.from(tokenBInitialLiquidity.toBigInt() * 2n),
        {
          nonce: nonce++,
        }
      );

      await createPoolSigned(
        appChain,
        alicePrivateKey,
        tokenAId,
        tokenBId,
        tokenAInitialLiquidity,
        tokenBInitialLiquidity,
        start,
        end,
        initialWeight,
        finalWeight,
        feeLBP,
        bob,
        repayTarget,
        { nonce: nonce++ }
      );
      await produceBlocks(10);

    });

    it("should sell tokens for tokens out", async () => {

      await sellPathSigned(
        appChain,
        alicePrivateKey,
        tokenBId,
        tokenAId,
        Balance.from(100),
        Balance.from(1),
        { nonce: nonce++ }
      );

      const block = await appChain.produceBlock();

      const { balance: balanceA } = await queryBalance(
        appChain,
        tokenAId,
        alice
      );

      const { balance: balanceB } = await queryBalance(
        appChain,
        tokenBId,
        alice
      );

      expect(balanceA?.toString()).toEqual("1000020");
      expect(balanceB?.toString()).toEqual("999900");


    });
  });

  describe("migrate pool", () => {
    beforeAll(async () => {
      appChain = fromRuntime(modules);
      nonce = 0;

      appChain.configurePartial({
        Runtime: config,
      });

      await appChain.start();
      appChain.setSigner(alicePrivateKey);

      lbp = appChain.runtime.resolve("LBP");
      xyk = appChain.runtime.resolve("XYK");

      await drip(appChain, alicePrivateKey, tokenAId, tokenAInitialLiquidity.mul(3), {
        nonce: nonce++,
      });
      await drip(appChain, alicePrivateKey, tokenBId, tokenBInitialLiquidity.mul(3), {
        nonce: nonce++,
      });

      await createPoolSigned(
        appChain,
        alicePrivateKey,
        tokenAId,
        tokenBId,
        tokenAInitialLiquidity,
        tokenBInitialLiquidity,
        start,
        end,
        initialWeight,
        finalWeight,
        feeLBP,
        bob,
        repayTarget,
        { nonce: nonce++ }
      );

      await appChain.produceBlock();
    });


    it("should not create a xyk pool if the lbp pool already exists", async () => {
      await createPoolSignedXyk(
        appChain,
        alicePrivateKey,
        tokenAId,
        tokenBId,
        tokenAInitialLiquidity,
        tokenBInitialLiquidity,
        { nonce: nonce++ }
      );

      const block = await appChain.produceBlock();
      const tx = block?.transactions[0];

      expect(tx?.status.toBoolean()).toBe(false);
      expect(tx?.statusMessage).toBe(errorsXyk.poolLbpAlreadyExists());
    });


    it("should migrate the pool", async () => {
      await produceBlocks(10);
      await sellPathSigned(
        appChain,
        alicePrivateKey,
        tokenBId,
        tokenAId,
        Balance.from(100),
        Balance.from(1),
        { nonce: nonce++ }
      );

      const block = await appChain.produceBlock();
      const tx = block?.transactions[0];
      expect(tx?.status.toBoolean()).toBe(true);

      // try migrate will fail due to pool not end
      await migratePool(appChain,
        alicePrivateKey,
        tokenBId,
        tokenAId,
        { nonce: nonce++ });


      const block2 = await appChain.produceBlock();
      const tx2 = block2?.transactions[0];

      expect(tx2?.status.toBoolean()).toBe(false);
      expect(tx2?.statusMessage).toBe(errors.poolNotEnd());

      await produceBlocks(1000);

      // migration successfull
      await migratePool(appChain,
        alicePrivateKey,
        tokenBId,
        tokenAId,
        { nonce: nonce++ });


      const block3 = await appChain.produceBlock();
      const tx3 = block3?.transactions[0];
      expect(tx3?.status.toBoolean()).toBe(true);

      const { pool, liquidity } = await queryPool(appChain, tokenAId, tokenBId);
      expect(liquidity.tokenA?.toBigInt()).toEqual(0n);
      expect(liquidity.tokenB?.toBigInt()).toEqual(0n);

      // already migrated
      await migratePool(appChain,
        alicePrivateKey,
        tokenBId,
        tokenAId,
        { nonce: nonce++ });


      const block4 = await appChain.produceBlock();
      const tx4 = block4?.transactions[0];

      expect(tx4?.status.toBoolean()).toBe(false);
      expect(tx4?.statusMessage).toBe(errors.poolEmpty());


      const { pool: poolxyk, liquidity: liquidityxyk } = await queryPoolXyk(appChain, tokenAId, tokenBId);
      expect(liquidityxyk.tokenA?.toBigInt()).toBeGreaterThan(100n);
      expect(liquidityxyk.tokenB?.toBigInt()).toBeGreaterThan(100n);
    });
  });

  describe("fee", () => {

    it("fee calculations should work", async () => {
      // test imported from hydra dx node test
      let defaultFee = new FeeLBP({ fee0: UInt64.from(2), fee1: UInt64.from(1000) });

      expect(lbp.calculatePoolTradeFee(UInt64.from(1000), defaultFee.fee0, defaultFee.fee1).toBigInt()).toEqual(2n);
      expect(lbp.calculatePoolTradeFee(UInt64.from(1_000_000_000_000), defaultFee.fee0, defaultFee.fee1).toBigInt()).toEqual(2_000_000_000n);

      let tenPercentFee = new FeeLBP({ fee0: UInt64.from(1), fee1: UInt64.from(10) });

      expect(lbp.calculatePoolTradeFee(UInt64.from(1000), tenPercentFee.fee0, tenPercentFee.fee1).toBigInt()).toEqual(100n);
      expect(lbp.calculatePoolTradeFee(UInt64.from(1_000_000_000_000), tenPercentFee.fee0, tenPercentFee.fee1).toBigInt()).toEqual(100_000_000_000n);

      let maxAmount = UInt64.MAXINT();
      expect(lbp.calculatePoolTradeFee(maxAmount, defaultFee.fee0, defaultFee.fee1).toBigInt()).toEqual(36893488147419102n);
      expect(lbp.calculatePoolTradeFee(maxAmount, tenPercentFee.fee0, tenPercentFee.fee1).toBigInt()).toEqual(1844674407370955161n);

      let maxFee = new FeeLBP({ fee0: UInt64.from(1), fee1: UInt64.from(1) });

      expect(lbp.calculatePoolTradeFee(maxAmount, maxFee.fee0, maxFee.fee1).toBigInt()).toEqual(maxAmount.toBigInt());
      expect(lbp.calculatePoolTradeFee(UInt64.from(1_000), maxFee.fee0, maxFee.fee1).toBigInt()).toEqual(1_000n);

      expect(lbp.calculatePoolTradeFee(UInt64.zero, defaultFee.fee0, defaultFee.fee1).toBigInt()).toEqual(0n);

      let zeroFee = new FeeLBP({ fee0: UInt64.zero, fee1: UInt64.zero });
      expect(lbp.calculatePoolTradeFee(UInt64.from(1000), zeroFee.fee0, zeroFee.fee1).toBigInt()).toEqual(0n);
      expect(lbp.calculatePoolTradeFee(UInt64.from(1_000_000_000_000), zeroFee.fee0, zeroFee.fee1).toBigInt()).toEqual(0n);
      expect(lbp.calculatePoolTradeFee(UInt64.from(1_000_000_000_000), zeroFee.fee0, UInt64.from(1)).toBigInt()).toEqual(0n);


      let urealisticFee = new FeeLBP({ fee0: UInt64.from(1), fee1: UInt64.MAXINT() });
      expect(lbp.calculatePoolTradeFee(maxAmount, urealisticFee.fee0, urealisticFee.fee1).toBigInt()).toEqual(1n);

    });
  });
});
