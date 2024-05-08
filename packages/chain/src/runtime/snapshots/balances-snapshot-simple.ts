import { Balance, Balances, TokenId } from "@proto-kit/library";
import { runtimeModule, state } from "@proto-kit/module";
import {
  RuntimeMethodExecutionContext,
  State,
  StateMap,
  assert,
} from "@proto-kit/protocol";
import { Field, Provable, PublicKey, Struct } from "o1js";

export class SnapshotId extends Field {}

export class SnapshotKey extends Struct({
  snapshotId: SnapshotId,
  tokenId: TokenId,
  address: PublicKey,
}) {}

export class Snapshot extends Balance {}

export class LatestAddressSnapshotIdKey extends Struct({
  tokenId: TokenId,
  address: PublicKey,
}) {}

export const historicalSnapshotIterations = 4;

@runtimeModule()
export class BalancesSnapshot extends Balances {
  @state() currentSnapshotId = State.from(SnapshotId);

  @state() snapshots = StateMap.from<SnapshotKey, Snapshot>(
    SnapshotKey,
    Snapshot
  );

  @state() latestAddressSnapshotId = StateMap.from<
    LatestAddressSnapshotIdKey,
    SnapshotId
  >(LatestAddressSnapshotIdKey, SnapshotId);

  public incrementSnapshotId() {
    const currentSnapshotId = this.currentSnapshotId.get().value;
    const newSnapshotId = currentSnapshotId.add(1);
    this.currentSnapshotId.set(newSnapshotId);
  }

  public setBalance(
    tokenId: TokenId,
    address: PublicKey,
    amount: Balance
  ): void {
    super.setBalance(tokenId, address, amount);

    const currentSnapshotId = this.currentSnapshotId.get().value;

    const key = new SnapshotKey({
      snapshotId: currentSnapshotId,
      tokenId,
      address,
    });

    const snapshot = Snapshot.from(amount);

    this.snapshots.set(key, snapshot);

    const latestAddressSnapshotKey = new LatestAddressSnapshotIdKey({
      tokenId,
      address,
    });

    this.latestAddressSnapshotId.set(
      latestAddressSnapshotKey,
      currentSnapshotId
    );
  }

  public getBalanceAt(
    snapshotId: SnapshotId,
    tokenId: TokenId,
    address: PublicKey
  ) {
    const latestAddressSnapshotKey = new LatestAddressSnapshotIdKey({
      tokenId,
      address,
    });
    const latestAddressSnapshotId = this.latestAddressSnapshotId.get(
      latestAddressSnapshotKey
    ).value;

    const latestSnapshotKey = new SnapshotKey({
      snapshotId: latestAddressSnapshotId,
      tokenId,
      address,
    });

    const latestSnapshot = this.snapshots.get(latestSnapshotKey);

    const exactSnapshotKey = new SnapshotKey({
      snapshotId,
      tokenId,
      address,
    });

    // return exactSnapshot ?? latestSnapshot.snapshotId < snapshotId ? latestSnapshot : (try past 3 snapshots from exact snapshot)
  }
}
