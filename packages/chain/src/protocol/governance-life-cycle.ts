import { Balance, TokenId, UInt64 } from "@proto-kit/library";
import {
    AfterTransactionHookArguments,
    BeforeTransactionHookArguments,
  NetworkState,
  ProvableTransactionHook,
  State,
  StateMap,
  state
} from "@proto-kit/protocol";
import { Field, Poseidon, Provable } from "o1js";
import { inject, injectable } from "tsyringe";
import { modules } from "../runtime";
import { Runtime } from "@proto-kit/module";
import { Balances } from "../runtime/modules/balances";
import { noop } from "@proto-kit/common";

export class GovernancePeriod extends Field {}
export class BlockHeight extends UInt64 {}
export class GovernancePeriodId extends Field {
  public static fromGovernancePeriod(
    blockHeight: BlockHeight,
    period: GovernancePeriod
  ) {
    return GovernancePeriodId.from(
      Poseidon.hash([
        ...BlockHeight.toFields(blockHeight),
        ...GovernancePeriod.toFields(period),
      ])
    );
  }
}

export interface GovernanceLifecycleBlockHookConfig {
  /**
   * Specify how long a governance period should last in blocks. Depending
   * on your chain's block time, if you'd like the governance period to last a week,
   * you'll need to calculate the number of blocks in a week and set it here.
   */
  goverancePeriodDurationInBlocks: bigint;
  /**
   * If you require a total of 4 periods (propose-discover-vote-execute) identified
   * by a Field (0-1-2-3). Then this config should be set to '3'.
   */
  maximumGovernancePeriod: bigint;
}

// TODO: turn this into a block hook, once we figure out why it's not working
// the error was "unable to provide a name" (due to state usage), even tho it was implemented
// the same way as the LastStateRootBlockHook

/**
 * Keeps track of the current governance period and advances it when the
 * sufficient amount of blocks have passed since the start of the current
 * governance period.
 */
@injectable()
export class GovernanceLifecycleTransactionHook extends ProvableTransactionHook<GovernanceLifecycleBlockHookConfig> {
  @state() public currentGovernancePeriod =
    State.from(GovernancePeriod);

  @state() public currentGovernancePeriodStartedAtBlock =
    State.from(BlockHeight);

  @state() public totalSupplySnapshots = StateMap.from<
    GovernancePeriodId,
    Balance
  >(GovernancePeriodId, Balance);

  public balances: Balances;

  public constructor(
    @inject("Runtime") public runtime: Runtime<typeof modules>
  ) {
    super();
    this.balances = runtime.resolve("Balances");
  }

  public async onTransaction( networkState: NetworkState) {
    const currentGovernancePeriod = (await this.currentGovernancePeriod
      .get())
      .orElse(GovernancePeriod.from(0));

    const currentGovernancePeriodStartedAtBlock = BlockHeight.Safe.fromField(
      (await this.currentGovernancePeriodStartedAtBlock
        .get())
        .orElse(BlockHeight.from(0)).value
    );

    const currentBlockHeight = BlockHeight.Safe.fromField(networkState.block.height.value);

    /**
     * Calculate the number of blocks that have passed since the start
     * of the current governance period.
     */
    const blocksSinceGovernancePeriodStart = currentBlockHeight.sub(
      currentGovernancePeriodStartedAtBlock
    );

    const governancePeriodDuration = UInt64.from(
      this.config.goverancePeriodDurationInBlocks
    );

    // Check if the current governance period should be advanced.
    const shouldAdvanceGovernancePeriod =
      blocksSinceGovernancePeriodStart.equals(governancePeriodDuration);

    const maximumGovernancePeriod = GovernancePeriod.from(
      this.config.maximumGovernancePeriod
    );
    const supposedNextGovernancePeriod = currentGovernancePeriod.add(1);

    // reset the governance period back to 0, if it exceeds the maximum governance period
    const adjustedNextGovernancePeriod = Provable.if(
      supposedNextGovernancePeriod.greaterThan(maximumGovernancePeriod),
      GovernancePeriod.from(0),
      supposedNextGovernancePeriod
    );

    /**
     * If the current governance period should be advanced, set the next
     * governance period to the supposed next governance period. Otherwise,
     * keep the current governance period.
     */
    const nextGovernancePeriod = Provable.if(
      shouldAdvanceGovernancePeriod,
      adjustedNextGovernancePeriod,
      currentGovernancePeriod
    );

    const totalSupply = Balance.Safe.fromField(
      (await this.balances.totalSupply.get(TokenId.from(0n))).value.value
    );

    // update the state with the determined governance period
    await this.currentGovernancePeriod.set(nextGovernancePeriod);
    await this.currentGovernancePeriodStartedAtBlock.set(currentBlockHeight);
    await this.totalSupplySnapshots.set(
      GovernancePeriodId.fromGovernancePeriod(
        currentGovernancePeriodStartedAtBlock,
        currentGovernancePeriod
      ),
      totalSupply
    );
  }
  
  public async beforeTransaction(executionData: BeforeTransactionHookArguments): Promise<void> {
      noop();
  }
  public async afterTransaction(execution: AfterTransactionHookArguments): Promise<void> {
      noop();
  }
}