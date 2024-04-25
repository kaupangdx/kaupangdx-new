import "reflect-metadata";
import { Field, PrivateKey, Provable } from "o1js";
import {
  BalancesSnapshot,
  SnapshotId,
  SnapshotKey,
} from "../src/runtime/balances-snapshot";
import { TestingAppChain } from "@proto-kit/sdk";
import { Balance, TokenId } from "@proto-kit/library";
import { modules } from "../src/runtime";
import { drip, incrementSnapshotId } from "./helpers";
import { runtimeMethod, runtimeModule } from "@proto-kit/module";

@runtimeModule()
export class TestBalancesSnapshot extends BalancesSnapshot {
  @runtimeMethod()
  public incrementSnapshotId(): void {
    super.incrementSnapshotId();
  }
}

const testModules = {
  ...modules,
  Balances: TestBalancesSnapshot,
};

describe("balances snapshot", () => {
  const alicePrivateKey = PrivateKey.random();
  const alice = alicePrivateKey.toPublicKey();
  let appChain: ReturnType<
    typeof TestingAppChain.fromRuntime<typeof testModules>
  >;
  let balances: BalancesSnapshot;

  const tokenId = TokenId.from(0);
  const amount = Balance.from(100);

  beforeEach(async () => {
    appChain = TestingAppChain.fromRuntime(testModules);

    appChain.configurePartial({
      Runtime: {
        Balances: {},
        Faucet: {},
      },
    });

    await appChain.start();
    appChain.setSigner(alicePrivateKey);

    balances = appChain.runtime.resolve("Balances");
  });

  describe("creating snapshots when balance is set", () => {
    beforeEach(async () => {
      await drip(appChain, alicePrivateKey, tokenId, amount);
      await appChain.produceBlock();
    });

    it("should have created a snapshot", async () => {
      const currentSnapshotId =
        await appChain.query.runtime.Balances.currentSnapshotId.get();
      const latestAliceSnapshot =
        await appChain.query.runtime.Balances.latestAddressSnapshots.get(alice);

      const aliceSnapshotKey = new SnapshotKey({
        snapshotId: currentSnapshotId ?? SnapshotId.from(0),
        tokenId,
        address: alice,
      });

      const aliceSnapshot =
        await appChain.query.runtime.Balances.snapshots.get(aliceSnapshotKey);

      Provable.log({
        currentSnapshotId,
        latestAliceSnapshot,
        aliceSnapshotKey,
        aliceSnapshot,
      });
    });
  });

  it.only("should create subsequent snapshots when snapshotId increments", async () => {
    async function print() {
      const currentSnapshotId =
        await appChain.query.runtime.Balances.currentSnapshotId.get();

      const latestAliceSnapshot =
        await appChain.query.runtime.Balances.latestAddressSnapshots.get(alice);

      const aliceSnapshotKey0 = new SnapshotKey({
        snapshotId: SnapshotId.from(0),
        tokenId,
        address: alice,
      });

      const aliceSnapshotKey1 = new SnapshotKey({
        snapshotId: SnapshotId.from(1),
        tokenId,
        address: alice,
      });

      const aliceSnapshot0 =
        await appChain.query.runtime.Balances.snapshots.get(aliceSnapshotKey0);

      const aliceSnapshot1 =
        await appChain.query.runtime.Balances.snapshots.get(aliceSnapshotKey1);

      Provable.log({
        currentSnapshotId,
        latestAliceSnapshot,
        aliceSnapshotKey0,
        aliceSnapshotKey1,
        aliceSnapshot0: aliceSnapshot0 ?? "no snapshot found",
        aliceSnapshot1: aliceSnapshot1 ?? "no snapshot found",
      });
    }

    let nonce = 0;

    await drip(appChain, alicePrivateKey, tokenId, amount, {
      nonce: nonce++,
    });

    await incrementSnapshotId(appChain, alicePrivateKey, {
      nonce: nonce++,
    });

    Provable.log("producing block 1");
    await appChain.produceBlock();

    await print();

    await drip(appChain, alicePrivateKey, tokenId, amount, {
      nonce: nonce++,
    });

    Provable.log("producing block 2");
    await appChain.produceBlock();

    await print();
  });
});
