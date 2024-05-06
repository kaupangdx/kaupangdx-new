import "reflect-metadata";
import { Balance, TokenId, UInt64 } from "@proto-kit/library";
import { Bool, PrivateKey, Provable, PublicKey } from "o1js";
import { fromRuntime } from "../../testing-appchain";
import { config, modules } from "../../../src/runtime";
import {
  BlockHeight,
  LockId,
  LockKey,
  Locks,
} from "../../../src/runtime/locks";
import { drip } from "../../helpers";
import {
  Proposal,
  ProposalId,
  SetDelegateProposal,
} from "../../../src/runtime/governance/set-delegate-proposal";
import { log } from "@proto-kit/common";

describe("set delegate proposal", () => {
  const alicePrivateKey = PrivateKey.random();
  const alice = alicePrivateKey.toPublicKey();
  const tokenId = TokenId.from(0);
  const amount = Balance.from(1000);

  let appChain: ReturnType<typeof fromRuntime<typeof modules>>;
  let locks: Locks;
  let setDelegateProposal: SetDelegateProposal;

  let nonce = 0;

  beforeAll(async () => {
    appChain = fromRuntime(modules);

    appChain.configurePartial({
      Runtime: config,
    });

    await appChain.start();
    appChain.setSigner(alicePrivateKey);

    locks = appChain.runtime.resolve("Locks");
    setDelegateProposal = appChain.runtime.resolve("SetDelegateProposal");
  });

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

  async function queryProposal(proposalId: ProposalId) {
    return {
      proposal:
        await appChain.query.runtime.SetDelegateProposal.proposals.get(
          proposalId
        ),
    };
  }

  async function queryUsedLocks(lockKey: LockKey) {
    return {
      usedLock:
        await appChain.query.runtime.SetDelegateProposal.usedLocks.get(lockKey),
    };
  }

  async function lockSigned(
    tokenId: TokenId,
    senderPrivateKey: PrivateKey,
    amount: Balance,
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

  describe("proposal lifecycle", () => {
    const lockKey = new LockKey({
      tokenId,
      address: alice,
      lockId: LockId.from(1),
    });
    beforeAll(async () => {
      await drip(
        appChain,
        alicePrivateKey,
        tokenId,
        Balance.from(amount.toBigInt() * 3n),
        {
          nonce: nonce++,
        }
      );

      await lockSigned(tokenId, alicePrivateKey, amount, BlockHeight.from(4), {
        nonce: nonce++,
      });
    });

    it("should propose a new proposal", async () => {
      const delegate = PrivateKey.random().toPublicKey();

      const tx = await appChain.transaction(
        alice,
        () => {
          setDelegateProposal.proposeSigned(delegate, lockKey);
        },
        {
          nonce: nonce++,
        }
      );

      await tx.sign();
      await tx.send();

      await appChain.produceBlock();
      const { proposal } = await queryProposal(ProposalId.from(1));
      const { usedLock } = await queryUsedLocks(lockKey);

      expect(proposal?.delegate.toBase58()).toEqual(delegate.toBase58());
      expect(usedLock?.toBoolean()).toEqual(true);
    });

    it("should vote on an existing proposal", async () => {
      await lockSigned(
        tokenId,
        alicePrivateKey,
        UInt64.from(amount.toBigInt() * 2n),
        BlockHeight.from(4),
        {
          nonce: nonce++,
        }
      );

      const lockKey = new LockKey({
        tokenId,
        address: alice,
        lockId: LockId.from(2),
      });

      const tx = await appChain.transaction(
        alice,
        () => {
          setDelegateProposal.voteSigned(
            ProposalId.from(1),
            lockKey,
            Bool(true)
          );
        },
        {
          nonce: nonce++,
        }
      );

      await tx.sign();
      await tx.send();

      const block = await appChain.produceBlock();
      Provable.log(block);
    });

    it("should execute an existing proposal", async () => {
      const tx = await appChain.transaction(
        alice,
        () => {
          setDelegateProposal.execute(ProposalId.from(1));
        },
        {
          nonce: nonce++,
        }
      );

      await tx.sign();
      await tx.send();

      const block = await appChain.produceBlock();
      Provable.log(block);
    });
  });
});
