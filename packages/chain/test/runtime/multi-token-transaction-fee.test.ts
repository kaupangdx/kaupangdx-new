import { PrivateKey } from "o1js";
import { Balance, BalancesKey, TokenId } from "@proto-kit/library";
import { config, modules } from "../../src/runtime";
import { fromRuntime } from "../testing-appchain";
import { drip, KaupangTestingAppChain } from "../helpers";

describe("multi token transaction fee", () => {
  const alicePrivateKey = PrivateKey.random();
  const alice = alicePrivateKey.toPublicKey();
  const tokenAId = TokenId.from(0);
  const tokenBId = TokenId.from(1);
  const tokenAInitialLiquidity = Balance.from(1_000_000);
  const tokenBInitialLiquidity = Balance.from(2_000_000);
  let appChain: ReturnType<typeof fromRuntime<typeof modules>>;
  let nonce = 0;

  beforeAll(async () => {
    appChain = fromRuntime(modules);

    appChain.configurePartial({
      Runtime: config,
    });

    await appChain.start();
    appChain.setSigner(alicePrivateKey);
  });

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

  it("should drip tokens", async () => {
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
  });
});
