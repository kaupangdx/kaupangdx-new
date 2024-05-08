import "reflect-metadata";
import { Balance, TokenId } from "@proto-kit/library";
import { PrivateKey, Provable, PublicKey, UInt64 } from "o1js";
import { fromRuntime } from "../../testing-appchain";
import { config, modules } from "../../../src/runtime";
import { TokenIdPath, XYK, errors } from "../../../src/runtime/xyk/xyk";
import { KaupangTestingAppChain, drip } from "../../helpers";
import { PoolKey } from "../../../src/runtime/xyk/pool-key";
import { TokenPair } from "../../../src/runtime/xyk/token-pair";
import { LPTokenId } from "../../../src/runtime/xyk/lp-token-id";
import { MAX_TOKEN_ID } from "../../../src/runtime/token-registry";

describe("xyk", () => {
  const alicePrivateKey = PrivateKey.random();
  const alice = alicePrivateKey.toPublicKey();

  const tokenAId = TokenId.from(0);
  const tokenBId = TokenId.from(1);
  const tokenAInitialLiquidity = Balance.from(1_000_000);
  const tokenBInitialLiquidity = Balance.from(1_000_000);

  const lpTokenId = LPTokenId.fromTokenPair(TokenPair.from(tokenAId, tokenBId));

  let appChain: ReturnType<typeof fromRuntime<typeof modules>>;
  let xyk: XYK;

  let nonce = 0;

  async function createPoolSigned(
    appChain: KaupangTestingAppChain,
    senderPrivateKey: PrivateKey,
    tokenAId: TokenId,
    tokenBId: TokenId,
    tokenAAmount: Balance,
    tokenBAmount: Balance,
    options?: { nonce: number }
  ) {
    const xyk = appChain.runtime.resolve("XYK");
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

  async function addLiquiditySigned(
    appChain: KaupangTestingAppChain,
    senderPrivateKey: PrivateKey,
    tokenAId: TokenId,
    tokenBId: TokenId,
    tokenAAmount: Balance,
    tokenBLimit: Balance,
    options?: { nonce: number }
  ) {
    const xyk = appChain.runtime.resolve("XYK");
    appChain.setSigner(senderPrivateKey);

    const tx = await appChain.transaction(
      senderPrivateKey.toPublicKey(),
      () => {
        xyk.addLiquiditySigned(tokenAId, tokenBId, tokenAAmount, tokenBLimit);
      },
      options
    );

    await tx.sign();
    await tx.send();

    return tx;
  }

  async function removeLiquiditySigned(
    appChain: KaupangTestingAppChain,
    senderPrivateKey: PrivateKey,
    tokenAId: TokenId,
    tokenBId: TokenId,
    lpTokenAmount: Balance,
    tokenAAmountLimit: Balance,
    tokenBAmountLimit: Balance,
    options?: { nonce: number }
  ) {
    const xyk = appChain.runtime.resolve("XYK");
    appChain.setSigner(senderPrivateKey);

    const tx = await appChain.transaction(
      senderPrivateKey.toPublicKey(),
      () => {
        xyk.removeLiquiditySigned(
          tokenAId,
          tokenBId,
          lpTokenAmount,
          tokenAAmountLimit,
          tokenBAmountLimit
        );
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
    path: TokenIdPath,
    amountIn: Balance,
    amountOutMinLimit: Balance,
    options?: { nonce: number }
  ) {
    const xyk = appChain.runtime.resolve("XYK");
    appChain.setSigner(senderPrivateKey);

    const tx = await appChain.transaction(
      senderPrivateKey.toPublicKey(),
      () => {
        xyk.sellPathSigned(path, amountIn, amountOutMinLimit);
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

      xyk = appChain.runtime.resolve("XYK");
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
        { nonce: nonce++ }
      );

      await appChain.produceBlock();

      const { pool, liquidity } = await queryPool(appChain, tokenAId, tokenBId);
      const { balance: aliceLpBalance } = await queryBalance(
        appChain,
        lpTokenId,
        alice
      );

      expect(pool).toBeDefined();
      expect(liquidity.tokenA?.toString()).toEqual(
        tokenAInitialLiquidity.toString()
      );
      expect(liquidity.tokenB?.toString()).toEqual(
        tokenBInitialLiquidity.toString()
      );
      expect(aliceLpBalance?.toString()).toEqual(
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
        { nonce: nonce++ }
      );

      const block = await appChain.produceBlock();
      const tx = block?.transactions[0];

      expect(tx?.status.toBoolean()).toBe(false);
      expect(tx?.statusMessage).toBe(errors.poolAlreadyExists());
    });
  });

  describe("add liquidity", () => {
    beforeAll(async () => {
      nonce = 0;
      appChain = fromRuntime(modules);

      appChain.configurePartial({
        Runtime: config,
      });

      await appChain.start();
      appChain.setSigner(alicePrivateKey);

      xyk = appChain.runtime.resolve("XYK");

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
        { nonce: nonce++ }
      );
    });

    it("should add liquidity to an existing pool", async () => {
      await addLiquiditySigned(
        appChain,
        alicePrivateKey,
        tokenAId,
        tokenBId,
        Balance.from(tokenAInitialLiquidity.toBigInt() / 2n),
        Balance.from(tokenBInitialLiquidity.toBigInt() / 2n),
        { nonce: nonce++ }
      );

      await appChain.produceBlock();
      const { balance: aliceLpBalance } = await queryBalance(
        appChain,
        lpTokenId,
        alice
      );

      const { liquidity } = await queryPool(appChain, tokenAId, tokenBId);

      expect(aliceLpBalance?.toString()).toEqual(
        String(
          tokenAInitialLiquidity.toBigInt() +
            tokenAInitialLiquidity.toBigInt() / 2n
        )
      );
      expect(liquidity.tokenA?.toString()).toEqual(
        String(
          tokenAInitialLiquidity.toBigInt() +
            tokenAInitialLiquidity.toBigInt() / 2n
        )
      );
      expect(liquidity.tokenB?.toString()).toEqual(
        String(
          tokenBInitialLiquidity.toBigInt() +
            tokenBInitialLiquidity.toBigInt() / 2n
        )
      );
    });
  });

  describe("remove liquidity", () => {
    beforeAll(async () => {
      nonce = 0;
      appChain = fromRuntime(modules);

      appChain.configurePartial({
        Runtime: config,
      });

      await appChain.start();
      appChain.setSigner(alicePrivateKey);

      xyk = appChain.runtime.resolve("XYK");

      await drip(
        appChain,
        alicePrivateKey,
        tokenAId,
        Balance.from(tokenAInitialLiquidity.toBigInt()),
        {
          nonce: nonce++,
        }
      );
      await drip(
        appChain,
        alicePrivateKey,
        tokenBId,
        Balance.from(tokenBInitialLiquidity.toBigInt()),
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
        { nonce: nonce++ }
      );
    });

    it("should add liquidity to an existing pool", async () => {
      await removeLiquiditySigned(
        appChain,
        alicePrivateKey,
        tokenAId,
        tokenBId,
        Balance.from(tokenAInitialLiquidity.toBigInt()),
        Balance.from(tokenAInitialLiquidity.toBigInt()),
        Balance.from(tokenBInitialLiquidity.toBigInt()),
        { nonce: nonce++ }
      );

      await appChain.produceBlock();
      const { balance: aliceLpBalance } = await queryBalance(
        appChain,
        lpTokenId,
        alice
      );

      const { liquidity } = await queryPool(appChain, tokenAId, tokenBId);

      expect(aliceLpBalance?.toString()).toEqual("0");
      expect(liquidity.tokenA?.toString()).toEqual("0");
      expect(liquidity.tokenB?.toString()).toEqual("0");
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

      xyk = appChain.runtime.resolve("XYK");

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
        { nonce: nonce++ }
      );
    });

    it("should sell tokens for tokens out", async () => {
      const path = new TokenIdPath({
        path: [tokenAId, tokenBId, TokenId.from(MAX_TOKEN_ID)],
      });

      await sellPathSigned(
        appChain,
        alicePrivateKey,
        path,
        Balance.from(100),
        Balance.from(1),
        { nonce: nonce++ }
      );

      const block = await appChain.produceBlock();
      Provable.log("block", block);

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

      Provable.log("balances", {
        balanceA,
        balanceB,
      });
    });
  });
});
