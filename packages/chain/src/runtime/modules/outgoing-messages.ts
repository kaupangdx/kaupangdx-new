import { RuntimeModule, runtimeModule } from "@proto-kit/module";
import { State, state } from "@proto-kit/protocol";
import { Field } from "o1js";

export class OutgoingMessagesCursor extends Field {}

@runtimeModule()
export class OutgoingMessages extends RuntimeModule {
  @state() public cursor = State.from(OutgoingMessagesCursor);

  public async incrementCursor() {
    const currentCursor = await this.cursor.get();
    const newCursor = currentCursor.value.add(1);

    await this.cursor.set(newCursor);
    return newCursor;
  }
}