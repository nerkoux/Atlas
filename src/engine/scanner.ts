import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { FileNode, GraphData, ScanProgress, FileCacheEntry } from '../types';
import { parseFile, detectLanguage } from './parser';
import { DependencyGraph } from './graph';
import { classifyFiles } from './classifier';
import { buildGraphDataV2 } from './intelligence';
import { loadCache, saveCache, getFileCacheEntry, getDirtyFiles } from './cache';
import { discoverDartPackages, isDartGeneratedFile, DartWorkspaceContext } from './dartParser';

type ProgressCallback = (progress: ScanProgress) => void;

const DEFAULT_EXCLUDE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '__pycache__',
  '.cache',
  'coverage',
  '.vscode',
  '.idea',
  'vendor',
  'venv',
  '.venv',
  'env',
  '.env',
  'target',
  'out',
  '.turbo',
  '.atlas-cache.json',
  '.dart_tool',
  '.pub-cache',
  '.pub',
  '.fvm',
];

export async function scanWorkspace(
  workspaceRoot: string,
  onProgress: ProgressCallback
): Promise<GraphData> {
  const config = vscode.workspace.getConfiguration('atlas');
  const excludePatterns: string[] = config.get('excludePatterns') ?? [];
  const maxDepth: number = config.get('scanDepth') ?? 10;

  const excludeDirs = new Set([
    ...DEFAULT_EXCLUDE_PATTERNS,
    ...excludePatterns.map((p) => p.replace(/\*\*\//g, '').replace(/\//g, '').replace(/\*/g, '')),
  ]);

  onProgress({ phase: 'discovering', current: 0, total: 0, message: 'Discovering files...' });

  const allFiles = discoverFiles(workspaceRoot, excludeDirs, maxDepth);

  // Filter out generated Dart files
  const filteredFiles = allFiles.filter((f) => !isDartGeneratedFile(f));

  // Discover Dart packages for resolving package: imports
  const dartContext = discoverDartPackages(workspaceRoot, excludeDirs, maxDepth);

  // --- Incremental cache check ---
  const existingCache = loadCache(workspaceRoot);
  const fileEntries: Record<string, FileCacheEntry> = {};
  let filesToParse = filteredFiles;

  if (existingCache) {
    const { added, modified, removed } = getDirtyFiles(filteredFiles, existingCache);
    const dirtyCount = added.length + modified.length + removed.length;
    if (dirtyCount === 0) {
      onProgress({ phase: 'complete', current: filteredFiles.length, total: filteredFiles.length, message: 'Loaded from cache (no changes)' });
      return buildGraphDataV2(existingCache.graphData, []) as GraphData;
    }
    filesToParse = [...added, ...modified];
    onProgress({ phase: 'parsing', current: 0, total: filteredFiles.length, message: `${dirtyCount} file${dirtyCount > 1 ? 's' : ''} changed, re-analyzing...` });
  } else {
    onProgress({ phase: 'parsing', current: 0, total: filteredFiles.length, message: `Parsing ${filteredFiles.length} files...` });
  }

  const parsedFiles: FileNode[] = [];
  const graph = new DependencyGraph();
  let parsed = 0;

  const BATCH_SIZE = 50;
  for (let i = 0; i < filteredFiles.length; i += BATCH_SIZE) {
    const batch = filteredFiles.slice(i, i + BATCH_SIZE);
    for (const filePath of batch) {
      const fileNode = parseFile(filePath, workspaceRoot, dartContext);
      if (fileNode) {
        parsedFiles.push(fileNode);
        graph.addNode(fileNode);
      }
      const entry = getFileCacheEntry(filePath);
      if (entry) fileEntries[filePath] = entry;
      parsed++;
    }

    onProgress({
      phase: 'parsing',
      current: parsed,
      total: filteredFiles.length,
      currentFile: path.relative(workspaceRoot, batch[batch.length - 1]),
      message: `Parsed ${parsed}/${filteredFiles.length} files`,
    });

    await yieldToEventLoop();
  }

  onProgress({ phase: 'analyzing', current: 0, total: parsedFiles.length, message: 'Building dependency graph...' });

  graph.buildEdges();

  onProgress({ phase: 'classifying', current: 0, total: parsedFiles.length, message: 'Classifying systems & detecting violations...' });

  const systems = classifyFiles(parsedFiles);

  const circularDeps = graph.detectCircularDependencies();
  const cycleNodeSet = new Set(circularDeps.flatMap((c) => c.cycle));
  for (const system of systems) {
    system.metrics.hasCircularDeps = system.files.some((fid) => cycleNodeSet.has(fid));
  }

  const baseGraphData = graph.buildGraphData(systems);

  // --- Phase 2: intelligence layer ---
  const graphDataV2 = buildGraphDataV2(baseGraphData, parsedFiles);

  saveCache(workspaceRoot, graphDataV2 as GraphData, fileEntries);

  onProgress({ phase: 'complete', current: parsedFiles.length, total: parsedFiles.length, message: 'Analysis complete' });

  return graphDataV2 as GraphData;
}

function discoverFiles(dir: string, excludeDirs: Set<string>, maxDepth: number, currentDepth = 0): string[] {
  if (currentDepth > maxDepth) return [];

  const results: string[] = [];
  let entries: fs.Dirent[];

  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.env') {
      const allowedDotFiles = ['.eslintrc.js', '.eslintrc.ts', '.babelrc'];
      if (!allowedDotFiles.includes(entry.name)) continue;
    }

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (excludeDirs.has(entry.name)) continue;
      results.push(...discoverFiles(fullPath, excludeDirs, maxDepth, currentDepth + 1));
    } else if (entry.isFile()) {
      const lang = detectLanguage(fullPath);
      if (lang !== 'unknown') {
        results.push(fullPath);
      }
    }
  }

  return results;
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

export async function scanSingleFile(
  filePath: string,
  workspaceRoot: string,
  existingGraph: GraphData | null
): Promise<Partial<GraphData>> {
  const fileNode = parseFile(filePath, workspaceRoot);
  if (!fileNode) return {};

  return { nodes: existingGraph ? [...existingGraph.nodes] : [] };
}
