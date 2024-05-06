import { PrivateKey } from "o1js";
import { fromRuntime } from "../testing-appchain";
import { config, modules } from "../../src/runtime";
import { Balance, TokenId } from "@proto-kit/library";
import { drip } from "../helpers";

describe("governance lifecycle", () => {
  const alicePrivateKey = PrivateKey.random();
  let appChain: ReturnType<typeof fromRuntime<typeof modules>>;

  const tokenId = TokenId.from(0);
  const amount = Balance.from(100);

  async function query() {
    return {
      governanceLifecycle: {
        currentGovernancePeriod:
          await appChain.query.protocol.GovernanceLifecycle.currentGovernancePeriod.get(),
        currentGovernancePeriodStartedAtBlock:
          await appChain.query.protocol.GovernanceLifecycle.currentGovernancePeriodStartedAtBlock.get(),
      },
    };
  }

  describe("transition between governance periods", () => {
    beforeAll(async () => {
      appChain = fromRuntime(modules);

      appChain.configurePartial({
        Runtime: config,
      });

      await appChain.start();
      appChain.setSigner(alicePrivateKey);
    });

    it("should start at governance period 0", async () => {
      const stateBefore = await query();

      // undefined signifies a 0 initially in terms of the governance periods
      expect(
        stateBefore.governanceLifecycle.currentGovernancePeriod?.toString()
      ).toBeUndefined();
      expect(
        stateBefore.governanceLifecycle.currentGovernancePeriodStartedAtBlock?.toString()
      ).toBeUndefined();
    });

    describe("automated transition", () => {
      it.each([
        // formatted as: [currentGovernancePeriod, currentGovernancePeriodStartedAtBlock]
        [0, 0],
        [1, 1],
        [2, 2],
        [3, 3],
        // reset back to period 0, but at block height 4
        [0, 4],
        [1, 5],
        [2, 6],
        [3, 7],
        [0, 8],
      ])(
        "should transition the governance state to period %i at block %j",
        async (
          expectedCurrentGovernancePeriodAfter,
          expectedCurrentGovernancePeriodStartedAtBlockAfter
        ) => {
          await drip(appChain, alicePrivateKey, tokenId, amount);

          await appChain.produceBlock();

          const stateAfter = await query();

          expect(
            stateAfter.governanceLifecycle.currentGovernancePeriod?.toString()
          ).toBe(expectedCurrentGovernancePeriodAfter.toString());

          expect(
            stateAfter.governanceLifecycle.currentGovernancePeriodStartedAtBlock?.toString()
          ).toBe(expectedCurrentGovernancePeriodStartedAtBlockAfter.toString());
        }
      );
    });
  });
});
