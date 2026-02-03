import { Balance, Balances, TokenId, UInt64 } from "@proto-kit/library";
import {
  RuntimeModule,
  runtimeMethod,
  runtimeModule,
} from "@proto-kit/module";
import { StateMap, assert,  state } from "@proto-kit/protocol";
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

  public async lock(
    address: PublicKey,
    tokenId: TokenId,
    amount: Balance,
    reason: LockReason,
    expiresAt: BlockHeight
  ) {
    const lastAddressLockId = await this.lastAddressLockId.get(address);
    const lockId = lastAddressLockId.value.add(1);
    const key = new LockKey({ address, tokenId, lockId });
    const hasBeenUnlocked = Bool(false);

    const lock = new Lock({
      reason,
      amount,
      expiresAt,
      hasBeenUnlocked,
    });

    assert(
      this.network.block.height.value.lessThan(expiresAt.value),
      "Cannot create a lock that expires in the past"
    );

    await this.balances.burn(tokenId, address, amount);
    await this.locks.set(key, lock);
    await this.lastAddressLockId.set(address, lockId);
  }

  public async unlock(tokenId: TokenId, address: PublicKey, lockId: LockId) {
    const key = new LockKey({ address, tokenId, lockId });
    const lock = await this.locks.get(key);
    const isExpired = BlockHeight.Safe.fromField(
      this.network.block.height.value
    ).greaterThanOrEqual(lock.value.expiresAt);

    // TODO: extract error messages
    assert(lock.isSome, "Lock not found");
    assert(lock.value.hasBeenUnlocked.not(), "Lock has already been unlocked");
    assert(isExpired, "Lock is not expired yet");

    const hasBeenUnlocked = Bool(true);
    const updatedLock = new Lock({ ...lock.value, hasBeenUnlocked });

    await this.locks.set(key, updatedLock);
    await this.balances.mint(key.tokenId, key.address, lock.value.amount);
  }

  @runtimeMethod()
  public async lockSigned(tokenId: TokenId, amount: Balance, expiresAt: BlockHeight) {
    const address = this.transaction.sender.value;
    const reason = LockReason.voluntary();

    await this.lock(address, tokenId, amount, reason, expiresAt);
  }

  @runtimeMethod()
  public async unlockSigned(tokenId: TokenId, lockId: LockId) {
    const address = this.transaction.sender.value;
    await this.unlock(tokenId, address, lockId);
  }
}