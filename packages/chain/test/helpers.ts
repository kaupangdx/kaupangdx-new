import { Balance, TokenId } from "@proto-kit/library";
import { PrivateKey, PublicKey } from "o1js";
import { modules } from "../src/runtime";
import { TestingAppChain } from "@proto-kit/sdk";

export type KaupangTestingAppChain = ReturnType<
  typeof TestingAppChain.fromRuntime<typeof modules>
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
    () => {
      faucet.dripSigned(tokenId, amount);
    },
    options
  );

  await tx.sign();
  await tx.send();

  return tx;
}

export async function incrementSnapshotId(
  // this should be based on `testModules` rather than `modules`, since `modules` does
  // not contain a runtimeMethod annotated `incrementSnapshotId` method
  appChain: KaupangTestingAppChain,
  senderPrivateKey: PrivateKey,
  options?: { nonce: number }
) {
  const balances = appChain.runtime.resolve("Balances");

  appChain.setSigner(senderPrivateKey);

  const tx = await appChain.transaction(
    senderPrivateKey.toPublicKey(),
    () => {
      balances.incrementSnapshotId();
    },
    options
  );

  await tx.sign();
  await tx.send();

  return tx;
}
