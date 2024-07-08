import { runtimeModule, RuntimeModule, state } from "@proto-kit/module";
import { TokenId, UInt64 } from "@proto-kit/library";
import { PoolKey } from "./pool-key";
import { Bool, Field, Int64, Provable, PublicKey, Sign } from "o1js";
import { StateMap } from "@proto-kit/protocol";

@runtimeModule()
export class VolumeOracle extends RuntimeModule {
    @state() cumulativeVolume = StateMap.from(PoolKey, UInt64);
    @state() netVolume = StateMap.from<PoolKey, Int64>(PoolKey, Int64);

    public addVolume(pool: PoolKey, direction: Bool, amountA: UInt64): {
        cumulativeVolume: UInt64,
        netVolume: Int64
    } {
        const volumeBefore = new UInt64(
            this.cumulativeVolume.get(pool).orElse(UInt64.from(0)).value);
        const cumulativeAfter = volumeBefore.add(amountA)
        this.cumulativeVolume.set(pool, cumulativeAfter);

        const netBefore = Int64.from(this.netVolume.get(pool).orElse(Int64.from(0)));
        const amountInt = Int64.fromField(amountA.value);
        const netChange = Provable.if(direction, amountInt, amountInt.neg());
        const netAfter = netBefore.add(netChange)
        this.netVolume.set(pool, netAfter);

        return {
            cumulativeVolume: cumulativeAfter,
            netVolume: netAfter
        }
    }
}