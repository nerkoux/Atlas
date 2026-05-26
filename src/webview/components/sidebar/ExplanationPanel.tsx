import React from 'react';
import type { SystemExplanation } from '../../../types';
import { sidebarStyles as S } from './styles';

interface Props {
  explanation: SystemExplanation;
}

export function ExplanationPanel({ explanation }: Props): React.ReactElement {
  return (
    <div style={S.explainPanel} role="region" aria-label="System explanation">
      <p style={S.explainSummary}>{explanation.summary}</p>

      {explanation.responsibilities.length > 0 && (
        <Section title="Responsibilities">
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {explanation.responsibilities.map((r, i) => (
              <li key={i} style={S.explainBullet}>
                · {r}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {explanation.usedBy.length > 0 && (
        <Section title="Used by">
          <Tags items={explanation.usedBy} />
        </Section>
      )}

      {explanation.uses.length > 0 && (
        <Section title="Depends on">
          <Tags items={explanation.uses} />
        </Section>
      )}

      {explanation.warnings.length > 0 && (
        <div style={S.explainWarnings} role="alert">
          {explanation.warnings.map((w, i) => (
            <p key={i} style={S.explainWarning}>
              ⚠ {w}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div style={S.explainSection}>
      <h4 style={S.explainSectionTitle}>{title}</h4>
      {children}
    </div>
  );
}

function Tags({ items }: { items: string[] }): React.ReactElement {
  return (
    <div style={S.explainTags}>
      {items.map((u) => (
        <span key={u} style={S.explainTag}>
          {u}
        </span>
      ))}
    </div>
  );
}
