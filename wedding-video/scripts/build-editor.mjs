// Bundle the editor (React + Remotion Player + the same composition used for renders).
import { build } from 'esbuild';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
await build({
  entryPoints: [path.join(root, 'editor/main.jsx')],
  outfile: path.join(root, 'dist/editor.js'),
  bundle: true, minify: true, sourcemap: true, format: 'iife', target: ['es2020'],
  jsx: 'automatic', loader: { '.js': 'jsx' },
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'info',
});
