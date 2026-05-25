import { FileNode, DependencyEdge, CircularDependency, GraphData, GraphNode, GraphEdge, RepoStats, ArchitectureSystem } from '../types';

export class DependencyGraph {
  private nodes = new Map<string, FileNode>();
  private edges: DependencyEdge[] = [];
  private adjacencyList = new Map<string, Set<string>>();
  private reverseAdjacencyList = new Map<string, Set<string>>();

  addNode(file: FileNode): void {
    this.nodes.set(file.id, file);
    if (!this.adjacencyList.has(file.id)) {
      this.adjacencyList.set(file.id, new Set());
    }
    if (!this.reverseAdjacencyList.has(file.id)) {
      this.reverseAdjacencyList.set(file.id, new Set());
    }
  }

  addEdge(sourceId: string, targetId: string, type: DependencyEdge['type'] = 'import'): void {
    if (!this.nodes.has(sourceId) || !this.nodes.has(targetId)) return;
    if (sourceId === targetId) return;

    const id = `${sourceId}→${targetId}`;
    const existing = this.edges.find((e) => e.source === sourceId && e.target === targetId);
    if (existing) {
      existing.weight++;
      return;
    }

    this.edges.push({ id, source: sourceId, target: targetId, type, weight: 1 });
    this.adjacencyList.get(sourceId)!.add(targetId);
    this.reverseAdjacencyList.get(targetId)!.add(sourceId);
  }

  buildEdges(): void {
    for (const file of this.nodes.values()) {
      for (const imp of file.imports) {
        if (imp.resolvedPath && this.nodes.has(imp.resolvedPath)) {
          this.addEdge(file.id, imp.resolvedPath, imp.isDynamic ? 'dynamic-import' : 'import');
        }
      }
    }
  }

  detectCircularDependencies(): CircularDependency[] {
    const cycles: CircularDependency[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycleSet = new Set<string>();

    const dfs = (nodeId: string, path: string[]): void => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const neighbors = this.adjacencyList.get(nodeId) ?? new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, [...path]);
        } else if (recursionStack.has(neighbor)) {
          const cycleStart = path.indexOf(neighbor);
          const cycle = path.slice(cycleStart);
          const cycleKey = [...cycle].sort().join('→');
          if (!cycleSet.has(cycleKey)) {
            cycleSet.add(cycleKey);
            cycles.push({
              cycle,
              severity: cycle.length <= 2 ? 'high' : cycle.length <= 4 ? 'medium' : 'low',
            });
          }
        }
      }

      recursionStack.delete(nodeId);
    };

    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId, []);
      }
    }

    return cycles;
  }

  detectDeadCode(): Set<string> {
    const reachable = new Set<string>();

    const entryPoints = [...this.nodes.values()]
      .filter((f) => f.isEntryPoint || this.reverseAdjacencyList.get(f.id)?.size === 0)
      .map((f) => f.id);

    if (entryPoints.length === 0) {
      return new Set();
    }

    const bfs = (start: string): void => {
      const queue = [start];
      while (queue.length > 0) {
        const current = queue.shift()!;
        if (reachable.has(current)) continue;
        reachable.add(current);
        for (const neighbor of this.adjacencyList.get(current) ?? []) {
          if (!reachable.has(neighbor)) queue.push(neighbor);
        }
      }
    };

    for (const ep of entryPoints) bfs(ep);

    const dead = new Set<string>();
    for (const nodeId of this.nodes.keys()) {
      if (!reachable.has(nodeId)) dead.add(nodeId);
    }

    return dead;
  }

  getDependentCount(nodeId: string): number {
    return this.reverseAdjacencyList.get(nodeId)?.size ?? 0;
  }

  getDependencyCount(nodeId: string): number {
    return this.adjacencyList.get(nodeId)?.size ?? 0;
  }

  getNodes(): Map<string, FileNode> {
    return this.nodes;
  }

  getEdges(): DependencyEdge[] {
    return this.edges;
  }

  size(): number {
    return this.nodes.size;
  }

  buildGraphData(systems: ArchitectureSystem[]): GraphData {
    const circularDeps = this.detectCircularDependencies();
    const deadCodeSet = this.detectDeadCode();
    const nodesInCycles = new Set(circularDeps.flatMap((c) => c.cycle));

    const systemMap = new Map<string, ArchitectureSystem>();
    for (const sys of systems) {
      for (const fileId of sys.files) {
        systemMap.set(fileId, sys);
      }
    }

    const defaultSystem: ArchitectureSystem = {
      id: 'unknown',
      name: 'Other',
      type: 'unknown',
      files: [],
      entryPoints: [],
      color: '#64748b',
      metrics: { fileCount: 0, totalImports: 0, totalExports: 0, couplingScore: 0, cohesionScore: 0, hasCircularDeps: false },
    };

    const graphNodes: GraphNode[] = [];
    for (const file of this.nodes.values()) {
      const system = systemMap.get(file.id) ?? defaultSystem;
      const isDead = deadCodeSet.has(file.id);

      if (isDead) file.isDeadCode = true;

      graphNodes.push({
        id: file.id,
        label: file.name,
        path: file.path,
        relativePath: file.relativePath,
        language: file.language,
        systemId: system.id,
        systemColor: system.color,
        isEntryPoint: file.isEntryPoint,
        isDeadCode: isDead,
        importCount: file.imports.length,
        exportCount: file.exports.length,
        dependencyCount: this.getDependencyCount(file.id),
        dependentCount: this.getDependentCount(file.id),
        size: file.size,
      });
    }

    const graphEdges: GraphEdge[] = this.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: e.type,
      weight: e.weight,
    }));

    const langBreakdown: Record<string, number> = {};
    for (const f of this.nodes.values()) {
      langBreakdown[f.language] = (langBreakdown[f.language] ?? 0) + 1;
    }

    const connectionMap = new Map<string, number>();
    for (const n of graphNodes) {
      connectionMap.set(n.id, n.dependencyCount + n.dependentCount);
    }

    const mostConnected = [...connectionMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([p, c]) => ({ path: p, connections: c }));

    const stats: RepoStats = {
      totalFiles: this.nodes.size,
      totalSystems: systems.length,
      totalEdges: this.edges.length,
      circularDepsCount: circularDeps.length,
      deadCodeCount: deadCodeSet.size,
      languageBreakdown: langBreakdown as RepoStats['languageBreakdown'],
      mostConnectedFiles: mostConnected,
    };

    return { nodes: graphNodes, edges: graphEdges, systems, circularDeps, stats };
  }
}
