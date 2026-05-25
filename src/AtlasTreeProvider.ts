import * as vscode from 'vscode';
import * as path from 'path';
import { GraphData, ArchitectureSystem, GraphNode } from './types';

// ─── Tree Item Types ──────────────────────────────────────────────────────────

type TreeItemKind = 'system' | 'folder' | 'file';

class AtlasTreeItem extends vscode.TreeItem {
  constructor(
    public readonly kind: TreeItemKind,
    public readonly label: string,
    public readonly id: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly meta?: {
      systemColor?: string;
      filePath?: string;
      fileNode?: GraphNode;
      systemId?: string;
      folderPath?: string;
      childFiles?: GraphNode[];
    }
  ) {
    super(label, collapsibleState);
    this.id = id;
    this.contextValue = kind;
    this._configure();
  }

  private _configure(): void {
    if (this.kind === 'system') {
      const m = this.meta;
      this.iconPath = new vscode.ThemeIcon('symbol-namespace');
      this.tooltip = `${this.label} — ${m?.childFiles?.length ?? 0} files`;
      this.description = m?.childFiles ? `${m.childFiles.length}` : '';
    } else if (this.kind === 'folder') {
      this.iconPath = vscode.ThemeIcon.Folder;
      this.tooltip = this.meta?.folderPath ?? this.label;
      this.description = this.meta?.childFiles ? `${this.meta.childFiles.length}` : '';
    } else if (this.kind === 'file' && this.meta?.fileNode) {
      const node = this.meta.fileNode;
      this.resourceUri = vscode.Uri.file(node.path);
      this.iconPath = vscode.ThemeIcon.File;
      this.tooltip = node.relativePath;
      this.command = {
        command: 'atlas.tree.openFile',
        title: 'Open File',
        arguments: [node.path],
      };
      const badges: string[] = [];
      if (node.isEntryPoint) badges.push('◆');
      if (node.isDeadCode) badges.push('☠');
      if (node.dependentCount > 0) badges.push(`↑${node.dependentCount}`);
      this.description = badges.join(' ');
    }
  }
}

// ─── Tree Provider ────────────────────────────────────────────────────────────

export class AtlasTreeProvider implements vscode.TreeDataProvider<AtlasTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<AtlasTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _graphData: GraphData | null = null;
  private _nodeMap = new Map<string, GraphNode>();

  public setData(graphData: GraphData | null): void {
    this._graphData = graphData;
    this._nodeMap.clear();
    if (graphData) {
      for (const n of graphData.nodes) this._nodeMap.set(n.id, n);
    }
    this._onDidChangeTreeData.fire();
  }

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  public getTreeItem(element: AtlasTreeItem): vscode.TreeItem {
    return element;
  }

  public async getChildren(element?: AtlasTreeItem): Promise<AtlasTreeItem[]> {
    if (!this._graphData) return [];

    // Root level — list architectural systems
    if (!element) {
      return this._buildSystemNodes(this._graphData.systems);
    }

    // System level — list folders + root files
    if (element.kind === 'system') {
      const systemId = element.meta?.systemId;
      if (!systemId) return [];
      const system = this._graphData.systems.find(s => s.id === systemId);
      if (!system) return [];
      const files = system.files
        .map(fid => this._nodeMap.get(fid))
        .filter((n): n is GraphNode => !!n);
      return this._buildFolderTree(files, systemId, '');
    }

    // Folder level — list files & subfolders
    if (element.kind === 'folder' && element.meta?.childFiles) {
      const systemId = element.meta.systemId ?? '';
      const folderPath = element.meta.folderPath ?? '';
      return this._buildFolderTree(element.meta.childFiles, systemId, folderPath);
    }

    return [];
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  private _buildSystemNodes(systems: ArchitectureSystem[]): AtlasTreeItem[] {
    return systems
      .filter(s => s.files.length > 0)
      .sort((a, b) => b.files.length - a.files.length)
      .map(sys => {
        const files = sys.files
          .map(fid => this._nodeMap.get(fid))
          .filter((n): n is GraphNode => !!n);
        return new AtlasTreeItem(
          'system',
          sys.name,
          `system:${sys.id}`,
          vscode.TreeItemCollapsibleState.Collapsed,
          { systemColor: sys.color, systemId: sys.id, childFiles: files }
        );
      });
  }

  private _buildFolderTree(files: GraphNode[], systemId: string, parentPath: string): AtlasTreeItem[] {
    // Group files by their immediate next folder segment relative to parentPath
    const folderMap = new Map<string, GraphNode[]>();
    const rootFiles: GraphNode[] = [];

    for (const file of files) {
      const rel = parentPath ? file.relativePath.slice(parentPath.length + 1) : file.relativePath;
      const segments = rel.split('/');
      if (segments.length === 1) {
        rootFiles.push(file);
      } else {
        const dir = segments[0];
        if (!folderMap.has(dir)) folderMap.set(dir, []);
        folderMap.get(dir)!.push(file);
      }
    }

    const items: AtlasTreeItem[] = [];

    // Sort folders alphabetically
    const sortedFolders = [...folderMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    for (const [dir, dirFiles] of sortedFolders) {
      const folderPath = parentPath ? `${parentPath}/${dir}` : dir;
      items.push(new AtlasTreeItem(
        'folder',
        dir,
        `folder:${systemId}:${folderPath}`,
        vscode.TreeItemCollapsibleState.Collapsed,
        { systemId, folderPath, childFiles: dirFiles }
      ));
    }

    // Sort root files: entry points first, then by dependent count desc, then alphabetically
    const sortedFiles = rootFiles.sort((a, b) => {
      if (a.isEntryPoint !== b.isEntryPoint) return a.isEntryPoint ? -1 : 1;
      if (b.dependentCount !== a.dependentCount) return b.dependentCount - a.dependentCount;
      return a.label.localeCompare(b.label);
    });
    for (const file of sortedFiles) {
      items.push(new AtlasTreeItem(
        'file',
        file.label,
        `file:${file.id}`,
        vscode.TreeItemCollapsibleState.None,
        { fileNode: file, filePath: file.path }
      ));
    }

    return items;
  }
}
