const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const vendors = [
  {
    src: path.join(__dirname, '..', 'node_modules', 'cytoscape', 'dist', 'cytoscape.min.js'),
    dest: path.join(distDir, 'cytoscape.min.js'),
  },
  {
    src: path.join(__dirname, '..', 'node_modules', 'dagre', 'dist', 'dagre.min.js'),
    dest: path.join(distDir, 'dagre.min.js'),
  },
  {
    src: path.join(__dirname, '..', 'node_modules', 'cytoscape-dagre', 'cytoscape-dagre.js'),
    dest: path.join(distDir, 'cytoscape-dagre.min.js'),
  },
  {
    src: path.join(__dirname, '..', 'node_modules', 'cytoscape-cose-bilkent', 'cytoscape-cose-bilkent.js'),
    dest: path.join(distDir, 'cytoscape-cose-bilkent.min.js'),
  },
];

for (const { src, dest } of vendors) {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied: ${path.basename(dest)}`);
  } else {
    console.warn(`Warning: vendor not found at ${src}`);
  }
}
