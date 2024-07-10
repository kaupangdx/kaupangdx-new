import {
  InMemorySequencerModules,
  TokenId,
  VanillaProtocolModules,
  VanillaRuntimeModules,
} from "@proto-kit/library";
import { Runtime, RuntimeModulesRecord } from "@proto-kit/module";
import { Protocol } from "@proto-kit/protocol";
import { Sequencer } from "@proto-kit/sequencer";
import {
  BlockStorageNetworkStateModule,
  InMemorySigner,
  InMemoryTransactionSender,
  PartialVanillaRuntimeModulesRecord,
  StateServiceQueryModule,
  TestingAppChain,
} from "@proto-kit/sdk";
import { PrivateKey } from "o1js";

import { GovernanceLifecycleTransactionHook } from "../src/protocol/governance-lifecycle";
import { MultiTokenTransactionFeeHook } from "../src/protocol/multi-token-transaction-fee-hook";
import { TransactionFeeHook } from "@proto-kit/library/dist/hooks/TransactionFeeHook";

export const feeTokenId = TokenId.from(0);

export function fromRuntime<
  RuntimeModules extends RuntimeModulesRecord &
    PartialVanillaRuntimeModulesRecord,
>(runtimeModules: RuntimeModules) {
  const appChain = new TestingAppChain({
    Runtime: Runtime.from({
      modules: VanillaRuntimeModules.with(runtimeModules),
    }),
    Protocol: Protocol.from({
      modules: VanillaProtocolModules.with({
        GovernanceLifecycle: GovernanceLifecycleTransactionHook,
        TransactionFee: MultiTokenTransactionFeeHook,
      }),
    }),
    Sequencer: Sequencer.from({
      modules: InMemorySequencerModules.with({}),
    }),
    modules: {
      Signer: InMemorySigner,
      TransactionSender: InMemoryTransactionSender,
      QueryTransportModule: StateServiceQueryModule,
      NetworkStateTransportModule: BlockStorageNetworkStateModule,
    },
  });

  appChain.configurePartial({
    Protocol: {
      AccountState: {},
      BlockProver: {},
      StateTransitionProver: {},
      BlockHeight: {},
      LastStateRoot: {},
      TransactionFee: {
        tokenId: feeTokenId.toBigInt(),
        feeRecipient: PrivateKey.random().toPublicKey().toBase58(),
        baseFee: 0n,
        perWeightUnitFee: 0n,
        methods: {
          "Faucet.dripSigned": {
            baseFee: 0n,
            weight: 0n,
            perWeightUnitFee: 0n,
          },
          "Balances.transferSigned": {
            weight: 100n,
            perWeightUnitFee: 1n,
          },
        },
      },
      GovernanceLifecycle: {
        goverancePeriodDurationInBlocks: 1n,
        maximumGovernancePeriod: 3n,
      },
    },
    Sequencer: {
      Database: {},
      BlockTrigger: {},
      Mempool: {},
      BlockProducerModule: {},
      LocalTaskWorkerModule: {
        StateTransitionTask: {},
        RuntimeProvingTask: {},
        StateTransitionReductionTask: {},
        BlockReductionTask: {},
        BlockProvingTask: {},
        BlockBuildingTask: {},
      },
      BaseLayer: {},
      UnprovenProducerModule: {},
      TaskQueue: {
        simulatedDuration: 0,
      },
      // TODO: this is commented out in "framework", why is it part of the modules here?
      SettlementModule: {
        feepayer: PrivateKey.random(),
      },
    },
    Signer: {
      signer: PrivateKey.random(),
    },
    TransactionSender: {},
    QueryTransportModule: {},
    NetworkStateTransportModule: {},
  });

  return appChain;
}
