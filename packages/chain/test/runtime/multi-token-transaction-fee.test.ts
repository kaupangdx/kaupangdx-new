import { PrivateKey, Provable } from "o1js";
import { Balance, BalancesKey, TokenId } from "@proto-kit/library";
import { config, modules } from "../../src/runtime";
import {
  feeTokenId as originalFeeTokenId,
  fromRuntime,
} from "../testing-appchain";
import { drip, KaupangTestingAppChain } from "../helpers";
import { Balances } from "../../src/runtime/balances";
import { MultiTokenTransactionFee } from "../../src/runtime/multi-token-transaction-fee";

describe("multi token transaction fee", () => {
  const alicePrivateKey = PrivateKey.random();
  const alice = alicePrivateKey.toPublicKey();
  const bobPrivateKey = PrivateKey.random();
  const bob = bobPrivateKey.toPublicKey();
  const newFeeTokenId = TokenId.from(1);
  const newFeeTokenAmount = Balance.from(1_000_000_000);
  const originalFeeTokenAmount = Balance.from(1_000_000_000);
  let appChain: ReturnType<typeof fromRuntime<typeof modules>>;
  let balances: Balances;
  let multiTransactionFee: MultiTokenTransactionFee;
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

  beforeAll(async () => {
    appChain = fromRuntime(modules);

    appChain.configurePartial({
      Runtime: config,
    });

    await appChain.start();
    appChain.setSigner(alicePrivateKey);
    balances = appChain.runtime.resolve("Balances");
    multiTransactionFee = appChain.runtime.resolve("MultiTokenTransactionFee");
  });

  it("should transfer tokens", async () => {
    await drip(appChain, alicePrivateKey, newFeeTokenId, newFeeTokenAmount);
    await appChain.produceBlock();
    await drip(
      appChain,
      alicePrivateKey,
      originalFeeTokenId,
      originalFeeTokenAmount
    );
    await appChain.produceBlock();

    await createPoolSigned(
      appChain,
      alicePrivateKey,
      newFeeTokenId,
      originalFeeTokenId,
      newFeeTokenAmount.div(2),
      originalFeeTokenAmount.div(2)
    );

    const block = await appChain.produceBlock();
    Provable.log(block?.transactions);

    const balanceOriginalFee =
      await appChain.query.runtime.Balances.balances.get(
        new BalancesKey({ tokenId: newFeeTokenId, address: alice })
      );
    const balanceFee = await appChain.query.runtime.Balances.balances.get(
      new BalancesKey({ tokenId: originalFeeTokenId, address: alice })
    );

    Provable.log({
      balanceOriginalFee,
      balanceFee,
    });

    const tx1 = await appChain.transaction(alice, () => {
      multiTransactionFee.setFeeTokenSigned(newFeeTokenId);
    });

    await tx1.sign();
    await tx1.send();

    await appChain.produceBlock();

    const transferAmount = Balance.from(500);
    const tx2 = await appChain.transaction(alice, () => {
      balances.transferSigned(originalFeeTokenId, alice, bob, transferAmount);
    });

    await tx2.sign();
    await tx2.send();

    const block2 = await appChain.produceBlock();

    Provable.log("transferAmount", transferAmount);
    Provable.log(block2?.transactions);

    const balanceOriginalFee2 =
      await appChain.query.runtime.Balances.balances.get(
        new BalancesKey({ tokenId: originalFeeTokenId, address: alice })
      );
    const balanceFee2 = await appChain.query.runtime.Balances.balances.get(
      new BalancesKey({ tokenId: newFeeTokenId, address: alice })
    );

    Provable.log({
      balanceOriginalFee2,
      balanceFee2,
    });
  });
});
