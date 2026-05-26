import React from 'react';
import type { CircularDependency, LayerViolation } from '../../../types';
import { severityColor, shortenPath } from './helpers';
import { sidebarStyles as S } from './styles';

interface Props {
  circularDeps: CircularDependency[];
  layerViolations: LayerViolation[];
  onOpenFile: (path: string, line?: number) => void;
}

export function ViolationsTab({
  circularDeps,
  layerViolations,
  onOpenFile,
}: Props): React.ReactElement {
  const isClean = circularDeps.length === 0 && layerViolations.length === 0;

  return (
    <div style={S.scrollArea} role="tabpanel" aria-labelledby="tab-violations">
      {circularDeps.length > 0 && (
        <CircularDepsSection deps={circularDeps} />
      )}

      {layerViolations.length > 0 && (
        <LayerViolationsSection violations={layerViolations} onOpenFile={onOpenFile} />
      )}

      {isClean && (
        <div style={S.emptyTab} role="status">
          <span aria-hidden="true" style={{ fontSize: '20px', marginBottom: '8px' }}>
            ✓
          </span>
          <span>No architectural violations detected</span>
        </div>
      )}
    </div>
  );
}

function CircularDepsSection({ deps }: { deps: CircularDependency[] }): React.ReactElement {
  return (
    <section style={S.violationGroup} aria-label="Circular dependencies">
      <h3 style={S.violationGroupHeader}>
        <span aria-hidden="true" style={{ color: '#f59e0b' }}>
          ↺
        </span>
        <span>Circular Dependencies ({deps.length})</span>
      </h3>
      {deps.slice(0, 8).map((cd, i) => (
        <div key={i} style={S.violationCard}>
          <span
            style={{ ...S.severityDot, background: severityColor(cd.severity) }}
            aria-hidden="true"
          />
          <div style={S.violationContent}>
            <p style={S.violationDesc}>{cd.cycle.map(shortenPath).join(' → ')}</p>
            <p style={S.violationMeta}>
              {cd.cycle.length} files · {cd.severity} severity
            </p>
          </div>
        </div>
      ))}
    </section>
  );
}

function LayerViolationsSection({
  violations,
  onOpenFile,
}: {
  violations: LayerViolation[];
  onOpenFile: (path: string, line?: number) => void;
}): React.ReactElement {
  return (
    <section style={S.violationGroup} aria-label="Layer violations">
      <h3 style={S.violationGroupHeader}>
        <span aria-hidden="true" style={{ color: '#ef4444' }}>
          ⛔
        </span>
        <span>Layer Violations ({violations.length})</span>
      </h3>
      {violations.map((v, i) => (
        <div key={i} style={S.violationCard}>
          <span
            style={{ ...S.severityDot, background: severityColor(v.severity) }}
            aria-hidden="true"
          />
          <div style={S.violationContent}>
            <p style={S.violationDesc}>{v.description}</p>
            <div style={S.violationFiles}>
              <button
                style={S.violationFile}
                onClick={() => onOpenFile(v.fromFile)}
                title={v.fromFile}
              >
                {shortenPath(v.fromFile)}
              </button>
              <span style={S.violationArrow} aria-hidden="true">
                →
              </span>
              <button
                style={S.violationFile}
                onClick={() => onOpenFile(v.toFile)}
                title={v.toFile}
              >
                {shortenPath(v.toFile)}
              </button>
            </div>
            <p style={S.violationMeta}>
              {v.fromLayer} → {v.toLayer}
            </p>
          </div>
        </div>
      ))}
    </section>
  );
}
