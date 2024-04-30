import { RuntimeModule, runtimeModule, state } from "@proto-kit/module";
import { Protocol, State, StateMap, assert } from "@proto-kit/protocol";
import { Bool, Field, PublicKey, Struct } from "o1js";
import { BlockHeight, LockKey, Locks } from "../locks";
import { inject } from "tsyringe";
import { GovernanceLifecycleTransactionHook } from "../../protocol/governance-lifecycle";
import { Balance, UInt64 } from "@proto-kit/library";
import { Balances } from "../balances";

export class ProposalId extends Field {}
export class Proposal extends Struct({
  delegate: PublicKey,
  weight: Balance,
}) {}

export interface SetDelegateProposalConfig {
  stakeTokenId: bigint;
  maximumAllowedConvictionMultiplier: bigint;
  minimalRequiredWeightToPropose: bigint;
}

@runtimeModule()
export class SetDelegateProposal extends RuntimeModule<SetDelegateProposalConfig> {
  @state() public proposals = StateMap.from<ProposalId, Proposal>(
    ProposalId,
    Proposal
  );

  // ensure locks cannot be used twice to create or vote on proposals
  @state() public usedLocks = StateMap.from<LockKey, Bool>(LockKey, Bool);

  @state() public lastProposalId = State.from(ProposalId);

  public governanceLifecycle: GovernanceLifecycleTransactionHook;

  public constructor(
    @inject("Balances") public balances: Balances,
    @inject("Locks") public locks: Locks,
    @inject("Protocol") public protocol: Protocol<any>
  ) {
    super();
    this.governanceLifecycle = this.protocol.resolveOrFail(
      "GovernanceLifecycle",
      GovernanceLifecycleTransactionHook
    );
  }

  public propose(proposal: Proposal, lockKey: LockKey) {
    const lastProposalId = this.lastProposalId.get().value;
    // create a lock for the sender equivalent to minimal stake required to prevent double proposing
    // (make this a default, so LP locks can be reused etc) alternatively allow to create a proposal out of a voluntary lock, not a one created automatically by the
    // governance system
    const lock = this.locks.locks.get(lockKey);

    const currentGovernancePeriodStartedAtBlock =
      this.governanceLifecycle.currentGovernancePeriodStartedAtBlock.get()
        .value;

    // locks need to expire at least 3 governance periods after the current one (after the execution period)
    const minimalLockExpiresAt = BlockHeight.from(
      currentGovernancePeriodStartedAtBlock.value
    ).add(this.governanceLifecycle.config.goverancePeriodDurationInBlocks * 4n);

    const isLockDurationAboveMinimalExpiresAt =
      minimalLockExpiresAt.lessThanOrEqual(lock.value.expiresAt);

    const lockTokenIdIsStakeTokenId = lockKey.tokenId.equals(
      this.config.stakeTokenId
    );

    const lockDurationBeyondMinimal =
      lock.value.expiresAt.sub(minimalLockExpiresAt);

    const extraPeriodsStakeLockedFor = lockDurationBeyondMinimal.div(
      this.governanceLifecycle.config.goverancePeriodDurationInBlocks
    );

    const extraLifecyclesStakeLockedFor = extraPeriodsStakeLockedFor.div(
      // need to do +1, since 0 is the id of the first governance period
      this.governanceLifecycle.config.maximumGovernancePeriod + 1n
    );

    // as of now 1 lifecycle = 1 conviction "point"
    // we also add 1 to the multiplier, since the minimal lock duration is for 1 lifecycle already
    const convictionMultiplier = extraLifecyclesStakeLockedFor.add(1n);

    const votingWeight = lock.value.amount.mul(convictionMultiplier);
    const isVotingWeightAboveMinimalRequiredWeightToPropose =
      votingWeight.greaterThanOrEqual(
        UInt64.from(this.config.minimalRequiredWeightToPropose)
      );

    assert(lock.isSome, "Lock not found");
    assert(isLockDurationAboveMinimalExpiresAt, "Lock duration too short");
    assert(
      lockTokenIdIsStakeTokenId,
      "Lock token id is not the stake token id"
    );
    assert(
      convictionMultiplier.lessThanOrEqual(
        UInt64.from(this.config.maximumAllowedConvictionMultiplier)
      ),
      "Conviction multiplier too high"
    );
    assert(
      isVotingWeightAboveMinimalRequiredWeightToPropose,
      "Voting weight too low"
    );

    const weightedProposal = new Proposal({
      ...proposal,
      weight: votingWeight,
    });

    const nextProposalId = lastProposalId.add(1n);

    this.lastProposalId.set(nextProposalId);
    this.proposals.set(nextProposalId, weightedProposal);

    // TODO: prevent double spending of locks on a per period + per proposal basis
  }

  public endorse() {
    // endorse existing proposals adding your own stake to the proposal stake, to qualify it for voting later on
  }

  public vote() {
    // probably vote through a separate module, where doublespending of locks is prevented
  }

  public execute() {
    // add to outgoing messages
  }
}
