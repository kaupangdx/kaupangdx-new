import { PrivateKey } from "o1js";
import { BalancesSnapshot } from "../src/runtime/balances-snapshot";
import { TestingAppChain } from "@proto-kit/sdk";
import { Balance, BalancesKey, TokenId } from "@proto-kit/library";
import { modules } from "../src/runtime";
import { Faucet } from "../src/runtime/faucet";

describe("faucet", () => {
  const alicePrivateKey = PrivateKey.random();
  const alice = alicePrivateKey.toPublicKey();
  const tokenId = TokenId.from(0);
  const balanceToDrip = Balance.from(1000);

  let appChain: ReturnType<typeof TestingAppChain.fromRuntime<typeof modules>>;
  let balances: BalancesSnapshot;
  let faucet: Faucet;

  beforeAll(async () => {
    appChain = TestingAppChain.fromRuntime(modules);

    appChain.configurePartial({
      Runtime: {
        Balances: {},
        Faucet: {},
      },
    });

    await appChain.start();
    appChain.setSigner(alicePrivateKey);

    balances = appChain.runtime.resolve("Balances");
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
