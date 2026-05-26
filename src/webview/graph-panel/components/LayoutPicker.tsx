import React from 'react';
import { LayoutName, isLayoutAvailable } from '../cytoscape/layout';
import { graphStyles as S } from '../styles';

interface Props {
  active: LayoutName;
  onChange: (l: LayoutName) => void;
}

interface Option {
  id: LayoutName;
  label: string;
  title: string;
}

export function LayoutPicker({ active, onChange }: Props): React.ReactElement {
  const dagreOk = isLayoutAvailable('dagre');
  const options: Option[] = [
    { id: 'cose', label: 'Force', title: 'Force-directed layout — natural clustering' },
    {
      id: 'dagre',
      label: 'Hierarchy',
      title: dagreOk ? 'Hierarchical top-down layout' : 'Hierarchical (built-in fallback)',
    },
    { id: 'concentric', label: 'Radial', title: 'Concentric layout — most-used files in the centre' },
  ];

  return (
    <div style={S.layoutPicker} role="group" aria-label="Graph layout">
      {options.map((o) => (
        <button
          key={o.id}
          style={{ ...S.layoutBtn, ...(active === o.id ? S.layoutBtnActive : {}) }}
          onClick={() => onChange(o.id)}
          title={o.title}
          aria-pressed={active === o.id}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
