/**
 * Shared icon library.
 *
 * All inline SVG icons used across the webviews live here. Keeping them in one
 * place makes it trivial to keep visual weight (stroke width, viewBox, etc.)
 * consistent.
 */
import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

const baseSvgProps = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});

export function GraphIcon({ size = 12, ...rest }: IconProps): React.ReactElement {
  return (
    <svg {...baseSvgProps(size)} strokeWidth={2.2} {...rest}>
      <circle cx="12" cy="12" r="3" />
      <circle cx="4" cy="6" r="2" />
      <circle cx="20" cy="6" r="2" />
      <circle cx="4" cy="18" r="2" />
      <circle cx="20" cy="18" r="2" />
      <line x1="6" y1="7" x2="10" y2="11" />
      <line x1="18" y1="7" x2="14" y2="11" />
      <line x1="6" y1="17" x2="10" y2="13" />
      <line x1="18" y1="17" x2="14" y2="13" />
    </svg>
  );
}

export function SearchIcon({ size = 11, ...rest }: IconProps): React.ReactElement {
  return (
    <svg {...baseSvgProps(size)} strokeWidth={2.5} {...rest}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export function PlusIcon({ size = 14, ...rest }: IconProps): React.ReactElement {
  return (
    <svg {...baseSvgProps(size)} {...rest}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function MinusIcon({ size = 14, ...rest }: IconProps): React.ReactElement {
  return (
    <svg {...baseSvgProps(size)} {...rest}>
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function FitIcon({ size = 14, ...rest }: IconProps): React.ReactElement {
  return (
    <svg {...baseSvgProps(size)} {...rest}>
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}
