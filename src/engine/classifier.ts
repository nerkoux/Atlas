import { FileNode, ArchitectureSystem, SystemType } from '../types';

interface SystemRule {
  id: string;
  name: string;
  type: SystemType;
  color: string;
  patterns: RegExp[];
  keywords: string[];
  priority: number;
}

const SYSTEM_RULES: SystemRule[] = [
  {
    id: 'auth',
    name: 'Auth System',
    type: 'auth',
    color: '#8b5cf6',
    priority: 10,
    patterns: [/auth/i, /login/i, /logout/i, /session/i, /jwt/i, /oauth/i, /passport/i, /permission/i, /role/i, /guard/i],
    keywords: ['auth', 'login', 'logout', 'session', 'jwt', 'token', 'oauth', 'permission', 'role', 'guard', 'user'],
  },
  {
    id: 'api',
    name: 'API Layer',
    type: 'api',
    color: '#3b82f6',
    priority: 9,
    patterns: [/route/i, /controller/i, /handler/i, /endpoint/i, /api/i, /rest/i, /graphql/i, /resolver/i, /router/i],
    keywords: ['route', 'controller', 'handler', 'endpoint', 'api', 'rest', 'graphql', 'resolver', 'router'],
  },
  {
    id: 'middleware',
    name: 'Middleware',
    type: 'middleware',
    color: '#06b6d4',
    priority: 8,
    patterns: [/middleware/i, /interceptor/i, /guard/i, /filter/i, /pipe/i, /hook/i],
    keywords: ['middleware', 'interceptor', 'guard', 'filter', 'pipe'],
  },
  {
    id: 'database',
    name: 'Data Layer',
    type: 'database',
    color: '#10b981',
    priority: 9,
    patterns: [/model/i, /schema/i, /migration/i, /repository/i, /dao/i, /entity/i, /orm/i, /prisma/i, /mongoose/i, /sequelize/i, /db/i, /database/i, /query/i, /seed/i],
    keywords: ['model', 'schema', 'migration', 'repository', 'dao', 'entity', 'prisma', 'mongoose', 'db', 'database', 'query', 'seed'],
  },
  {
    id: 'state',
    name: 'State Management',
    type: 'state',
    color: '#f59e0b',
    priority: 8,
    patterns: [/store/i, /context/i, /redux/i, /zustand/i, /recoil/i, /atom/i, /slice/i, /reducer/i, /action/i, /state/i, /provider/i],
    keywords: ['store', 'context', 'redux', 'zustand', 'recoil', 'atom', 'slice', 'reducer', 'action', 'state', 'provider'],
  },
  {
    id: 'ui',
    name: 'UI Components',
    type: 'ui',
    color: '#ec4899',
    priority: 7,
    patterns: [/component/i, /page/i, /view/i, /screen/i, /layout/i, /widget/i, /\.tsx$/i, /\.jsx$/i, /ui\//i, /components\//i, /pages\//i, /views\//i],
    keywords: ['component', 'page', 'view', 'screen', 'layout', 'widget', 'button', 'modal', 'form', 'input'],
  },
  {
    id: 'service',
    name: 'Services',
    type: 'service',
    color: '#6366f1',
    priority: 7,
    patterns: [/service/i, /manager/i, /provider/i, /client/i, /integration/i, /adapter/i],
    keywords: ['service', 'manager', 'provider', 'client', 'integration', 'adapter'],
  },
  {
    id: 'payment',
    name: 'Payment System',
    type: 'payment',
    color: '#14b8a6',
    priority: 10,
    patterns: [/payment/i, /billing/i, /stripe/i, /invoice/i, /subscription/i, /checkout/i, /order/i, /cart/i],
    keywords: ['payment', 'billing', 'stripe', 'invoice', 'subscription', 'checkout', 'order', 'cart'],
  },
  {
    id: 'config',
    name: 'Configuration',
    type: 'config',
    color: '#94a3b8',
    priority: 6,
    patterns: [/config/i, /env/i, /setting/i, /constant/i, /const/i, /\benv\b/i],
    keywords: ['config', 'env', 'setting', 'constant', 'environment', 'configuration'],
  },
  {
    id: 'util',
    name: 'Utilities',
    type: 'util',
    color: '#a78bfa',
    priority: 5,
    patterns: [/util/i, /helper/i, /common/i, /shared/i, /lib/i, /tool/i, /format/i, /transform/i, /parse/i],
    keywords: ['util', 'helper', 'common', 'shared', 'lib', 'tool', 'format', 'transform', 'parse', 'convert'],
  },
  {
    id: 'test',
    name: 'Tests',
    type: 'test',
    color: '#64748b',
    priority: 10,
    patterns: [/\.test\./i, /\.spec\./i, /__tests__/i, /test\//i, /spec\//i, /e2e/i, /fixture/i, /mock/i],
    keywords: ['test', 'spec', 'mock', 'fixture', 'e2e'],
  },
  {
    id: 'core',
    name: 'Core',
    type: 'core',
    color: '#f97316',
    priority: 4,
    patterns: [/core/i, /main/i, /index/i, /app/i, /bootstrap/i, /setup/i, /init/i],
    keywords: ['core', 'main', 'index', 'app', 'bootstrap', 'setup', 'init'],
  },
];

function scoreFile(file: FileNode, rule: SystemRule): number {
  let score = 0;
  const filePath = file.relativePath.toLowerCase();
  const fileName = file.name.toLowerCase();
  const pathSegments = filePath.split('/');

  for (const pattern of rule.patterns) {
    if (pattern.test(filePath)) score += 3;
    if (pattern.test(fileName)) score += 5;
  }

  for (const segment of pathSegments) {
    for (const keyword of rule.keywords) {
      if (segment.includes(keyword)) score += 2;
    }
  }

  for (const exp of file.exports) {
    for (const keyword of rule.keywords) {
      if (exp.name.toLowerCase().includes(keyword)) score += 1;
    }
  }

  return score;
}

export function classifyFiles(files: FileNode[]): ArchitectureSystem[] {
  const systemFilesMap = new Map<string, string[]>();
  const fileAssignments = new Map<string, string>();

  for (const rule of SYSTEM_RULES) {
    systemFilesMap.set(rule.id, []);
  }
  systemFilesMap.set('unknown', []);

  for (const file of files) {
    let bestRule: SystemRule | null = null;
    let bestScore = 0;

    const sortedRules = [...SYSTEM_RULES].sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      const score = scoreFile(file, rule);
      if (score > bestScore) {
        bestScore = score;
        bestRule = rule;
      }
    }

    if (bestRule && bestScore >= 2) {
      systemFilesMap.get(bestRule.id)!.push(file.id);
      fileAssignments.set(file.id, bestRule.id);
    } else {
      systemFilesMap.get('unknown')!.push(file.id);
      fileAssignments.set(file.id, 'unknown');
    }
  }

  const systems: ArchitectureSystem[] = [];

  for (const rule of SYSTEM_RULES) {
    const fileIds = systemFilesMap.get(rule.id) ?? [];
    if (fileIds.length === 0) continue;

    const sysFiles = files.filter((f) => fileIds.includes(f.id));
    const entryPoints = sysFiles.filter((f) => f.isEntryPoint).map((f) => f.id);

    const totalImports = sysFiles.reduce((s, f) => s + f.imports.length, 0);
    const totalExports = sysFiles.reduce((s, f) => s + f.exports.length, 0);
    const externalDeps = new Set<string>();
    for (const f of sysFiles) {
      for (const imp of f.imports) {
        if (!imp.isExternal && imp.resolvedPath && fileAssignments.get(imp.resolvedPath) !== rule.id) {
          externalDeps.add(imp.resolvedPath);
        }
      }
    }
    const couplingScore = fileIds.length > 0 ? externalDeps.size / fileIds.length : 0;

    systems.push({
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
    });
  }

  const unknownFiles = systemFilesMap.get('unknown') ?? [];
  if (unknownFiles.length > 0) {
    systems.push({
      id: 'unknown',
      name: 'Other',
      type: 'unknown',
      color: '#64748b',
      files: unknownFiles,
      entryPoints: [],
      metrics: {
        fileCount: unknownFiles.length,
        totalImports: 0,
        totalExports: 0,
        couplingScore: 0,
        cohesionScore: 0,
        hasCircularDeps: false,
      },
    });
  }

  for (const file of files) {
    const sysId = fileAssignments.get(file.id) ?? 'unknown';
    file.systemId = sysId;
  }

  return systems;
}
