import {
  AuroSigner,
  ClientAppChain,
  GraphqlBlockExplorerTransportModule,
  GraphqlClient,
  GraphqlNetworkStateTransportModule,
  GraphqlQueryTransportModule,
  GraphqlTransactionSender,
} from "@proto-kit/sdk";
import runtime from "../../runtime";
import { Runtime } from "@proto-kit/module";
import { Protocol } from "@proto-kit/protocol";
import { Sequencer } from "@proto-kit/sequencer";
import { VanillaProtocolModules } from "@proto-kit/library";
import { LPTokenId } from "../../runtime/xyk/lp-token-id";
import { TokenPair } from "../../runtime/xyk/token-pair";
import { PoolKey } from "../../runtime/xyk/pool-key";
import { prepareGraph, dijkstra } from "../../runtime/xyk/router";
import { TokenIdPath } from "../../runtime/xyk/xyk";
import { GovernanceLifecycleTransactionHook } from "../../protocol/governance-life-cycle";

const appChain = ClientAppChain.from({
  Runtime: Runtime.from(runtime.modules),
  Protocol: Protocol.from(VanillaProtocolModules.mandatoryModules({
    GovernanceLifecycle: GovernanceLifecycleTransactionHook,
  })),
  Sequencer: Sequencer.from({}),
  Signer: AuroSigner,
  GraphqlClient,
  QueryTransportModule: GraphqlQueryTransportModule,
  NetworkStateTransportModule: GraphqlNetworkStateTransportModule,
  BlockExplorerTransportModule: GraphqlBlockExplorerTransportModule,
  TransactionSender: GraphqlTransactionSender,
});

appChain.configure({
  Runtime: runtime.config,
  GraphqlClient: {
    url: process.env.NEXT_PUBLIC_PROTOKIT_GRAPHQL_URL!,
  },
  Protocol: {
    ...VanillaProtocolModules.defaultConfig(),
    GovernanceLifecycle: {
      goverancePeriodDurationInBlocks: 100n,
      maximumGovernancePeriod: 3n,
    },
  },
  Signer: {},
  Sequencer: {},
  QueryTransportModule: {},
  NetworkStateTransportModule: {},
  TransactionSender: {},
  BlockExplorerTransportModule: {},
});

export const client = appChain;
export { LPTokenId, TokenPair, PoolKey, TokenIdPath, prepareGraph, dijkstra };
