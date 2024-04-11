export interface Edge {
  source: number | string;
  target: number | string;
  weight: number;
}
export interface Graph {
  nodes: (string | number)[];
  edges: Edge[];
  adj: any;
}
export interface Dict {
  [key: string]: string | number;
}
export interface ClusteringStatus {
  node2Community: Dict;
  internals: any;
  degrees: any;
  gdegrees: any;
  loops: any;
  totalWeight: number;
}
export interface ClusterOptions {
  weightFn?: (edge?) => number;
  maxIterations?: number;
  sensitivityThreshold?: number;
}

// Thanks to the original author https://github.com/upphiminn/jLouvain
export class LouvainClustering {
  private maxIterations: number = -1;
  private sensitivityThreshold: number = 0.0000001;
  private original_graph: Graph;
  private edge_index = {};

  //Helpers
  private makeSet(array: (number | string)[]): string[] {
    const set = {};
    array.forEach(function (d) {
      set[d] = true;
    });
    return Object.keys(set);
  }

  private getDegree4Node(graph: Graph, node: string | number) {
    const neighbours = graph.adj[node] ? Object.keys(graph.adj[node]) : [];
    let weight = 0;
    for (let i = 0; i < neighbours.length; i++) {
      let value = graph.adj[node][neighbours[i]] || 1;
      if (node === neighbours[i]) {
        value *= 2;
      }
      weight += value;
    }
    return weight;
  }

  private getNeighboursOfNode(graph: Graph, node: string | number) {
    if (typeof graph.adj[node] === "undefined") {
      return [];
    }
    return Object.keys(graph.adj[node]);
  }

  private getEdgeWeight(
    graph: Graph,
    node1: string | number,
    node2: string | number
  ) {
    return graph.adj[node1] ? graph.adj[node1][node2] : undefined;
  }

  private getTotalWeight(graph: Graph) {
    let size = 0;
    graph.edges.forEach(function (edge) {
      size += edge.weight;
    });
    return size;
  }

  private addEdge2Graph(graph: Graph, edge: Edge) {
    this.updateAdj(graph, edge);
    if (this.edge_index[edge.source + "_" + edge.target]) {
      graph.edges[this.edge_index[edge.source + "_" + edge.target]].weight =
        edge.weight;
    } else {
      graph.edges.push(edge);
      this.edge_index[edge.source + "_" + edge.target] = graph.edges.length - 1;
    }
  }

  private makeAdj(edge_list: any) {
    const adj = {};
    edge_list.forEach(function (edge: any) {
      adj[edge.source] = adj[edge.source] || {};
      adj[edge.source][edge.target] = edge.weight;
      adj[edge.target] = adj[edge.target] || {};
      adj[edge.target][edge.source] = edge.weight;
    });
    return adj;
  }

  private updateAdj(graph: Graph, edge: Edge) {
    graph.adj[edge.source] = graph.adj[edge.source] || {};
    graph.adj[edge.source][edge.target] = edge.weight;
    graph.adj[edge.target] = graph.adj[edge.target] || {};
    graph.adj[edge.target][edge.source] = edge.weight;
  }

  private clone(object: any) {
    if (object === null || typeof object !== "object") {
      return object;
    }
    let temp = object.constructor();
    for (let key in object) {
      temp[key] = this.clone(object[key]);
    }
    return temp;
  }

  //Core-Algorithm Related
  private initStatus(graph: Graph, status: ClusteringStatus, part) {
    status.node2Community = {};
    status.internals = {};
    status.degrees = {};
    status.gdegrees = {};
    status.loops = {};
    status.totalWeight = this.getTotalWeight(graph);

    if (typeof part === "undefined") {
      graph.nodes.forEach((node, i) => {
        status.node2Community[node] = i;

        let deg = this.getDegree4Node(graph, node);

        if (deg < 0) {
          throw new TypeError("Graph should only have positive weights.");
        }

        status.degrees[i] = deg;
        status.gdegrees[node] = deg;
        status.loops[node] = this.getEdgeWeight(graph, node, node) || 0;
        status.internals[i] = status.loops[node];
      });
    } else {
      graph.nodes.forEach((node) => {
        const com = part[node];
        status.node2Community[node] = com;
        const deg = this.getDegree4Node(graph, node);
        status.degrees[com] = (status.degrees[com] || 0) + deg;
        status.gdegrees[node] = deg;
        let inc = 0.0;
        let neighbours = this.getNeighboursOfNode(graph, node);

        neighbours.forEach(function (neighbour) {
          const weight = graph.adj[node][neighbour];

          if (weight <= 0) {
            throw new TypeError("Graph should only have positive weights.");
          }

          if (part[neighbour] === com) {
            if (neighbour === node) {
              inc += weight;
            } else {
              inc += weight / 2.0;
            }
          }
        });

        status.internals[com] = (status.internals[com] || 0) + inc;
      });
    }
  }

  private modularity(status: ClusteringStatus): number {
    const links = status.totalWeight;
    let result = 0.0;
    const communities = this.makeSet(Object.values(status.node2Community));

    communities.forEach(function (com) {
      const in_degree = status.internals[com] || 0;
      const degree = status.degrees[com] || 0;
      if (links > 0) {
        result =
          result + in_degree / links - Math.pow(degree / (2.0 * links), 2);
      }
    });

    return result;
  }

  private neighcom(
    node: string | number,
    graph: Graph,
    status: ClusteringStatus
  ) {
    // compute the communities in the neighb. of the node, with the graph given by
    // node2Community
    const weights = {};
    const neighboorhood = this.getNeighboursOfNode(graph, node); //make iterable;

    neighboorhood.forEach(function (neighbour) {
      if (neighbour !== node) {
        const weight = graph.adj[node][neighbour] || 1;
        const neighbourcom = status.node2Community[neighbour];
        weights[neighbourcom] = (weights[neighbourcom] || 0) + weight;
      }
    });

    return weights;
  }

  private insert2Community(
    node: any,
    com: any,
    weight: any,
    status: ClusteringStatus
  ) {
    // insert node into com and modify status
    status.node2Community[node] = +com;
    status.degrees[com] =
      (status.degrees[com] || 0) + (status.gdegrees[node] || 0);
    status.internals[com] =
      (status.internals[com] || 0) + weight + (status.loops[node] || 0);
  }

  private removeFromCommunity(
    node: any,
    com: any,
    weight: any,
    status: ClusteringStatus
  ) {
    //remove node from com and modify status
    status.degrees[com] =
      (status.degrees[com] || 0) - (status.gdegrees[node] || 0);
    status.internals[com] =
      (status.internals[com] || 0) - weight - (status.loops[node] || 0);
    status.node2Community[node] = -1;
  }

  private renumber(dict: Dict): Dict {
    let count = 0;
    const ret: Dict = this.clone(dict); //deep copy :)
    const new_values = {};
    const dict_keys = Object.keys(dict);

    dict_keys.forEach(function (key) {
      const value = dict[key];
      let new_value =
        typeof new_values[value] === "undefined" ? -1 : new_values[value];
      if (new_value === -1) {
        new_values[value] = count;
        new_value = count;
        count = count + 1;
      }
      ret[key] = new_value;
    });

    return ret;
  }

  private oneLevel(graph: Graph, status: ClusteringStatus) {
    //Compute one level of the Communities Dendogram.
    let modif = true;
    let nbPassDone = 0;
    let currMod = this.modularity(status);
    let newMod = currMod;

    while (modif && nbPassDone !== this.maxIterations) {
      currMod = newMod;
      modif = false;
      nbPassDone += 1;

      graph.nodes.forEach((node, i) => {
        let comNode = status.node2Community[node];
        let degcTotw =
          (status.gdegrees[node] || 0) / (status.totalWeight * 2.0);
        let neighCommunities = this.neighcom(node, graph, status);
        this.removeFromCommunity(
          node,
          comNode,
          neighCommunities[comNode] || 0.0,
          status
        );
        let bestCom = comNode;
        let bestIncrease = 0;
        const neighCommunitiesEntries = Object.keys(neighCommunities); // make iterable;

        neighCommunitiesEntries.forEach(function (com) {
          const incr =
            neighCommunities[com] - (status.degrees[com] || 0.0) * degcTotw;

          if (incr > bestIncrease) {
            bestIncrease = incr;
            bestCom = com;
          }
        });

        this.insert2Community(
          node,
          bestCom,
          neighCommunities[bestCom] || 0,
          status
        );

        // convert from string to number
        if (+bestCom !== comNode) {
          modif = true;
        }
      });

      newMod = this.modularity(status);

      if (newMod - currMod < this.sensitivityThreshold) {
        break;
      }
    }
  }

  // Produce the graph where nodes are the communities
  private inducedGraph(partition: any, graph: Graph): Graph {
    const ret: Graph = { nodes: [], edges: [], adj: {} };
    // add nodes from partition values
    const partitionValues = Object.values(partition) as string[];
    ret.nodes = ret.nodes.concat(this.makeSet(partitionValues)); // make set

    let wPrec: any;
    let weight: any;
    graph.edges.forEach((edge, i) => {
      weight = edge.weight || 1;
      const com1 = partition[edge.source];
      const com2 = partition[edge.target];
      wPrec = this.getEdgeWeight(ret, com1, com2) || 0;
      const newWeight = wPrec + weight;
      this.addEdge2Graph(ret, {
        source: com1,
        target: com2,
        weight: newWeight,
      });
    });

    this.edge_index = {};

    return ret;
  }

  private partitionAtLevel(dendogram: Dict[], level: number) {
    const partition = this.clone(dendogram[0]);

    for (let i = 1; i < level + 1; i++) {
      Object.keys(partition).forEach(function (key, j) {
        let node = key;
        let com = partition[key];
        partition[node] = dendogram[i][com];
      });
    }

    return partition;
  }

  private generateDendogram(graph: Graph, part_init): Dict[] {
    if (graph.edges.length === 0) {
      const part: Dict = {};
      graph.nodes.forEach(function (node) {
        part[node] = node;
      });
      return [part];
    }

    const status: ClusteringStatus = {
      totalWeight: 0,
      gdegrees: {},
      degrees: {},
      internals: {},
      node2Community: {},
      loops: {},
    };

    this.initStatus(this.original_graph, status, part_init);
    let mod = this.modularity(status);
    const status_list: Dict[] = [];
    this.oneLevel(this.original_graph, status);
    let new_mod = this.modularity(status);
    let partition = this.renumber(status.node2Community);
    status_list.push(partition);
    mod = new_mod;
    let current_graph = this.inducedGraph(partition, this.original_graph);
    this.initStatus(current_graph, status, undefined);

    while (true) {
      this.oneLevel(current_graph, status);
      new_mod = this.modularity(status);
      if (new_mod - mod < this.sensitivityThreshold) {
        break;
      }

      partition = this.renumber(status.node2Community);
      status_list.push(partition);

      mod = new_mod;
      current_graph = this.inducedGraph(partition, current_graph);
      this.initStatus(current_graph, status, undefined);
    }

    return status_list;
  }

  /**
   * @param  {} elements is a cytoscape.js collection https://js.cytoscape.org/#cy.collection
   */
  cluster(elements: any, options: ClusterOptions = null) {
    let weightFn = (x: any) => {
      return 1;
    };
    if (options) {
      if (options.maxIterations) {
        this.maxIterations = options.maxIterations;
      }
      if (options.sensitivityThreshold) {
        this.sensitivityThreshold = options.sensitivityThreshold;
      }
      if (options.weightFn) {
        weightFn = options.weightFn;
      }
    }
    const nodes = elements.filter("node").map((x: any) => x.id());
    const edges = elements.filter("edge").map((x: any) => {
      return {
        source: x.source().id(),
        target: x.target().id(),
        weight: weightFn(x),
      };
    });
    let graph: Graph = { nodes: nodes, edges: edges, adj: this.makeAdj(edges) };
    this.original_graph = graph;
    const dendogram = this.generateDendogram(graph, undefined);
    return this.partitionAtLevel(dendogram, dendogram.length - 1);
  }
}
