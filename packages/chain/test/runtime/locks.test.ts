import "reflect-metadata";
import { PrivateKey, PublicKey } from "o1js";
import { fromRuntime } from "../testing-appchain";
import { config, modules } from "../../src/runtime";
import { Balance, TokenId } from "@proto-kit/library";
import { drip } from "../helpers";
import {
  BlockHeight,
  LockId,
  LockReason,
  Locks,
} from "../../src/runtime/locks";

describe("locks", () => {
  const alicePrivateKey = PrivateKey.random();
  const alice = alicePrivateKey.toPublicKey();
  let appChain: ReturnType<typeof fromRuntime<typeof modules>>;

  const tokenId = TokenId.from(0);
  const amount = Balance.from(100);

  let locks: Locks;

  async function queryNetwork() {
    return {
      network: await appChain.query.network.unproven,
    };
  }

  async function queryLock(
    tokenId: TokenId,
    address: PublicKey,
    lockId: LockId
  ) {
    return {
      lock: await appChain.query.runtime.Locks.locks.get({
        address,
        tokenId,
        lockId,
      }),
      lastAddressLockId:
        await appChain.query.runtime.Locks.lastAddressLockId.get(address),
      balance: await appChain.query.runtime.Balances.balances.get({
        tokenId,
        address,
      }),
    };
  }

  async function lockSigned(
    tokenId: TokenId,
    senderPrivateKey: PrivateKey,
    expiresAt: BlockHeight,
    options?: { nonce: number }
  ) {
    appChain.setSigner(senderPrivateKey);
    const tx = await appChain.transaction(
      senderPrivateKey.toPublicKey(),
      () => {
        locks.lockSigned(tokenId, amount, expiresAt);
      },
      options
    );

    await tx.sign();
    await tx.send();
  }

  async function unlockSigned(
    tokenId: TokenId,
    senderPrivateKey: PrivateKey,
    lockId: LockId,
    options?: { nonce: number }
  ) {
    appChain.setSigner(senderPrivateKey);
    const tx = await appChain.transaction(
      senderPrivateKey.toPublicKey(),
      () => {
        locks.unlockSigned(tokenId, lockId);
      },
      options
    );

    await tx.sign();
    await tx.send();
  }

  beforeAll(async () => {
    appChain = fromRuntime(modules);

    appChain.configurePartial({
      Runtime: config,
    });

    await appChain.start();
    appChain.setSigner(alicePrivateKey);

    locks = appChain.runtime.resolve("Locks");
  });

  describe("lock and unlock lifecycle", () => {
    beforeAll(async () => {
      await drip(appChain, alicePrivateKey, tokenId, amount);
      await appChain.produceBlock();
    });

    it("should create a lock", async () => {
      const { network } = await queryNetwork();
      const currentBlockHeight = network?.block.height;

      if (!currentBlockHeight) throw new Error("Block height not found");

      // expires in lock block height + 1
      const expiresAt = BlockHeight.from(currentBlockHeight).add(2);

      await lockSigned(tokenId, alicePrivateKey, expiresAt);
      await appChain.produceBlock();

      const state = await queryLock(tokenId, alice, LockId.from(1));

      expect(state.lock).toBeDefined();
      expect(state.lock?.reason.toString()).toEqual(
        LockReason.voluntary().toString()
      );
      expect(state.lock?.amount.toString()).toEqual(amount.toString());
      expect(state.lock?.expiresAt.toString()).toEqual(expiresAt.toString());
      expect(state.lock?.reason.toString()).toEqual(
        LockReason.voluntary().toString()
      );
      expect(state.lock?.hasBeenUnlocked.toBoolean()).toBe(false);
      expect(state.balance?.toString()).toBe("0");
    });

    it("should unlock an existing lock", async () => {
      await unlockSigned(tokenId, alicePrivateKey, LockId.from(1));
      await appChain.produceBlock();

      const state = await queryLock(tokenId, alice, LockId.from(1));

      expect(state.lock?.hasBeenUnlocked.toBoolean()).toBe(true);
      expect(state.balance?.toString()).toBe(amount.toString());
    });

    it("should not unlock an already unlocked lock", async () => {
      await unlockSigned(tokenId, alicePrivateKey, LockId.from(1));
      const block = await appChain.produceBlock();

      if (!block) throw new Error("Block not found");
      const { status, statusMessage } = block.transactions[0];

      expect(status.toBoolean()).toBe(false);
      expect(statusMessage).toBe("Lock has already been unlocked");
    });
  });
});
