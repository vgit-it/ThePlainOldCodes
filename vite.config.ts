import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { type Plugin, defineConfig, normalizePath } from 'vite';
import { formatFile, problems } from './src/recipes/library';

// The recipe lab's save (docs/RECIPE-LAB.md): on the dev server only, /__recipes/licks reads the lick library and
// writes it back (checked first), so the lab on Paul's PC saves straight into the repo. The lab keeps its own copy
// while it runs, so a save from it doesn't reload the page.
function recipeSave(): Plugin {
  const file = resolve(__dirname, 'src/recipes/licks.json');
  let savedAt = 0;
  return {
    name: 'recipe-lab-save',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__recipes/licks', (req, res) => {
        const reply = (code: number, body: unknown) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(body)); };
        if (req.method === 'GET') { res.setHeader('content-type', 'application/json'); res.end(readFileSync(file, 'utf8')); return; }
        // only the lab itself (a page on another site can't send this header without asking first)
        if (req.method !== 'POST' || req.headers['x-recipe-lab'] !== '1') { reply(403, { problems: ['not allowed'] }); return; }
        let body = '';
        req.on('data', (c) => { body += c; });
        req.on('end', () => {
          try {
            const f = JSON.parse(body);
            const p = problems(f);
            if (p.length) { reply(400, { problems: p }); return; }
            savedAt = Date.now();
            writeFileSync(file, formatFile(f));
            reply(200, { count: f.licks.length });
          } catch (e) { reply(400, { problems: [(e as Error).message] }); }
        });
      });
    },
    handleHotUpdate(ctx) {
      if (ctx.file === normalizePath(file) && Date.now() - savedAt < 3000) return [];
    },
  };
}

// Relative base so the build works on GitHub Pages under any repo name.
// Pages: the generator, the band view (opened from its Band link), the lick lab (/lick-lab.html, not linked) and the riff lab (/riff-lab.html, not linked).
// The recipe lab (/recipe-lab.html) is for the dev server only (npm run recipe-lab), so it isn't built.
export default defineConfig({
  base: './',
  plugins: [recipeSave()],
  build: {
    rollupOptions: {
      input: { main: resolve(__dirname, 'index.html'), band: resolve(__dirname, 'band.html'), lickLab: resolve(__dirname, 'lick-lab.html'), riffLab: resolve(__dirname, 'riff-lab.html') },
    },
  },
});
