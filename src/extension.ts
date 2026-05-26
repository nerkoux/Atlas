import * as vscode from 'vscode';
import { AtlasSidebarProvider } from './SidebarProvider';
import { AtlasTreeProvider } from './AtlasTreeProvider';

let sidebarProvider: AtlasSidebarProvider | undefined;
let treeProvider: AtlasTreeProvider | undefined;

export function activate(context: vscode.ExtensionContext): void {
  treeProvider = new AtlasTreeProvider();
  sidebarProvider = new AtlasSidebarProvider(context.extensionUri, context, treeProvider);

  // Register the activity-bar webview (Atlas panel)
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      AtlasSidebarProvider.viewType,
      sidebarProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  // Register the native Explorer tree (Ctrl+Shift+E).
  // Use createTreeView (not registerTreeDataProvider) so we can attach a
  // dispose handler and so VS Code knows about the view immediately —
  // registerTreeDataProvider can race with the view container loading and
  // produce "There is no data provider registered" until first refresh.
  const treeView = vscode.window.createTreeView('atlas.explorerView', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('atlas.openExplorer', () => {
      vscode.commands.executeCommand('atlas.sidebarView.focus');
    }),
    vscode.commands.registerCommand('atlas.scanWorkspace', () => sidebarProvider?.scanWorkspace()),
    vscode.commands.registerCommand('atlas.refreshGraph', () => sidebarProvider?.scanWorkspace()),
    vscode.commands.registerCommand('atlas.focusFile', () => sidebarProvider?.focusCurrentFile()),
    vscode.commands.registerCommand('atlas.openGraph', () => sidebarProvider?.openGraphPanel()),
    vscode.commands.registerCommand('atlas.tree.openFile', async (filePath: string) => {
      try {
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
        await vscode.window.showTextDocument(doc, { preview: true });
      } catch {
        vscode.window.showErrorMessage(`Atlas: cannot open ${filePath}`);
      }
    }),
    vscode.commands.registerCommand('atlas.tree.refresh', () => sidebarProvider?.scanWorkspace())
  );

  // Kick off an initial scan as soon as a workspace is open and `autoScan`
  // is enabled — independent of whether the user visits the activity-bar
  // webview first. This guarantees the Explorer tree has data without
  // needing a manual refresh.
  void maybeAutoScan();

  // Re-scan whenever workspace folders change (open / add / remove a folder).
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      void maybeAutoScan();
    })
  );
}

async function maybeAutoScan(): Promise<void> {
  const hasWorkspace = (vscode.workspace.workspaceFolders?.length ?? 0) > 0;
  if (!hasWorkspace) return;
  const config = vscode.workspace.getConfiguration('atlas');
  if (!config.get('autoScan')) return;
  await sidebarProvider?.scanWorkspace();
}

export function deactivate(): void {
  sidebarProvider?.dispose();
}
