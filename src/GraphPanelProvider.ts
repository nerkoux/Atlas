import * as vscode from 'vscode';
import { GraphData, MessageToWebview, MessageFromWebview } from './types';

export class AtlasGraphPanel {
  public static currentPanel: AtlasGraphPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _onOpenFile: (path: string, line?: number) => void;

  public static createOrShow(
    extensionUri: vscode.Uri,
    graphData: GraphData,
    onOpenFile: (path: string, line?: number) => void,
    focusSystemId?: string
  ): AtlasGraphPanel {
    const column = vscode.ViewColumn.One;

    if (AtlasGraphPanel.currentPanel) {
      AtlasGraphPanel.currentPanel._panel.reveal(column);
      AtlasGraphPanel.currentPanel.update(graphData, focusSystemId);
      return AtlasGraphPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'atlas.graphView',
      'Atlas — Architecture Graph',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      }
    );

    const instance = new AtlasGraphPanel(panel, extensionUri, graphData, onOpenFile);
    AtlasGraphPanel.currentPanel = instance;
    return instance;
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    graphData: GraphData,
    onOpenFile: (path: string, line?: number) => void
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._onOpenFile = onOpenFile;

    this._panel.webview.html = this._buildHtml(this._panel.webview);
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      async (message: MessageFromWebview) => {
        if (message.type === 'openFile') {
          await this._onOpenFile(message.path, message.line);
        }
      },
      null,
      this._disposables
    );

    // Send data after webview initializes
    setTimeout(() => {
      this._post({ type: 'graphData', data: graphData });
    }, 300);
  }

  public update(graphData: GraphData, focusSystemId?: string): void {
    this._post({ type: 'graphData', data: graphData });
  }

  public focusNode(nodeId: string): void {
    this._post({ type: 'focusNode', nodeId });
  }

  public dispose(): void {
    AtlasGraphPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      this._disposables.pop()?.dispose();
    }
  }

  private _post(message: MessageToWebview): void {
    this._panel.webview.postMessage(message);
  }

  private _buildHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'graph-panel.js')
    );
    const cytoscapeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'cytoscape.min.js')
    );
    const dagreUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'dagre.min.js')
    );
    const cytoscapeDagreUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'cytoscape-dagre.min.js')
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
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}' 'unsafe-eval';">
  <title>Atlas Graph</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #root { width: 100%; height: 100%; overflow: hidden; background: var(--vscode-editor-background); color: var(--vscode-foreground); }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    button { font-family: var(--vscode-font-family); }
    button:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: 1px; }
    button:hover:not(:disabled) { background: var(--vscode-toolbar-hoverBackground, rgba(127,127,127,0.1)); }
    /* Override hover for explicitly-styled active buttons */
    button[aria-pressed="true"]:hover { opacity: 0.92; }
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-thumb { background: var(--vscode-scrollbarSlider-background); border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--vscode-scrollbarSlider-hoverBackground); }
    ::-webkit-scrollbar-thumb:active { background: var(--vscode-scrollbarSlider-activeBackground); }
  </style>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}">window.__ATLAS_LOGO__ = ${JSON.stringify(logoUri.toString())};</script>
  <script nonce="${nonce}" src="${cytoscapeUri}"></script>
  <script nonce="${nonce}" src="${dagreUri}"></script>
  <script nonce="${nonce}" src="${cytoscapeDagreUri}"></script>
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
