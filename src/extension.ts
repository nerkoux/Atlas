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

  // Register the native Explorer tree (Ctrl+Shift+E)
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('atlas.explorerView', treeProvider)
  );

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
}

export function deactivate(): void {
  sidebarProvider?.dispose();
}
