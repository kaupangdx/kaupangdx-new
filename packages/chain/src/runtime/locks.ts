import { Balance, Balances, TokenId, UInt64 } from "@proto-kit/library";
import {
  RuntimeModule,
  runtimeMethod,
  runtimeModule,
  state,
} from "@proto-kit/module";
import { StateMap, assert } from "@proto-kit/protocol";
import { Field, PublicKey, Struct, Bool } from "o1js";
import { inject } from "tsyringe";

export class LockId extends Field {}

export class LockReason extends Field {
  public static voluntary() {
    return LockReason.from(0);
  }

  public static governance() {
    return LockReason.from(1);
  }
}

export class BlockHeight extends UInt64 {}

export class LockKey extends Struct({
  address: PublicKey,
  tokenId: TokenId,
  lockId: LockId,
}) {}

export class Lock extends Struct({
  reason: LockReason,
  amount: Balance,
  expiresAt: BlockHeight,
  hasBeenUnlocked: Bool,
}) {}

@runtimeModule()
export class Locks extends RuntimeModule {
  @state() public locks = StateMap.from<LockKey, Lock>(LockKey, Lock);

  @state() public lastAddressLockId = StateMap.from<PublicKey, LockId>(
    PublicKey,
    LockId
  );

  public constructor(@inject("Balances") public balances: Balances) {
    super();
  }

  public lock(
    address: PublicKey,
    tokenId: TokenId,
    amount: Balance,
    reason: LockReason,
    expiresAt: BlockHeight
  ) {
    const lastAddressLockId = this.lastAddressLockId.get(address).value;
    const lockId = lastAddressLockId.add(1);
    const key = new LockKey({ address, tokenId, lockId });
    const hasBeenUnlocked = Bool(false);

    const lock = new Lock({
      reason,
      amount,
      expiresAt,
      hasBeenUnlocked,
    });

    assert(
      BlockHeight.from(this.network.block.height).lessThan(expiresAt),
      "Cannot create a lock that expires in the past"
    );

    this.balances.burn(tokenId, address, amount);
    this.locks.set(key, lock);
    this.lastAddressLockId.set(address, lockId);
  }

  public unlock(tokenId: TokenId, address: PublicKey, lockId: LockId) {
    const key = new LockKey({ address, tokenId, lockId });
    const lock = this.locks.get(key);
    const isExpired = BlockHeight.from(
      this.network.block.height
    ).greaterThanOrEqual(lock.value.expiresAt);

    // TODO: extract error messages
    assert(lock.isSome, "Lock not found");
    assert(lock.value.hasBeenUnlocked.not(), "Lock has already been unlocked");
    assert(isExpired, "Lock is not expired yet");

    const hasBeenUnlocked = Bool(true);
    const updatedLock = new Lock({ ...lock.value, hasBeenUnlocked });

    this.locks.set(key, updatedLock);
    this.balances.mint(key.tokenId, key.address, lock.value.amount);
  }

  @runtimeMethod()
  public lockSigned(tokenId: TokenId, amount: Balance, expiresAt: BlockHeight) {
    const address = this.transaction.sender.value;
    const reason = LockReason.voluntary();

    this.lock(address, tokenId, amount, reason, expiresAt);
  }

  @runtimeMethod()
  public unlockSigned(tokenId: TokenId, lockId: LockId) {
    const address = this.transaction.sender.value;
    this.unlock(tokenId, address, lockId);
  }
}
