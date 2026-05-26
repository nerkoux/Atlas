import { FileNode, ArchitectureSystem, SystemType } from '../types';

// ─── Rule shape ──────────────────────────────────────────────────────────────

interface SystemRule {
  id: string;
  name: string;
  type: SystemType;
  color: string;
  /** Strong rules that anchor to path segments (high signal). */
  pathPatterns?: RegExp[];
  /** Weaker name-based rules used as a tiebreaker. */
  patterns?: RegExp[];
  keywords?: string[];
  /** When this rule matches via `pathPatterns`, give it this score outright. */
  priority: number;
}

// ─── Rule set ────────────────────────────────────────────────────────────────
//
// Rules are evaluated highest-priority first, but a strong `pathPatterns` hit
// short-circuits the search. That handles the common case (`lib/auth/foo.ts`,
// `lib/services/bar.ts`, `app/api/...`) without depending on filename keywords.

const SYSTEM_RULES: SystemRule[] = [
  // Tests first — they often shadow other categories (auth.test.ts is test, not auth).
  {
    id: 'test',
    name: 'Tests',
    type: 'test',
    color: '#64748b',
    priority: 100,
    pathPatterns: [
      /\.test\./i, /\.spec\./i,
      /(^|\/)__tests__\//i,
      /(^|\/)tests?\//i,
      /(^|\/)specs?\//i,
      /(^|\/)e2e\//i,
      /(^|\/)__mocks__\//i,
      /(^|\/)fixtures?\//i,
    ],
    patterns: [/\.test\./i, /\.spec\./i],
    keywords: ['test', 'spec', 'mock', 'fixture', 'e2e'],
  },

  // Auth — strong path-anchored: lib/auth/, /auth/, login flows.
  {
    id: 'auth',
    name: 'Auth System',
    type: 'auth',
    color: '#8b5cf6',
    priority: 90,
    pathPatterns: [
      /(^|\/)auth(\/|$)/i,
      /(^|\/)login(\/|$)/i,
      /(^|\/)logout(\/|$)/i,
      /(^|\/)signin(\/|$)/i,
      /(^|\/)signup(\/|$)/i,
      /(^|\/)session(\/|$)/i,
      /(^|\/)oauth(\/|$)/i,
      /(^|\/)passport(\/|$)/i,
      /\bsession-cookie\b/i,
      /\bauth-session\b/i,
    ],
    patterns: [/auth/i, /jwt/i, /token/i, /\bguard\b/i],
    keywords: ['auth', 'login', 'logout', 'session', 'jwt', 'oauth', 'passport'],
  },

  // Payment — billing, checkout, subscriptions, polar, stripe.
  {
    id: 'payment',
    name: 'Payment System',
    type: 'payment',
    color: '#14b8a6',
    priority: 88,
    pathPatterns: [
      /(^|\/)billing(\/|$)/i,
      /(^|\/)payment(s)?(\/|$)/i,
      /(^|\/)checkout(\/|$)/i,
      /(^|\/)subscription(s)?(\/|$)/i,
      /(^|\/)premium(\/|$)/i,
      /(^|\/)polar(\/|$)/i,
      /\bpolar-/i,
      /\bstripe\b/i,
      /\bportal\b/i,
    ],
    patterns: [/payment/i, /billing/i, /invoice/i, /checkout/i, /subscription/i],
    keywords: ['payment', 'billing', 'invoice', 'checkout', 'subscription'],
  },

  // API routes — Next.js app/api/, pages/api/, route.ts files, controllers.
  {
    id: 'api',
    name: 'API Layer',
    type: 'api',
    color: '#3b82f6',
    priority: 85,
    pathPatterns: [
      /(^|\/)api(\/|$)/i,
      /(^|\/)route\.[tj]sx?$/i,
      /(^|\/)routes?(\/|$)/i,
      /(^|\/)controller(s)?(\/|$)/i,
      /(^|\/)endpoints?(\/|$)/i,
      /(^|\/)resolvers?(\/|$)/i,
      /(^|\/)handlers?(\/|$)/i,
      /(^|\/)graphql(\/|$)/i,
    ],
    patterns: [/\.controller\./i, /\.route\./i, /\.handler\./i],
    keywords: ['controller', 'endpoint', 'graphql', 'resolver'],
  },

  // Middleware — interceptors, filters, pipes.
  {
    id: 'middleware',
    name: 'Middleware',
    type: 'middleware',
    color: '#06b6d4',
    priority: 80,
    pathPatterns: [
      /(^|\/)middleware(s)?(\/|$)/i,
      /(^|\/)interceptors?(\/|$)/i,
      /(^|\/)filters?(\/|$)/i,
      /(^|\/)pipes?(\/|$)/i,
      /^middleware\.[tj]sx?$/i,
      /(^|\/)guards?(\/|$)/i,
    ],
    patterns: [/\.middleware\./i, /\.interceptor\./i],
    keywords: ['middleware', 'interceptor', 'filter', 'pipe'],
  },

  // Data layer — models, schemas, migrations, db, prisma, mongoose.
  {
    id: 'database',
    name: 'Data Layer',
    type: 'database',
    color: '#10b981',
    priority: 78,
    pathPatterns: [
      /(^|\/)models?(\/|$)/i,
      /(^|\/)schemas?(\/|$)/i,
      /(^|\/)entities(\/|$)/i,
      /(^|\/)repositories(\/|$)/i,
      /(^|\/)repository(\/|$)/i,
      /(^|\/)migrations(\/|$)/i,
      /(^|\/)seeds?(\/|$)/i,
      /(^|\/)db(\/|$)/i,
      /(^|\/)database(\/|$)/i,
      /(^|\/)prisma(\/|$)/i,
      /\bprisma\.config\b/i,
      /\bmongoose\b/i,
    ],
    patterns: [/\.model\./i, /\.schema\./i, /\.entity\./i, /\.repository\./i],
    keywords: ['model', 'schema', 'entity', 'repository', 'migration', 'prisma', 'mongoose'],
  },

  // Services — business logic.
  {
    id: 'service',
    name: 'Services',
    type: 'service',
    color: '#6366f1',
    priority: 76,
    pathPatterns: [
      /(^|\/)services?(\/|$)/i,
      /(^|\/)usecases?(\/|$)/i,
      /(^|\/)domain(\/|$)/i,
      /(^|\/)managers?(\/|$)/i,
      /\.service\.[tj]sx?$/i,
    ],
    patterns: [/\.service\./i, /\.manager\./i],
    keywords: ['service', 'usecase', 'manager'],
  },

  // State management — stores, contexts, reducers, slices, hooks ending in use*.
  {
    id: 'state',
    name: 'State Management',
    type: 'state',
    color: '#f59e0b',
    priority: 74,
    pathPatterns: [
      /(^|\/)stores?(\/|$)/i,
      /(^|\/)contexts?(\/|$)/i,
      /(^|\/)reducers?(\/|$)/i,
      /(^|\/)slices?(\/|$)/i,
      /(^|\/)atoms?(\/|$)/i,
      /(^|\/)recoil(\/|$)/i,
      /(^|\/)redux(\/|$)/i,
      /(^|\/)zustand(\/|$)/i,
      /(^|\/)hooks?(\/|$)/i,
      /(^|\/)_hooks?(\/|$)/i,
      /\/use-[a-z0-9-]+\.[tj]sx?$/i,
      /\/use[A-Z][a-zA-Z0-9]+\.[tj]sx?$/i,
    ],
    patterns: [/\bstore\b/i, /\breducer\b/i, /\bslice\b/i],
    keywords: ['store', 'context', 'reducer', 'slice', 'atom', 'hook'],
  },

  // Validators — input validation (zod, yup, joi).
  {
    id: 'validation',
    name: 'Validators',
    type: 'util',
    color: '#0ea5e9',
    priority: 72,
    pathPatterns: [
      /(^|\/)validators?(\/|$)/i,
      /(^|\/)schemas?\/.*\.validator/i,
      /\.validator(s)?\.[tj]sx?$/i,
    ],
    keywords: ['validator', 'schema', 'zod', 'yup', 'joi'],
  },

  // Type definitions — pure type packages.
  {
    id: 'types',
    name: 'Types',
    type: 'config',
    color: '#7c3aed',
    priority: 68,
    pathPatterns: [
      /(^|\/)types?(\/|$)/i,
      /(^|\/)_types?(\/|$)/i,
      /\.types?\.[tj]sx?$/i,
      /\.d\.ts$/i,
    ],
    keywords: ['type', 'types', 'interface'],
  },

  // Configuration — env, config files, build tooling.
  {
    id: 'config',
    name: 'Configuration',
    type: 'config',
    color: '#94a3b8',
    priority: 66,
    pathPatterns: [
      /(^|\/)config(\/|$)/i,
      /(^|\/)settings?(\/|$)/i,
      /(^|\/)constants?(\/|$)/i,
      /(^|\/)env(\/|$)/i,
      /\.config\.[mc]?[tj]sx?$/i,
      /\.env(\.|$)/i,
      /\beslint\.config\b/i,
      /\bnext\.config\b/i,
      /\btailwind\.config\b/i,
      /\bpostcss\.config\b/i,
      /\bvite\.config\b/i,
      /\bwebpack\.config\b/i,
      /\bbabel\.config\b/i,
      /\btsconfig\b/i,
    ],
    patterns: [/\.config\./i],
    keywords: ['config', 'env', 'setting', 'constant'],
  },

  // UI — components, pages, layouts. Lower priority than data/auth/api so that
  // a Next.js app/api/auth/login/page.tsx still goes to API rather than UI.
  {
    id: 'ui',
    name: 'UI Components',
    type: 'ui',
    color: '#ec4899',
    priority: 60,
    pathPatterns: [
      /(^|\/)components?(\/|$)/i,
      /(^|\/)_components?(\/|$)/i,
      /(^|\/)pages?(\/|$)/i,
      /(^|\/)views?(\/|$)/i,
      /(^|\/)screens?(\/|$)/i,
      /(^|\/)layouts?(\/|$)/i,
      /(^|\/)widgets?(\/|$)/i,
      /(^|\/)ui(\/|$)/i,
      /\.tsx$/i,
      /\.jsx$/i,
      /(^|\/)page\.[tj]sx?$/i,
      /(^|\/)layout\.[tj]sx?$/i,
      /(^|\/)not-found\.[tj]sx?$/i,
    ],
    keywords: ['component', 'page', 'view', 'screen', 'layout', 'widget'],
  },

  // Logic — Next.js convention `_logic/` folders for view-models, normalizers, etc.
  // Land them with services because that's what they conceptually are.
  {
    id: 'service-logic',
    name: 'Services',
    type: 'service',
    color: '#6366f1',
    priority: 58,
    pathPatterns: [
      /(^|\/)_logic(\/|$)/i,
      /\.logic\.[tj]sx?$/i,
      /\.normalizer(s)?\.[tj]sx?$/i,
      /\.controller\.[tj]sx?$/i,
    ],
    keywords: ['logic', 'normalizer', 'view-model'],
  },

  // Utilities — helpers, common, lib (only when nothing more specific matched).
  {
    id: 'util',
    name: 'Utilities',
    type: 'util',
    color: '#a78bfa',
    priority: 30,
    pathPatterns: [
      /(^|\/)utils?(\/|$)/i,
      /(^|\/)helpers?(\/|$)/i,
      /(^|\/)common(\/|$)/i,
      /(^|\/)shared(\/|$)/i,
      /(^|\/)tools?(\/|$)/i,
      /(^|\/)_lib(\/|$)/i,
      /\.utils?\.[tj]sx?$/i,
      /\.helpers?\.[tj]sx?$/i,
    ],
    keywords: ['util', 'helper', 'common', 'shared', 'tool'],
  },

  // Core — bootstrap entry points. Lowest priority so a `core/auth.ts` still
  // ends up under Auth.
  {
    id: 'core',
    name: 'Core',
    type: 'core',
    color: '#f97316',
    priority: 20,
    pathPatterns: [
      /^index\.[tj]sx?$/i,
      /^main\.[tj]sx?$/i,
      /^app\.[tj]sx?$/i,
      /^server\.[tj]sx?$/i,
      /(^|\/)bootstrap(\/|$)/i,
      /(^|\/)setup(\/|$)/i,
    ],
    keywords: ['bootstrap', 'main', 'init'],
  },
];

// ─── Scoring ─────────────────────────────────────────────────────────────────

/**
 * Score a file against a single rule.
 *
 * `pathPatterns` are strong signals (each match adds 10 points). A single
 * path-anchored hit is enough to classify a file, which is much more reliable
 * than relying on filename keyword matches.
 */
function scoreFile(file: FileNode, rule: SystemRule): number {
  const filePath = file.relativePath.toLowerCase();
  const fileName = file.name.toLowerCase();
  const pathSegments = filePath.split('/');

  let score = 0;

  // Path patterns: highest signal.
  if (rule.pathPatterns) {
    for (const pat of rule.pathPatterns) {
      if (pat.test(filePath) || pat.test(fileName)) score += 10;
    }
  }

  // Loose patterns: middling signal.
  if (rule.patterns) {
    for (const pat of rule.patterns) {
      if (pat.test(filePath)) score += 3;
      if (pat.test(fileName)) score += 4;
    }
  }

  // Keyword matches against path segments: weakest signal.
  if (rule.keywords) {
    for (const segment of pathSegments) {
      for (const keyword of rule.keywords) {
        if (segment === keyword) score += 3;        // whole-segment exact = strong-ish
        else if (segment.includes(keyword)) score += 1;
      }
    }
  }

  return score;
}

// ─── Fallback grouping ───────────────────────────────────────────────────────

/**
 * For files no rule could classify, group them by their top-level directory.
 *
 * Without this, every unclassified file gets dumped into a single "Other"
 * bucket which collapses architectural context. With it, `discord/api.ts`,
 * `discord/utils.ts`, etc. become one cohesive `discord` system.
 *
 * We only do this when the leftover bucket is large enough to be useful
 * (more than 3 files in the same directory).
 */
function buildFallbackGroups(unknownFiles: FileNode[]): Map<string, FileNode[]> {
  const groups = new Map<string, FileNode[]>();
  for (const f of unknownFiles) {
    const segments = f.relativePath.split('/');
    // Use the most informative directory: skip overly-generic top-level names.
    let bucket = segments.length >= 2 ? segments[0] : 'root';
    if (segments.length >= 3 && /^(src|app|lib|packages|apps)$/i.test(segments[0])) {
      bucket = segments[1];
    }
    bucket = bucket.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    if (!groups.has(bucket)) groups.set(bucket, []);
    groups.get(bucket)!.push(f);
  }

  // Drop tiny buckets back to a single "Other" group.
  const minBucketSize = 3;
  const tinyFiles: FileNode[] = [];
  for (const [k, list] of groups) {
    if (list.length < minBucketSize) {
      tinyFiles.push(...list);
      groups.delete(k);
    }
  }
  if (tinyFiles.length > 0) groups.set('other', tinyFiles);

  return groups;
}

// Stable colour palette for fallback groups.
const FALLBACK_COLORS = [
  '#0ea5e9', '#10b981', '#f59e0b', '#a78bfa', '#ec4899',
  '#14b8a6', '#fb7185', '#84cc16', '#22d3ee', '#eab308',
];

function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

function titleCase(s: string): string {
  return s
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

// ─── Main classifier ─────────────────────────────────────────────────────────

export function classifyFiles(files: FileNode[]): ArchitectureSystem[] {
  // Two rules can share the same `id` (e.g. `service` and `service-logic`
  // both contribute to Services). Build a logical bucket map keyed by id.
  const sortedRules = [...SYSTEM_RULES].sort((a, b) => b.priority - a.priority);
  const ruleMap = new Map<string, SystemRule>();
  for (const r of SYSTEM_RULES) {
    if (!ruleMap.has(r.id)) ruleMap.set(r.id, r);
  }

  const fileAssignments = new Map<string, string>();
  const unknownFiles: FileNode[] = [];
  const SCORE_THRESHOLD = 5; // a single pathPattern hit (10) clears this trivially

  for (const file of files) {
    let bestId: string | null = null;
    let bestScore = 0;

    for (const rule of sortedRules) {
      const score = scoreFile(file, rule);
      if (score > bestScore) {
        bestScore = score;
        bestId = rule.id;
      }
    }

    if (bestId && bestScore >= SCORE_THRESHOLD) {
      // Merge rules sharing an id (service / service-logic) onto the same bucket.
      const canonicalRule = ruleMap.get(bestId);
      const finalId = canonicalRule?.id ?? bestId;
      fileAssignments.set(file.id, finalId);
    } else {
      unknownFiles.push(file);
    }
  }

  // Build canonical systems first.
  const systems: ArchitectureSystem[] = [];
  const idToFiles = new Map<string, string[]>();
  for (const [fileId, sysId] of fileAssignments) {
    if (!idToFiles.has(sysId)) idToFiles.set(sysId, []);
    idToFiles.get(sysId)!.push(fileId);
  }

  for (const [id, rule] of ruleMap) {
    const fileIds = idToFiles.get(id) ?? [];
    if (fileIds.length === 0) continue;
    systems.push(buildSystem(rule, fileIds, files, fileAssignments));
  }

  // Build folder-based fallback groups for any leftover files instead of
  // dumping them all into a single "Other" bucket.
  if (unknownFiles.length > 0) {
    const groups = buildFallbackGroups(unknownFiles);
    for (const [bucketName, bucketFiles] of groups) {
      const id = `auto-${bucketName}`;
      const fileIds = bucketFiles.map((f) => f.id);
      const displayName = bucketName === 'other' ? 'Other' : titleCase(bucketName);
      const color = bucketName === 'other' ? '#64748b' : colorFor(bucketName);

      const ruleLike: SystemRule = {
        id,
        name: displayName,
        type: 'unknown',
        color,
        priority: 0,
      };

      for (const f of bucketFiles) fileAssignments.set(f.id, id);
      systems.push(buildSystem(ruleLike, fileIds, files, fileAssignments));
    }
  }

  // Stamp the system id back onto each FileNode so downstream consumers
  // (graph, intelligence, tree) can use it directly.
  for (const file of files) {
    const sysId = fileAssignments.get(file.id) ?? 'unknown';
    file.systemId = sysId;
  }

  return systems;
}

function buildSystem(
  rule: SystemRule,
  fileIds: string[],
  allFiles: FileNode[],
  fileAssignments: Map<string, string>
): ArchitectureSystem {
  const sysFiles = allFiles.filter((f) => fileIds.includes(f.id));
  const entryPoints = sysFiles.filter((f) => f.isEntryPoint).map((f) => f.id);

  const totalImports = sysFiles.reduce((s, f) => s + f.imports.length, 0);
  const totalExports = sysFiles.reduce((s, f) => s + f.exports.length, 0);
  const externalDeps = new Set<string>();
  for (const f of sysFiles) {
    for (const imp of f.imports) {
      if (
        !imp.isExternal &&
        imp.resolvedPath &&
        fileAssignments.get(imp.resolvedPath) !== rule.id
      ) {
        externalDeps.add(imp.resolvedPath);
      }
    }
  }
  const couplingScore = fileIds.length > 0 ? externalDeps.size / fileIds.length : 0;

  return {
    id: rule.id,
    name: rule.name,
    type: rule.type,
    color: rule.color,
    files: fileIds,
    entryPoints,
    metrics: {
      fileCount: fileIds.length,
      totalImports,
      totalExports,
      couplingScore: Math.round(couplingScore * 100) / 100,
      cohesionScore: Math.round((1 - couplingScore) * 100) / 100,
      hasCircularDeps: false,
    },
  };
}
