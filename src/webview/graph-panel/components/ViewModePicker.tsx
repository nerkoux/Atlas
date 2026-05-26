import React from 'react';
import { graphStyles as S } from '../styles';

export type ViewMode = 'systems' | 'files';

interface Props {
  mode: ViewMode;
  onChange: (m: ViewMode) => void;
  fileCount: number;
}

/**
 * Switches between the two graph rendering modes:
 *  - `systems`: one node per architectural system (cheap, scales to huge repos)
 *  - `files`: one node per file (rich, but only practical up to ~500 files)
 */
export function ViewModePicker({ mode, onChange, fileCount }: Props): React.ReactElement {
  const fileViewExpensive = fileCount > 500;
  const options: Array<{ id: ViewMode; label: string; title: string }> = [
    {
      id: 'systems',
      label: 'Systems',
      title: 'High-level system overview — fast, recommended for large repos',
    },
    {
      id: 'files',
      label: 'Files',
      title: fileViewExpensive
        ? `Detailed file view (${fileCount} files — may be slow)`
        : `Detailed file view (${fileCount} files)`,
    },
  ];

  return (
    <div style={S.layoutPicker} role="group" aria-label="Graph detail level">
      {options.map((o) => (
        <button
          key={o.id}
          style={{ ...S.layoutBtn, ...(mode === o.id ? S.layoutBtnActive : {}) }}
          onClick={() => onChange(o.id)}
          title={o.title}
          aria-pressed={mode === o.id}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
