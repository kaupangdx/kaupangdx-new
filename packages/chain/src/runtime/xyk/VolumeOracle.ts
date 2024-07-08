import { runtimeModule, RuntimeModule, state } from "@proto-kit/module";
import { TokenId, UInt64 } from "@proto-kit/library";
import { PoolKey } from "./pool-key";
import { Bool, Field, Int64, Provable, PublicKey, Sign, Struct } from "o1js";
import { State, StateMap } from "@proto-kit/protocol";

export class PoolBlockPair extends Struct({
  pool: PoolKey,
  block: UInt64,
}) {}

@runtimeModule()
export class VolumeOracle extends RuntimeModule {
  @state() cumulativeVolume = StateMap.from(PoolBlockPair, UInt64);
  @state() netVolume = StateMap.from<PoolBlockPair, Int64>(
    PoolBlockPair,
    Int64,
  );

  public getAverage(pool: PoolKey, numValues: number = 3) {
    const values: Int64[] = [];
    let currentBlock = new UInt64(this.network.block.height.value);
    for (let i = 0; i < numValues; i++) {
      values.push(this.netVolume.get({ pool, block: currentBlock }).orElse(Int64.zero));

      currentBlock = currentBlock.sub(
          new UInt64(Provable.if(currentBlock.equals(0), Field(0), Field(1))),
      );
    }

    return values.reduce((a, b) => a.add(b)).div(numValues);
  }

  public addVolume(
    pool: PoolKey,
    direction: Bool,
    amountA: UInt64,
  ): {
    cumulativeVolume: UInt64;
    netVolume: Int64;
  } {
    const oracleKey = new PoolBlockPair({
      pool,
      block: UInt64.from(this.network.block.height),
    });

    const volumeBefore = new UInt64(
      this.cumulativeVolume.get(oracleKey).orElse(UInt64.from(0)).value,
    );
    const cumulativeAfter = volumeBefore.add(amountA);
    this.cumulativeVolume.set(oracleKey, cumulativeAfter);

    const netBefore = Int64.from(
      this.netVolume.get(oracleKey).orElse(Int64.from(0)),
    );
    const amountInt = Int64.fromField(amountA.value);
    const netChange = Provable.if(direction, amountInt, amountInt.neg());
    const netAfter = netBefore.add(netChange);
    this.netVolume.set(oracleKey, netAfter);

    return {
      cumulativeVolume: cumulativeAfter,
      netVolume: netAfter,
    };
  }
}
