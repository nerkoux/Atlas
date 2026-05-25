import { MessageFromWebview, MessageToWebview } from '../types';

declare function acquireVsCodeApi(): {
  postMessage(message: MessageFromWebview): void;
  getState(): unknown;
  setState(state: unknown): void;
};

let _api: ReturnType<typeof acquireVsCodeApi> | null = null;

function getApi() {
  if (!_api) {
    try {
      _api = acquireVsCodeApi();
    } catch {
      // Fallback for development outside VS Code
      _api = {
        postMessage: (msg) => console.log('[Atlas Dev]', msg),
        getState: () => null,
        setState: () => {},
      };
    }
  }
  return _api;
}

export function postMessage(message: MessageFromWebview): void {
  getApi().postMessage(message);
}

export function onMessage(callback: (message: MessageToWebview) => void): () => void {
  const handler = (event: MessageEvent) => {
    callback(event.data as MessageToWebview);
  };
  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}
