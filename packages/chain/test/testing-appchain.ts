import {
  InMemorySequencerModules,
  VanillaProtocolModules,
  VanillaRuntimeModules,
} from "@proto-kit/library";
import { Runtime, RuntimeModulesRecord } from "@proto-kit/module";
import { Protocol } from "@proto-kit/protocol";
import { BridgingModule, Sequencer, VanillaTaskWorkerModules } from "@proto-kit/sequencer";
import {
  BlockStorageNetworkStateModule,
  InMemoryBlockExplorer,
  InMemorySigner,
  InMemoryTransactionSender,
  PartialVanillaRuntimeModulesRecord,
  StateServiceQueryModule,
  TestingAppChain,
} from "@proto-kit/sdk";
import { PrivateKey } from "o1js";
import { DefaultModules, DefaultConfigs } from "@proto-kit/stack";
import protocol from "../src/protocol";
import { GovernanceLifecycleTransactionHook } from "../src/protocol/governance-life-cycle";

export function fromRuntime<
  RuntimeModules extends RuntimeModulesRecord &
    PartialVanillaRuntimeModulesRecord,
>(runtimeModules: RuntimeModules) {
  const appChain = new TestingAppChain({
    Runtime: Runtime.from(
      VanillaRuntimeModules.with(runtimeModules),
    ),
    Protocol: Protocol.from(
      VanillaProtocolModules.with({
        GovernanceLifecycle: GovernanceLifecycleTransactionHook,
        ...protocol.settlementModules
      }),
    ),
    Sequencer: Sequencer.from({
      ...InMemorySequencerModules.with({}),
      ...DefaultModules.settlement(),
      BridgingModule: BridgingModule,
    }
    ),
      Signer: InMemorySigner,
      TransactionSender: InMemoryTransactionSender,
      QueryTransportModule: StateServiceQueryModule,
      NetworkStateTransportModule: BlockStorageNetworkStateModule,
      BlockExplorerTransportModule: InMemoryBlockExplorer
  });


  appChain.configurePartial({
    Protocol: {
      ...Protocol.defaultConfig(),
      TransactionFee: {
        tokenId: 0n,
        feeRecipient: PrivateKey.random().toPublicKey().toBase58(),
        baseFee: 0n,
        perWeightUnitFee: 0n,
        methods: {},
      },
      GovernanceLifecycle: {
        goverancePeriodDurationInBlocks: 1n,
        maximumGovernancePeriod: 3n,
      },
      ...protocol.settlementModulesConfig
    },
    Sequencer: {
      Database: {},
      BlockTrigger: {},
      Mempool: {},
      BlockProducerModule: {},
      ...DefaultConfigs.settlement({preset:"development"}),
      TaskQueue: {
        simulatedDuration: 0,
      },
      FeeStrategy:{},
      BatchProducerModule: {},
      SequencerStartupModule: {},
      BridgingModule: {}
    },
    BlockExplorerTransportModule:{},
    Signer: {
      signer: PrivateKey.random()                                                                                                                 
    },
    TransactionSender: {},
    QueryTransportModule: {},
    NetworkStateTransportModule: {},
  });


  return appChain;
}