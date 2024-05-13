// Graph as an adjacency list
export type Graph = Record<string, Record<string, 1>>;

export function prepareGraph(pools: [string, string][]) {
  const graph: Graph = {};
  pools.forEach(([a, b]) => {
    graph[a] ??= {};
    graph[a][b] = 1;

    graph[b] ??= {};
    graph[b][a] = 1;
  });
  return graph;
}

export function dijkstra(
  graph: Graph,
  start: string,
  end: string
): { distance: number; path: string[] } | undefined {
  // Create an object to store the shortest distance from the start node to every other node
  let distances: Record<string, { distance: number; path: string[] }> = {};

  // A set to keep track of all visited nodes
  let visited = new Set();

  // Get all the nodes of the graph
  let nodes = Object.keys(graph);

  // Initially, set the shortest distance to every node as Infinity
  for (let node of nodes) {
    distances[node] = {
      distance: Infinity,
      path: [],
    };
  }

  // The distance from the start node to itself is 0
  distances[start].distance = 0;

  // Loop until all nodes are visited
  while (nodes.length) {
    // Sort nodes by distance and pick the closest unvisited node
    nodes.sort((a, b) => distances[a].distance - distances[b].distance);
    let closestNode = nodes.shift()!;

    // If the shortest distance to the closest node is still Infinity, then remaining nodes are unreachable and we can break
    if (distances[closestNode].distance === Infinity) break;

    // Mark the chosen node as visited
    visited.add(closestNode);

    const pathSoFar = distances[closestNode].path;

    // For each neighboring node of the current node
    for (let neighbor in graph[closestNode]) {
      // If the neighbor hasn't been visited yet
      if (!visited.has(neighbor)) {
        // Calculate tentative distance to the neighboring node
        let newDistance =
          distances[closestNode].distance + graph[closestNode][neighbor];

        // If the newly calculated distance is shorter than the previously known distance to this neighbor
        if (newDistance < distances[neighbor].distance) {
          // Update the shortest distance to this neighbor
          distances[neighbor].distance = newDistance;
          distances[neighbor].path = [...pathSoFar, neighbor];
        }
        // We can do this only because all weights are 1, if they are differently, make it a AStar or put it at the end of the loop
        if (neighbor === end) {
          return distances[neighbor];
        }
      }
    }
  }

  return undefined;
}
