import { ClientAppChain } from "@proto-kit/sdk";
import runtime from "./runtime";
import { RuntimeModule, runtimeModule } from "@proto-kit/module";
import { LPTokenId } from "./runtime/xyk/lp-token-id";
import { TokenPair } from "./runtime/xyk/token-pair";
import { PoolKey } from "./runtime/xyk/pool-key";
import { prepareGraph, dijkstra } from "./runtime/xyk/router";
import { TokenIdPath } from "./runtime/xyk/xyk";

@runtimeModule()
export class NoopModule extends RuntimeModule {}

export const modules = {
  ...runtime.modules,
  // TODO: use the actual governance module, after adding gov lifecycle hooks to LocalhostAppChain
  SetDelegateProposal: NoopModule,
};

const appChain = ClientAppChain.fromRuntime(modules);

appChain.configurePartial({
  Runtime: runtime.config,
});

export const client = appChain;
export { LPTokenId, TokenPair, PoolKey, prepareGraph, dijkstra, TokenIdPath };
