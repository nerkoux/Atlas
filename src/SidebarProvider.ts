import * as vscode from 'vscode';
import * as path from 'path';
import { MessageToWebview, MessageFromWebview, GraphData } from './types';
import { scanWorkspace } from './engine/scanner';
import { AtlasGraphPanel } from './GraphPanelProvider';
import { AtlasTreeProvider } from './AtlasTreeProvider';

export class AtlasSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'atlas.sidebarView';

  private _view?: vscode.WebviewView;
  private _graphData: GraphData | null = null;
  private _isScanning = false;
  private _fileWatcher?: vscode.FileSystemWatcher;
  private _debounceTimer?: NodeJS.Timeout;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext,
    private readonly _treeProvider?: AtlasTreeProvider
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._buildHtml(webviewView.webview);
    this._registerMessageHandler(webviewView);
    this._setupFileWatcher();
    this._setupWorkspaceListener();
  }

  // ─── Public API ───────────────────────────────────────────────────────────────

  public async scanWorkspace(): Promise<void> {
    const workspaceRoot = this._getWorkspaceRoot();
    if (!workspaceRoot || this._isScanning) return;

    this._isScanning = true;

    try {
      const graphData = await scanWorkspace(workspaceRoot, (progress) => {
        this._post({ type: 'progress', data: progress });
      });

      this._graphData = graphData;
      this._post({ type: 'graphData', data: graphData });
      AtlasGraphPanel.currentPanel?.update(graphData);
      this._treeProvider?.setData(graphData);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this._post({ type: 'error', message: msg });
      vscode.window.showErrorMessage(`Atlas scan failed: ${msg}`);
    } finally {
      this._isScanning = false;
    }
  }

  public openGraphPanel(): void {
    if (!this._graphData) {
      vscode.window.showInformationMessage('Atlas: Scan workspace first to open the graph.');
      return;
    }
    AtlasGraphPanel.createOrShow(
      this._extensionUri,
      this._graphData,
      (fp, ln) => this._openFile(fp, ln)
    );
  }

  public focusCurrentFile(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !this._view) return;

    const workspaceRoot = this._getWorkspaceRoot();
    if (!workspaceRoot) return;

    const relativePath = path.relative(workspaceRoot, editor.document.fileName).replace(/\\/g, '/');
    this._post({ type: 'focusNode', nodeId: relativePath });
    this._view.show(true);
  }

  public dispose(): void {
    this._fileWatcher?.dispose();
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
  }

  // ─── Private ──────────────────────────────────────────────────────────────────

  private _registerMessageHandler(webviewView: vscode.WebviewView): void {
    webviewView.webview.onDidReceiveMessage(async (message: MessageFromWebview) => {
      switch (message.type) {
        case 'ready':
          this._sendWorkspaceInfo();
          if (this._graphData) {
            this._post({ type: 'graphData', data: this._graphData });
          } else {
            const hasWorkspace = (vscode.workspace.workspaceFolders?.length ?? 0) > 0;
            const config = vscode.workspace.getConfiguration('atlas');
            if (hasWorkspace && config.get('autoScan')) {
              await this.scanWorkspace();
            }
          }
          break;

        case 'scan':
          await this.scanWorkspace();
          break;

        case 'openFile':
          await this._openFile(message.path, message.line);
          break;

        case 'focusSystem':
          if (message.systemId === '__open_graph__') {
            this.openGraphPanel();
          } else if (this._graphData) {
            AtlasGraphPanel.createOrShow(
              this._extensionUri,
              this._graphData,
              (fp, ln) => this._openFile(fp, ln),
              message.systemId
            );
          }
          break;

        case 'requestStats':
          if (this._graphData) {
            this._post({ type: 'graphData', data: this._graphData });
          }
          break;
      }
    });
  }

  private _setupFileWatcher(): void {
    const workspaceRoot = this._getWorkspaceRoot();
    if (!workspaceRoot) return;

    this._fileWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(workspaceRoot, '**/*.{ts,tsx,js,jsx,py,go,rs,java,cs}'),
      false, false, false
    );

    const onFileChange = () => {
      if (this._debounceTimer) clearTimeout(this._debounceTimer);
      this._debounceTimer = setTimeout(() => {
        if (this._graphData && !this._isScanning) {
          this.scanWorkspace();
        }
      }, 3000);
    };

    this._fileWatcher.onDidChange(onFileChange);
    this._fileWatcher.onDidCreate(onFileChange);
    this._fileWatcher.onDidDelete(onFileChange);
    this._context.subscriptions.push(this._fileWatcher);
  }

  private _setupWorkspaceListener(): void {
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      this._sendWorkspaceInfo();
      const hasWorkspace = (vscode.workspace.workspaceFolders?.length ?? 0) > 0;
      const config = vscode.workspace.getConfiguration('atlas');
      if (hasWorkspace && config.get('autoScan') && !this._isScanning) {
        this.scanWorkspace();
      }
    }, undefined, this._context.subscriptions);
  }

  private _sendWorkspaceInfo(): void {
    const workspaceRoot = this._getWorkspaceRoot();
    const name = vscode.workspace.workspaceFolders?.[0]?.name ?? 'Workspace';
    this._post({ type: 'workspaceInfo', name, path: workspaceRoot ?? '' });
  }

  private async _openFile(filePath: string, line?: number): Promise<void> {
    try {
      const uri = vscode.Uri.file(filePath);
      const doc = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(doc, { preview: false });

      if (line !== undefined && line > 0) {
        const position = new vscode.Position(line - 1, 0);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
      }
    } catch {
      vscode.window.showErrorMessage(`Atlas: Cannot open file: ${filePath}`);
    }
  }

  private _getWorkspaceRoot(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }

  private _post(message: MessageToWebview): void {
    this._view?.webview.postMessage(message);
  }

  private _buildHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview.js')
    );
    const logoUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'resources', 'atlaslogo.svg')
    );
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>Atlas</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #root { width: 100%; height: 100%; overflow: hidden; background: transparent; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    input::placeholder { color: var(--vscode-input-placeholderForeground); }
    button:focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: -1px; }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-thumb { background: var(--vscode-scrollbarSlider-background); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--vscode-scrollbarSlider-hoverBackground); }
  </style>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}">window.__ATLAS_LOGO__ = ${JSON.stringify(logoUri.toString())};</script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
