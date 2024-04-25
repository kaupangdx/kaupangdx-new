import { Balance, Balances, TokenId } from "@proto-kit/library";
import { runtimeModule, state } from "@proto-kit/module";
import {
  RuntimeMethodExecutionContext,
  State,
  StateMap,
  assert,
} from "@proto-kit/protocol";
import { Field, Provable, PublicKey, Struct } from "o1js";
import { container } from "tsyringe";

export class SnapshotId extends Field {}

export class SnapshotKey extends Struct({
  snapshotId: SnapshotId,
  tokenId: TokenId,
  address: PublicKey,
}) {}

export class Snapshot extends Struct({
  balance: Balance,
  previousSnapshotId: SnapshotId,
}) {}

@runtimeModule()
export class BalancesSnapshot extends Balances {
  @state() currentSnapshotId = State.from(SnapshotId);

  @state() snapshots = StateMap.from<SnapshotKey, Snapshot>(
    SnapshotKey,
    Snapshot
  );

  @state() latestAddressSnapshots = StateMap.from<PublicKey, SnapshotId>(
    PublicKey,
    SnapshotId
  );

  public incrementSnapshotId() {
    const currentSnapshotId = this.currentSnapshotId.get().value;
    const newSnapshotId = currentSnapshotId.add(1);
    this.currentSnapshotId.set(newSnapshotId);
  }

  public setBalance(
    // onBalanceChange
    tokenId: TokenId,
    address: PublicKey,
    amount: Balance
  ): void {
    super.setBalance(tokenId, address, amount);

    const currentSnapshotId = this.currentSnapshotId.get().value; // 0 -> 1
    // TODO: store as tokenId, address -> snapshotId
    const latestAddressSnapshot =
      this.latestAddressSnapshots.get(address).value; // 0

    // const context = container.resolve(RuntimeMethodExecutionContext);
    // if (!context.current().isSimulated) {
    //   Provable.log("latestAddressSnapshot", latestAddressSnapshot);
    // }

    Provable.log("latestAddressSnapshot", latestAddressSnapshot);

    const key = new SnapshotKey({
      snapshotId: currentSnapshotId, // 0 -> 1
      tokenId, // 0
      address, // alice
    });

    const snapshot = new Snapshot({
      balance: amount, // 100 -> 200
      previousSnapshotId: latestAddressSnapshot, // 0 -> 0
    });

    this.snapshots.set(key, snapshot);
    this.latestAddressSnapshots.set(address, currentSnapshotId); // alice: 0 -> 1
  }

  public getSnapshotBalance(
    tokenId: TokenId,
    address: PublicKey,
    snapshotId: SnapshotId
  ) {
    // Find the snapshotId that is equal or the next highest one above the given snapshotId
    const nextEqualOrHigherSnapshotId = Provable.witness(SnapshotId, () => {
      const currentSnapshotId = this.currentSnapshotId.get().value;
      for (
        let id = snapshotId.toBigInt();
        id <= currentSnapshotId.toBigInt();
        id++
      ) {
        const key = new SnapshotKey({
          tokenId,
          address,
          snapshotId: SnapshotId.from(id),
        });

        const candidate = this.snapshots.get(key);

        if (candidate.isSome.toBoolean()) {
          return SnapshotId.from(id);
        }
      }

      return SnapshotId.from(0);
    });

    const key = new SnapshotKey({
      tokenId,
      address,
      snapshotId: nextEqualOrHigherSnapshotId,
    });

    const nextEqualOrHigherSnapshot = this.snapshots.get(key).value;
    const isPreviousSnapshotEqualOrHigher =
      nextEqualOrHigherSnapshot.previousSnapshotId.lessThanOrEqual(snapshotId);

    assert(isPreviousSnapshotEqualOrHigher);

    const previousKey = new SnapshotKey({
      tokenId,
      address,
      snapshotId: nextEqualOrHigherSnapshot.previousSnapshotId,
    });

    const previousSnapshot = this.snapshots.get(previousKey).value;
    return previousSnapshot;
  }
}
