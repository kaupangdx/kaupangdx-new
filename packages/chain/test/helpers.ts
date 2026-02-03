import { Balance, TokenId } from "@proto-kit/library";
import { PrivateKey, PublicKey } from "o1js";
import { modules } from "../src/runtime";
import { fromRuntime } from "./testing-appchain";

export type KaupangTestingAppChain = ReturnType<
  typeof fromRuntime<typeof modules>
>;
export async function drip(
  appChain: KaupangTestingAppChain,
  senderPrivateKey: PrivateKey,
  tokenId: TokenId,
  amount: Balance,
  options?: { nonce: number }
) {
  const faucet = appChain.runtime.resolve("Faucet");
  appChain.setSigner(senderPrivateKey);

  const tx = await appChain.transaction(
    senderPrivateKey.toPublicKey(),
    async () => {
      await faucet.dripSigned(tokenId, amount);
    },
    options
  );

  await tx.sign();
  await tx.send();

  return tx;
}
