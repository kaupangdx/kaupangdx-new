import { LocalhostAppChain } from "@proto-kit/cli";
import runtime from "./runtime";
import { SetDelegateProposal } from "./runtime/governance/set-delegate-proposal";
import { RuntimeModule, runtimeModule } from "@proto-kit/module";

@runtimeModule()
export class NoopModule extends RuntimeModule {}

export const modules = {
  ...runtime.modules,
  // TODO: use the actual governance module, after adding gov lifecycle hooks to LocalhostAppChain
  SetDelegateProposal: NoopModule,
};
const appChain = LocalhostAppChain.fromRuntime(modules);

appChain.configure({
  ...appChain.config,
  Runtime: runtime.config,
});

// TODO: remove temporary `as any` once `error TS2742` is resolved
export default appChain as any;
