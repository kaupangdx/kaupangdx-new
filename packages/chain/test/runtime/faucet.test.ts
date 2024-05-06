import { PrivateKey } from "o1js";
import { Balance, BalancesKey, TokenId } from "@proto-kit/library";
import { config, modules } from "../../src/runtime";
import { Faucet } from "../../src/runtime/faucet";
import { fromRuntime } from "../testing-appchain";

describe("faucet", () => {
  const alicePrivateKey = PrivateKey.random();
  const alice = alicePrivateKey.toPublicKey();
  const tokenId = TokenId.from(0);
  const balanceToDrip = Balance.from(1000);

  let appChain: ReturnType<typeof fromRuntime<typeof modules>>;
  let faucet: Faucet;

  beforeAll(async () => {
    appChain = fromRuntime(modules);

    appChain.configurePartial({
      Runtime: config,
    });

    await appChain.start();
    appChain.setSigner(alicePrivateKey);

    faucet = appChain.runtime.resolve("Faucet");
  });

  it("should drip tokens", async () => {
    const tx = await appChain.transaction(alice, () => {
      faucet.dripSigned(tokenId, balanceToDrip);
    });

    await tx.sign();
    await tx.send();

    await appChain.produceBlock();

    const key = new BalancesKey({
      tokenId,
      address: alice,
    });
    const balance = await appChain.query.runtime.Balances.balances.get(key);
    expect(balance?.toString()).toBe(balanceToDrip.toString());
  });
});
