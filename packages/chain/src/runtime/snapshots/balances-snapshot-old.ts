import { runtimeModule, state } from "@proto-kit/module";
import { State, StateMap } from "@proto-kit/protocol";
import { Field, Provable, PublicKey, Struct } from "o1js";
import { UInt64, Balance, Balances } from "@proto-kit/library";

class UserSnapshotKey extends Struct({
  user: PublicKey,
  snapshotId: Field,
}) {}

class UserSnapshotValue extends Struct({
  balance: UInt64,
  previousSnapshotId: Field,
}) {}

@runtimeModule()
export class BalancesSnapshot extends Balances {
  @state() currentSnapshotId = State.from(Field);

  @state() userSnapshots = StateMap.from<UserSnapshotKey, UserSnapshotValue>(
    UserSnapshotKey,
    UserSnapshotValue
  );

  @state() currentHighestUserSnapshot = StateMap.from<PublicKey, Field>(
    PublicKey,
    Field
  );

  // Invoke twice for each transfer, once for mint, etc.
  public onBalanceChange(user: PublicKey, newAmount: Balance) {
    const currentSnapshotId = this.currentSnapshotId.get().orElse(Field(0));

    const currentHighestUserSnapshot = this.currentHighestUserSnapshot
      .get(user)
      .orElse(Field(0));

    this.userSnapshots.set(
      {
        snapshotId: currentSnapshotId,
        user,
      },
      {
        balance: newAmount,
        previousSnapshotId: currentHighestUserSnapshot,
      }
    );

    this.currentHighestUserSnapshot.set(user, currentSnapshotId);
  }

  public lookupSnapshottedBalance(user: PublicKey, snapshotId: Field) {
    // Find the snapshotId that is the next highest one above the given snapshotId
    const nextHighestSnapshotId = Provable.witness(Field, () => {
      const highestSnapshotId = this.currentSnapshotId.get().orElse(Field(0));
      for (
        let id = snapshotId.toBigInt();
        id <= highestSnapshotId.toBigInt();
        id++
      ) {
        // We need to make sure this doesn't create a ST
        const candidate = this.userSnapshots.get({
          user,
          snapshotId: Field(id),
        });
        if (candidate.isSome.toBoolean()) {
          return snapshotId;
        }
      }

      return Field(0);
    });

    const nextHighestSnapshot = this.userSnapshots
      .get({
        user,
        snapshotId: nextHighestSnapshotId,
      })
      .orElse({
        previousSnapshotId: Field(0),
        balance: UInt64.zero,
      });

    // Assert that the point indeed goes to or over our desired snapshotId
    nextHighestSnapshot.previousSnapshotId.assertLessThanOrEqual(snapshotId);

    const previousSnapshot = this.userSnapshots.get({
      user,
      snapshotId: nextHighestSnapshot.previousSnapshotId,
    });

    return previousSnapshot.orElse({
      previousSnapshotId: Field(0),
      balance: UInt64.zero,
    }).balance;
  }
}
