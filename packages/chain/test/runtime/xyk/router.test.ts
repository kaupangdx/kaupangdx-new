import { prepareGraph, dijkstra } from "./../../../src/runtime/xyk/router";
describe("router", () => {
  it("should find a path", () => {
    const graph = prepareGraph([
      ["MINA", "DAI"],
      ["DAI", "BTC"],
    ]);
    const distance = dijkstra(graph, "MINA", "DAI");
    console.log(distance);
  });
});
