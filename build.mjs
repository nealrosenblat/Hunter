// Bundles the game into a single self-contained HTML file: dist/hammer-and-delgado.html
// Usage: npm run build
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const result = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2020',
  write: false,
  legalComments: 'none',
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync('style.css', 'utf8');
const html = readFileSync('index.html', 'utf8')
  .replace(/<link rel="stylesheet" href="style.css">/, () => `<style>\n${css}\n</style>`)
  .replace(/<link rel="(manifest|apple-touch-icon|icon)"[^>]*>\n?/g, '')
  .replace(/<script type="importmap">[\s\S]*?<\/script>\n?/, '')
  .replace(/<script type="module" src="src\/main.js"><\/script>/, () => `<script type="module">\n${js}\n</script>`);
mkdirSync('dist', { recursive: true });
writeFileSync('dist/hammer-and-delgado.html', html);
console.log(`dist/hammer-and-delgado.html  ${(html.length / 1024).toFixed(0)} KB`);

// Same game as a page fragment (no doctype/html/head/body) for hosts that supply their own skeleton.
const fragment = html
  .replace(/<!doctype html>\s*/i, '')
  .replace(/<\/?html[^>]*>\s*/gi, '')
  .replace(/<\/?head>\s*/gi, '')
  .replace(/<\/?body>\s*/gi, '')
  .replace(/<meta charset="utf-8">\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '');
writeFileSync('dist/fragment.html', fragment);
console.log(`dist/fragment.html  ${(fragment.length / 1024).toFixed(0)} KB`);
