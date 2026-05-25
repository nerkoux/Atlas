import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { GraphData, FileCache, FileCacheEntry } from '../types';

const CACHE_VERSION = 2;
const CACHE_FILENAME = '.atlas-cache.json';

export function getCachePath(workspaceRoot: string): string {
  return path.join(workspaceRoot, CACHE_FILENAME);
}

export function loadCache(workspaceRoot: string): FileCache | null {
  try {
    const cachePath = getCachePath(workspaceRoot);
    if (!fs.existsSync(cachePath)) return null;
    const raw = fs.readFileSync(cachePath, 'utf8');
    const cache = JSON.parse(raw) as FileCache;
    if (cache.version !== CACHE_VERSION) return null;
    if (cache.workspaceRoot !== workspaceRoot) return null;
    return cache;
  } catch {
    return null;
  }
}

export function saveCache(workspaceRoot: string, graphData: GraphData, fileEntries: Record<string, FileCacheEntry>): void {
  try {
    const cache: FileCache = {
      version: CACHE_VERSION,
      workspaceRoot,
      files: fileEntries,
      graphData,
      timestamp: Date.now(),
    };
    const cachePath = getCachePath(workspaceRoot);
    fs.writeFileSync(cachePath, JSON.stringify(cache), 'utf8');
  } catch {
    // Cache write failures are non-fatal
  }
}

export function hashFile(filePath: string): number {
  try {
    const content = fs.readFileSync(filePath);
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      hash = ((hash << 5) - hash + content[i]) | 0;
    }
    return hash;
  } catch {
    return 0;
  }
}

export function getFileCacheEntry(filePath: string): FileCacheEntry | null {
  try {
    const stat = fs.statSync(filePath);
    return {
      hash: hashFile(filePath),
      size: stat.size,
      lastModified: stat.mtimeMs,
    };
  } catch {
    return null;
  }
}

export function isFileDirty(filePath: string, cached: FileCacheEntry): boolean {
  try {
    const stat = fs.statSync(filePath);
    if (stat.mtimeMs !== cached.lastModified) return true;
    if (stat.size !== cached.size) return true;
    return false;
  } catch {
    return true;
  }
}

export function getDirtyFiles(
  currentFiles: string[],
  cache: FileCache
): { added: string[]; modified: string[]; removed: string[] } {
  const currentSet = new Set(currentFiles);
  const cachedSet = new Set(Object.keys(cache.files));

  const added = currentFiles.filter((f) => !cachedSet.has(f));
  const removed = [...cachedSet].filter((f) => !currentSet.has(f));
  const modified = currentFiles.filter((f) => {
    const entry = cache.files[f];
    return entry && isFileDirty(f, entry);
  });

  return { added, modified, removed };
}
