import React from 'react';
import { createRoot } from 'react-dom/client';
import { GraphApp } from './GraphApp';

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<GraphApp />);
}
