import React from 'react';

declare global {
  interface Window {
    __ATLAS_LOGO__?: string;
  }
}

interface Props {
  size?: number;
  alt?: string;
  style?: React.CSSProperties;
}

/**
 * Atlas brand logo. Loads from a URI injected by the extension into the webview HTML.
 * Falls back to a hexagon if for any reason the URI is unavailable.
 */
export function Logo({ size = 18, alt = 'Atlas', style }: Props): React.ReactElement {
  const src = typeof window !== 'undefined' ? window.__ATLAS_LOGO__ : undefined;

  if (!src) {
    return (
      <span
        aria-hidden="true"
        style={{ fontSize: `${size}px`, color: 'var(--vscode-focusBorder)', lineHeight: 1, ...style }}
      >
        ⬡
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      draggable={false}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        objectFit: 'contain',
        userSelect: 'none',
        flexShrink: 0,
        ...style,
      }}
    />
  );
}
