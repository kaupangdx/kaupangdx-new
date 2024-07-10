// @TODO: export TransactionFeeHook from @proto-kit/library
import { Balance, TokenId, UInt64 } from "@proto-kit/library";
import {
  MethodFeeConfigData,
  RuntimeFeeAnalyzerService,
} from "@proto-kit/library/dist/hooks/RuntimeFeeAnalyzerService";
import {
  errors,
  TransactionFeeHook,
} from "@proto-kit/library/dist/hooks/TransactionFeeHook";
import { Runtime } from "@proto-kit/module";
import {
  assert,
  BlockProverExecutionData,
  PublicKeyOption,
} from "@proto-kit/protocol";
import { Field, Provable, PublicKey, Token } from "o1js";
import { inject, injectable } from "tsyringe";
import { MultiTokenTransactionFee } from "../runtime/multi-token-transaction-fee";
import { TokenIdPath, XYK } from "../runtime/xyk/xyk";
import { PoolKey, TokenPair } from "../client.config";

@injectable()
export class MultiTokenTransactionFeeHook extends TransactionFeeHook {
  public get multiTokenTransactionFee(): MultiTokenTransactionFee {
    return this.runtime.dependencyContainer.resolve<MultiTokenTransactionFee>(
      "MultiTokenTransactionFee"
    );
  }

  public get xyk(): XYK {
    return this.runtime.dependencyContainer.resolve<XYK>("XYK");
  }

  public transferMultiTokenFee(tokenId: TokenId, from: PublicKey, fee: UInt64) {
    this.balances.transfer(
      tokenId,
      from,
      PublicKey.fromBase58(this.config.feeRecipient),
      Balance.from(fee.value)
    );
  }

  public onTransaction(executionData: BlockProverExecutionData) {
    const feeConfig = Provable.witness(MethodFeeConfigData, () =>
      this.feeAnalyzer.getFeeConfig(
        executionData.transaction.methodId.toBigInt()
      )
    );

    const witness = Provable.witness(
      RuntimeFeeAnalyzerService.getWitnessType(),
      () =>
        this.feeAnalyzer.getWitness(
          executionData.transaction.methodId.toBigInt()
        )
    );

    const root = Field(this.feeAnalyzer.getRoot());
    const calculatedRoot = witness.calculateRoot(feeConfig.hash());

    root.assertEquals(calculatedRoot, errors.invalidFeeTreeRoot());
    feeConfig.methodId.assertEquals(
      executionData.transaction.methodId,
      errors.invalidFeeConfigMethodId()
    );

    const fee = UInt64.from(feeConfig.baseFee.value).add(
      UInt64.from(feeConfig.weight.value).mul(
        UInt64.from(feeConfig.perWeightUnitFee.value)
      )
    );

    const senderFeeToken = this.multiTokenTransactionFee.feeToken.get(
      executionData.transaction.sender.value
    );

    const tokenPair = TokenPair.from(
      TokenId.from(this.config.tokenId),
      senderFeeToken.value
    );
    const poolKey = PoolKey.fromTokenPair(tokenPair);

    const poolExists = this.xyk.poolExists(poolKey);

    // if the fee token isnt the default, the pool must exist
    assert(
      senderFeeToken.isSome.not().or(senderFeeToken.isSome.and(poolExists)),
      "Invalid fee token id, or pool does not exist for fee token pair"
    );

    const spotPrice = this.xyk.calculateSpotPrice(
      TokenId.from(this.config.tokenId),
      senderFeeToken.value
    );

    const spotPriceIsZero = spotPrice.equals(UInt64.from(0));
    const paddedSpotPrice = UInt64.from(
      Provable.if(spotPriceIsZero, UInt64, UInt64.from(1), spotPrice).value
    );

    const feeInFeeToken = UInt64.from(
      Provable.if(
        spotPriceIsZero,
        UInt64,
        UInt64.from(0),
        fee.div(paddedSpotPrice)
      ).value
    );

    // this needs to be buy, so that we can get exact fee amount for the transaction
    // TODO: implement buy path
    // const path = TokenIdPath.from([TokenId.from(0), TokenId.from(1)]);
    // this.xyk.sellPath(executionData.transaction.sender.value, path, fee, fee);

    /**
     * If default token is used, transfer fee amount in default token
     */
    this.transferMultiTokenFee(
      Provable.if(
        senderFeeToken.isSome,
        senderFeeToken.value,
        TokenId.from(this.config.tokenId)
      ),
      executionData.transaction.sender.value,
      UInt64.from(
        Provable.if<UInt64>(
          senderFeeToken.isSome,
          UInt64,
          UInt64.from(feeInFeeToken),
          UInt64.from(fee.value)
        )
      )
    );
  }
}
