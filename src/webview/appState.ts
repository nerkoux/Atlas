/**
 * State machine for the Atlas sidebar webview.
 *
 * Lives outside React so it can be unit-tested without rendering.
 */
import type { GraphData, ScanProgress } from '../types';

export interface AppState {
  graphData: GraphData | null;
  progress: ScanProgress | null;
  selectedSystem: string | null;
  focusedNode: string | null;
  error: string | null;
  workspaceName: string;
  workspacePath: string;
  isLoading: boolean;
  searchQuery: string;
}

export type AppAction =
  | { type: 'SET_GRAPH'; data: GraphData }
  | { type: 'SET_PROGRESS'; data: ScanProgress }
  | { type: 'SET_ERROR'; message: string }
  | { type: 'SET_WORKSPACE'; name: string; path: string }
  | { type: 'SELECT_SYSTEM'; systemId: string | null }
  | { type: 'FOCUS_NODE'; nodeId: string }
  | { type: 'SET_SEARCH'; query: string };

export const INITIAL_APP_STATE: AppState = {
  graphData: null,
  progress: null,
  selectedSystem: null,
  focusedNode: null,
  error: null,
  workspaceName: 'Workspace',
  workspacePath: '',
  isLoading: false,
  searchQuery: '',
};

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_GRAPH':
      return {
        ...state,
        graphData: action.data,
        progress: null,
        isLoading: false,
        error: null,
      };

    case 'SET_PROGRESS':
      return {
        ...state,
        progress: action.data,
        isLoading: action.data.phase !== 'complete' && action.data.phase !== 'error',
      };

    case 'SET_ERROR':
      return { ...state, error: action.message, isLoading: false, progress: null };

    case 'SET_WORKSPACE':
      return { ...state, workspaceName: action.name, workspacePath: action.path };

    case 'SELECT_SYSTEM':
      return { ...state, selectedSystem: action.systemId };

    case 'FOCUS_NODE':
      return { ...state, focusedNode: action.nodeId };

    case 'SET_SEARCH':
      return { ...state, searchQuery: action.query };

    default:
      return state;
  }
}
