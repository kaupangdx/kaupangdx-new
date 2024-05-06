import { RuntimeModule, runtimeModule, state } from "@proto-kit/module";
import { State } from "@proto-kit/protocol";
import { Field } from "o1js";

export class OutgoingMessagesCursor extends Field {}

@runtimeModule()
export class OutgoingMessages extends RuntimeModule {
  @state() public cursor = State.from(OutgoingMessagesCursor);

  public incrementCursor() {
    const currentCursor = this.cursor.get().value;
    const newCursor = currentCursor.add(1);
    this.cursor.set(newCursor);
    return newCursor;
  }
}
