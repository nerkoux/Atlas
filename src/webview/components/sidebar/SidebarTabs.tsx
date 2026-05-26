import React from 'react';
import { sidebarStyles as S } from './styles';

export type SidebarTab = 'systems' | 'violations' | 'dead';

interface Props {
  active: SidebarTab;
  onChange: (tab: SidebarTab) => void;
  violationCount: number;
  deadCount: number;
}

export function SidebarTabs({
  active,
  onChange,
  violationCount,
  deadCount,
}: Props): React.ReactElement {
  return (
    <div style={S.tabBar} role="tablist" aria-label="Explorer sections">
      <TabBtn id="systems" active={active === 'systems'} onClick={() => onChange('systems')}>
        Systems
      </TabBtn>
      <TabBtn
        id="violations"
        active={active === 'violations'}
        onClick={() => onChange('violations')}
        badge={violationCount}
      >
        Issues
      </TabBtn>
      <TabBtn id="dead" active={active === 'dead'} onClick={() => onChange('dead')} badge={deadCount}>
        Dead
      </TabBtn>
    </div>
  );
}

function TabBtn({
  id,
  active,
  onClick,
  children,
  badge,
}: {
  id: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  badge?: number;
}): React.ReactElement {
  return (
    <button
      id={`tab-${id}`}
      role="tab"
      aria-selected={active}
      aria-controls={`panel-${id}`}
      style={{ ...S.tabBtn, ...(active ? S.tabBtnActive : {}) }}
      onClick={onClick}
      tabIndex={active ? 0 : -1}
    >
      {children}
      {badge !== undefined && badge > 0 && (
        <span style={S.tabBadge} aria-label={`${badge} items`}>
          {badge}
        </span>
      )}
    </button>
  );
}
