import { TokenId } from "@proto-kit/library";
import {
  runtimeMethod,
  runtimeModule,
  RuntimeModule,
  state,
} from "@proto-kit/module";
import { assert, StateMap } from "@proto-kit/protocol";
import { Bool, PublicKey } from "o1js";

export interface MultiTokenTransactionFeeConfig {
  allowedTokens: TokenId[];
}

@runtimeModule()
export class MultiTokenTransactionFee extends RuntimeModule<MultiTokenTransactionFeeConfig> {
  @state() public feeToken = StateMap.from<PublicKey, TokenId>(
    PublicKey,
    TokenId
  );

  public setFeeToken(address: PublicKey, tokenId: TokenId) {
    let isFeeTokenValid = Bool(false);
    this.config.allowedTokens.forEach((allowedToken) => {
      isFeeTokenValid = isFeeTokenValid.or(tokenId.equals(allowedToken));
    });

    assert(isFeeTokenValid, "Invalid fee token id");

    this.feeToken.set(address, tokenId);
  }

  @runtimeMethod()
  public setFeeTokenSigned(tokenId: TokenId) {
    this.setFeeToken(this.transaction.sender.value, tokenId);
  }
}
