import {
  RuntimeModule,
  runtimeMethod,
  runtimeModule,
  state,
} from "@proto-kit/module";
import { Protocol, State, StateMap, assert } from "@proto-kit/protocol";
import { Bool, Field, Provable, PublicKey, Struct } from "o1js";
import { BlockHeight, LockKey, Locks } from "../locks";
import { inject } from "tsyringe";
import {
  GovernanceLifecycleTransactionHook,
  GovernancePeriod,
  GovernancePeriodId,
} from "../../protocol/governance-lifecycle";
import { Balance, UInt64 } from "@proto-kit/library";
import { Balances } from "../balances";
import { OutgoingMessages, OutgoingMessagesCursor } from "../outgoing-messages";

export class ProposalId extends Field {}
export class Proposal extends Struct({
  delegate: PublicKey,
}) {}

export interface SetDelegateProposalConfig {
  stakeTokenId: bigint;
  maximumAllowedConvictionMultiplier: bigint;
  precisionDivider: bigint;
  minimalRequiredWeightPercentageToPropose: bigint;
}

export class Votes extends Struct({
  yay: UInt64,
  nay: UInt64,
}) {}

// TODO: add logic that tags proposals with which governance lifecycle they belong to,
// so they cannot be interacted with in different lifecycles
@runtimeModule()
export class SetDelegateProposal extends RuntimeModule<SetDelegateProposalConfig> {
  @state() public proposals = StateMap.from<ProposalId, Proposal>(
    ProposalId,
    Proposal
  );

  // ensure locks cannot be used twice to create or vote on proposals
  @state() public usedLocks = StateMap.from<LockKey, Bool>(LockKey, Bool);

  @state() public lastProposalId = State.from(ProposalId);

  @state() public votes = StateMap.from<ProposalId, Votes>(ProposalId, Votes);
  @state() public proposalLastVotedAt = StateMap.from<
    ProposalId,
    GovernancePeriodId
  >(ProposalId, GovernancePeriodId);

  @state() public executedProposals = StateMap.from<
    ProposalId,
    OutgoingMessagesCursor
  >(ProposalId, OutgoingMessagesCursor);

  public governanceLifecycle: GovernanceLifecycleTransactionHook;

  public constructor(
    @inject("Balances") public balances: Balances,
    @inject("Locks") public locks: Locks,
    @inject("OutgoingMessages") public outgoingMessages: OutgoingMessages,
    @inject("Protocol") public protocol: Protocol<any>
  ) {
    super();
    this.governanceLifecycle = this.protocol.resolveOrFail(
      "GovernanceLifecycle",
      GovernanceLifecycleTransactionHook
    );
  }

  public getMinimalRequiredWeightToPropose() {
    const circulatingSupply = this.balances.circulatingSupply.get().value;
    const minimalRequiredWeightToPropose = Balance.from(circulatingSupply.value)
      .mul(this.config.minimalRequiredWeightPercentageToPropose)
      .div(this.config.precisionDivider);

    return minimalRequiredWeightToPropose;
  }

  public calculateVotingWeight(
    currentGovernancePeriod: GovernancePeriod,
    currentGovernancePeriodStartedAtBlock: BlockHeight,
    lockKey: LockKey
  ) {
    const lock = this.locks.locks.get(lockKey);
    const isLockUsed = this.usedLocks.get(lockKey).isSome;

    const maximumGovernancePeriod = Field(
      this.governanceLifecycle.config.maximumGovernancePeriod + 1n
    );
    const blocksUntilGovernanceLifecycleEnds = maximumGovernancePeriod.sub(
      currentGovernancePeriod
    );

    // locks need to expire at least n governance periods after the current one (after the execution period)
    const minimalLockExpiresAt = BlockHeight.from(
      currentGovernancePeriodStartedAtBlock.value
    ).add(
      BlockHeight.from(
        this.governanceLifecycle.config.goverancePeriodDurationInBlocks
      ).mul(BlockHeight.from(blocksUntilGovernanceLifecycleEnds))
    );

    const isLockDurationAboveMinimalExpiresAt = BlockHeight.from(
      lock.value.expiresAt
    ).greaterThanOrEqual(minimalLockExpiresAt);

    const lockTokenIdIsStakeTokenId = lockKey.tokenId.equals(
      this.config.stakeTokenId
    );

    const lockExpiresAtLessThanMinimal = BlockHeight.from(
      lock.value.expiresAt
    ).lessThan(minimalLockExpiresAt);

    const lockDurationBeyondMinimal = new BlockHeight(
      lock.value.expiresAt.value.sub(minimalLockExpiresAt.value)
    );

    const adjustedLockDurationBeyondMinimal = BlockHeight.from(
      Provable.if(
        lockExpiresAtLessThanMinimal,
        BlockHeight,
        BlockHeight.from(0),
        lockDurationBeyondMinimal
      ).value
    );

    const extraPeriodsStakeLockedFor = adjustedLockDurationBeyondMinimal.div(
      this.governanceLifecycle.config.goverancePeriodDurationInBlocks
    );

    const extraLifecyclesStakeLockedFor = extraPeriodsStakeLockedFor.div(
      // need to do +1, since 0 is the id of the first governance period
      this.governanceLifecycle.config.maximumGovernancePeriod + 1n
    );

    // as of now 1 lifecycle = 1 conviction "point"
    // we also add 1 to the multiplier, since the minimal lock duration is for 1 lifecycle already
    const convictionMultiplier = extraLifecyclesStakeLockedFor.add(1n);

    const votingWeight = Balance.from(lock.value.amount).mul(
      convictionMultiplier
    );

    assert(lock.isSome, "Lock not found");
    assert(isLockUsed.not(), "Lock already used");
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

    return votingWeight;
  }

  public propose(delegate: PublicKey, lockKey: LockKey) {
    const lastProposalId = this.lastProposalId.get().value;
    const currentGovernancePeriod =
      this.governanceLifecycle.currentGovernancePeriod.get().value;
    const currentGovernancePeriodStartedAtBlock = BlockHeight.from(
      this.governanceLifecycle.currentGovernancePeriodStartedAtBlock.get().value
        .value
    );

    const votingWeight = this.calculateVotingWeight(
      currentGovernancePeriod,
      currentGovernancePeriodStartedAtBlock,
      lockKey
    );
    const minimalRequiredWeightToPropose =
      this.getMinimalRequiredWeightToPropose();
    const isVotingWeightAboveMinimalRequiredWeightToPropose =
      votingWeight.greaterThanOrEqual(minimalRequiredWeightToPropose);

    assert(
      currentGovernancePeriod.equals(0n),
      "Current governance period does not accept new proposals"
    );

    assert(
      isVotingWeightAboveMinimalRequiredWeightToPropose,
      "Proposer's voting weight too low"
    );

    const proposal = new Proposal({
      delegate,
    });

    const nextProposalId = lastProposalId.add(1n);

    this.lastProposalId.set(nextProposalId);
    this.proposals.set(nextProposalId, proposal);
    this.usedLocks.set(lockKey, Bool(true));
  }

  public vote(proposalId: ProposalId, lockKey: LockKey, vote: Bool) {
    const proposal = this.proposals.get(proposalId);
    const currentGovernancePeriod =
      this.governanceLifecycle.currentGovernancePeriod.get().value;
    const currentGovernancePeriodStartedAtBlock = BlockHeight.from(
      this.governanceLifecycle.currentGovernancePeriodStartedAtBlock.get().value
        .value
    );

    const votes = this.votes.get(proposalId).value;

    const votingWeight = this.calculateVotingWeight(
      currentGovernancePeriod,
      currentGovernancePeriodStartedAtBlock,
      lockKey
    );

    assert(proposal.isSome, "Proposal not found");
    assert(
      currentGovernancePeriod.equals(1n),
      "Current governance period does not allow voting on proposals"
    );

    const updatedYay = UInt64.from(
      Provable.if(
        vote,
        UInt64,
        UInt64.from(votes.yay).add(votingWeight),
        votes.yay
      ).value
    );
    const updatedNay = UInt64.from(
      Provable.if(
        vote.not(),
        UInt64,
        UInt64.from(votes.nay).add(votingWeight),
        votes.nay
      ).value
    );
    const updatedVotes = new Votes({
      yay: updatedYay,
      nay: updatedNay,
    });

    Provable.log({
      votingWeight,
      updatedVotes,
    });

    const proposalLastVotedAt = GovernancePeriodId.fromGovernancePeriod(
      currentGovernancePeriodStartedAtBlock,
      currentGovernancePeriod
    );

    this.usedLocks.set(lockKey, Bool(true));
    this.votes.set(proposalId, updatedVotes);
    this.proposalLastVotedAt.set(proposalId, proposalLastVotedAt);
  }

  @runtimeMethod()
  public execute(proposalId: ProposalId) {
    const isProposalExecuted = this.executedProposals.get(proposalId).isSome;
    const proposalLastVotedAt = this.proposalLastVotedAt.get(proposalId).value;
    const circulatingSupplySnapshot = Balance.from(
      this.governanceLifecycle.circulatingSupplySnapshots.get(
        proposalLastVotedAt
      ).value
    );

    const votes = this.votes.get(proposalId).value;
    const totalVotes = UInt64.from(votes.nay).add(votes.yay);

    Provable.log("execute", {
      circulatingSupplySnapshot,
      div: circulatingSupplySnapshot.div(100),
    });

    const participationPercentageDivider = circulatingSupplySnapshot.div(100);
    const isParticipationPercentageDividerZero =
      participationPercentageDivider.value.equals(0n);
    const adjustedParticipationPercentageDivider = UInt64.from(
      Provable.if(
        isParticipationPercentageDividerZero,
        Field.from(1n),
        participationPercentageDivider.value
      )
    );

    // calculate if quorum was met
    const participation = totalVotes.div(
      adjustedParticipationPercentageDivider
    );
    const wasParticipationSufficient = participation.greaterThanOrEqual(
      UInt64.from(60n)
    );

    Provable.log("participation", {
      adjustedParticipationPercentageDivider,
      participation,
      wasParticipationSufficient,
    });

    const oneVotePercentageDivider = totalVotes.div(100);
    const isOneVotePercentageDividerZero =
      oneVotePercentageDivider.value.equals(0n);
    const adjustedOneVotePercentageDivider = UInt64.from(
      Provable.if(
        isOneVotePercentageDividerZero,
        Field.from(1n),
        oneVotePercentageDivider.value
      )
    );
    const yayPercentage = UInt64.from(votes.yay).div(
      adjustedOneVotePercentageDivider
    );

    // calculate if "supermajority" was met
    const yayWins = yayPercentage.greaterThanOrEqual(UInt64.from(60n));

    assert(
      isParticipationPercentageDividerZero
        .or(isOneVotePercentageDividerZero)
        .not(),
      "Division by zero"
    );
    assert(isProposalExecuted.not(), "Proposal already executed");
    assert(wasParticipationSufficient, "Participation too low");
    assert(yayWins, "Insufficient yay votes");

    const outgoingMessagesCursor = this.outgoingMessages.incrementCursor();
    this.executedProposals.set(proposalId, outgoingMessagesCursor);
  }

  @runtimeMethod()
  public proposeSigned(delegate: PublicKey, lockKey: LockKey) {
    const sender = this.transaction.sender.value;
    assert(
      sender.equals(lockKey.address),
      "Lock address does not match sender"
    );

    this.propose(delegate, lockKey);
  }

  @runtimeMethod()
  public voteSigned(proposalId: ProposalId, lockKey: LockKey, vote: Bool) {
    const sender = this.transaction.sender.value;
    assert(
      sender.equals(lockKey.address),
      "Lock address does not match sender"
    );

    this.vote(proposalId, lockKey, vote);
  }
}
