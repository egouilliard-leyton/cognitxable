import * as fs from 'fs/promises';
import * as path from 'path';

async function writeFileIfMissing(filePath: string, contents: string) {
  try {
    await fs.access(filePath);
    return;
  } catch {
    // continue
  }
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, contents, 'utf8');
}

export async function scaffoldLeytongoMonorepo(
  projectPath: string,
  projectId: string
) {
  await fs.mkdir(projectPath, { recursive: true });

  const rootPackageJson = {
    name: projectId,
    private: true,
    version: '0.1.0',
    workspaces: ['leytongo-front', 'leytongo-back'],
    scripts: {
      predev:
        'npm --prefix ./leytongo-front install && npm --prefix ./leytongo-back install',
      dev: 'node scripts/claudable-preview.mjs',
    },
  };

  await writeFileIfMissing(
    path.join(projectPath, 'package.json'),
    JSON.stringify(rootPackageJson, null, 2) + '\n'
  );

  await fs.mkdir(path.join(projectPath, 'leytongo-front'), { recursive: true });
  await fs.mkdir(path.join(projectPath, 'leytongo-back'), { recursive: true });
  await fs.mkdir(path.join(projectPath, 'devops'), { recursive: true });

  const frontPackageJson = {
    name: projectId + '-front',
    private: true,
    version: '0.1.0',
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'vite build',
      preview: 'vite preview',
    },
    dependencies: {
      react: '^19.0.0',
      'react-dom': '^19.0.0',
    },
    devDependencies: {
      '@types/react': '^19.0.0',
      '@types/react-dom': '^19.0.0',
      '@vitejs/plugin-react': '^4.3.4',
      typescript: '^5.7.2',
      vite: '^5.4.10',
    },
  };

  const backPackageJson = {
    name: projectId + '-back',
    private: true,
    version: '0.1.0',
    type: 'module',
    scripts: {
      dev: 'tsx watch src/index.ts',
      build: 'tsc -p tsconfig.json',
      start: 'node dist/index.js',
    },
    dependencies: {
      fastify: '^4.28.1',
      '@fastify/cors': '^9.0.1',
    },
    devDependencies: {
      '@types/node': '^22.10.0',
      typescript: '^5.7.2',
      tsx: '^4.19.2',
    },
  };

  await writeFileIfMissing(
    path.join(projectPath, 'leytongo-front/package.json'),
    JSON.stringify(frontPackageJson, null, 2) + '\n'
  );
  await writeFileIfMissing(
    path.join(projectPath, 'leytongo-back/package.json'),
    JSON.stringify(backPackageJson, null, 2) + '\n'
  );

  const previewRunner = [
    "import { spawn } from 'node:child_process';",
    "import net from 'node:net';",
    '',
    'function findArgValue(flag) {',
    '  const idx = process.argv.indexOf(flag);',
    '  if (idx === -1) return null;',
    '  const val = process.argv[idx + 1];',
    "  if (!val || val.startsWith('-')) return null;",
    '  return val;',
    '}',
    '',
    'async function isPortFree(port, host) {',
    "  const targetHost = host || '127.0.0.1';",
    '  return await new Promise((resolve) => {',
    '    const tester = net',
    '      .createServer()',
    "      .once('error', () => resolve(false))",
    "      .once('listening', () => {",
    '        tester.close(() => resolve(true));',
    '      })',
    '      .listen(port, targetHost);',
    '  });',
    '}',
    '',
    'async function pickBackendPort(frontPort) {',
    '  const preferred = frontPort + 1;',
    "  if (await isPortFree(preferred, '127.0.0.1')) return preferred;",
    '  for (let candidate = frontPort + 2; candidate <= frontPort + 25; candidate += 1) {',
    '    // eslint-disable-next-line no-await-in-loop',
    "    if (await isPortFree(candidate, '127.0.0.1')) return candidate;",
    '  }',
    '  return 3000; // last resort',
    '}',
    '',
    "const frontPortFromArgs = findArgValue('--port') ?? findArgValue('-p');",
    "const frontPortParsed = Number.parseInt(frontPortFromArgs ?? process.env.PORT ?? '5173', 10);",
    'const frontPort = Number.isFinite(frontPortParsed) && frontPortParsed > 0 ? frontPortParsed : 5173;',
    "const previewUrl = 'http://localhost:' + String(frontPort);",
    '',
    'const backendPort = await pickBackendPort(frontPort);',
    '',
    "const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';",
    '',
    'let backendExited = false;',
    "const backend = spawn(npmCmd, ['run', 'dev'], {",
    "  cwd: new URL('../leytongo-back', import.meta.url),",
    '  env: {',
    '    ...process.env,',
    '    PORT: String(backendPort),',
    "    HOST: '127.0.0.1',",
    "    API_PREFIX: '/api/v1',",
    '    CORS_ORIGIN: previewUrl,',
    '  },',
    "  stdio: 'inherit',",
    "  shell: process.platform === 'win32',",
    '});',
    '',
    "backend.on('exit', (code, signal) => {",
    '  backendExited = true;',
    "  const reason = 'code=' + String(code ?? 'null') + ' signal=' + String(signal ?? 'null');",
    "  console.error('[ClaudablePreview] BACKEND_EXITED (' + reason + '). Frontend preview will continue.');",
    '});',
    '',
    "backend.on('error', (err) => {",
    '  backendExited = true;',
    "  console.error('[ClaudablePreview] BACKEND_START_FAILED: ' + (err && err.message ? err.message : String(err)));",
    '});',
    '',
    'const front = spawn(',
    '  npmCmd,',
    "  ['run', 'dev', '--', '--port', String(frontPort), '--host', '127.0.0.1'],",
    '  {',
    "    cwd: new URL('../leytongo-front', import.meta.url),",
    '    env: {',
    '      ...process.env,',
    '      PORT: String(frontPort),',
    '      WEB_PORT: String(frontPort),',
    '      BACKEND_PORT: String(backendPort),',
    '      VITE_BACKEND_API_URL: previewUrl,',
    "      VITE_BACKEND_API_PREFIX: '/api/v1',",
    "      VITE_USE_BACKEND_WORKFLOWS: 'true',",
    '    },',
    "    stdio: 'inherit',",
    "    shell: process.platform === 'win32',",
    '  }',
    ');',
    '',
    'function shutdown(signal) {',
    '  try {',
    '    if (!backendExited) backend.kill(signal);',
    '  } catch {',
    '    // ignore',
    '  }',
    '  try {',
    '    front.kill(signal);',
    '  } catch {',
    '    // ignore',
    '  }',
    '}',
    '',
    "process.on('SIGINT', () => shutdown('SIGINT'));",
    "process.on('SIGTERM', () => shutdown('SIGTERM'));",
    '',
    "front.on('exit', (code) => {",
    "  shutdown('SIGTERM');",
    '  process.exit(code ?? 0);',
    '});',
    '',
  ].join('\n');

  await writeFileIfMissing(
    path.join(projectPath, 'scripts/claudable-preview.mjs'),
    previewRunner + '\n'
  );

  await writeFileIfMissing(
    path.join(projectPath, 'leytongo-front/index.html'),
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Welcome</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`
  );

  await writeFileIfMissing(
    path.join(projectPath, 'leytongo-front/vite.config.ts'),
    `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function parsePort(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

const apiPrefix = process.env.VITE_BACKEND_API_PREFIX || '/api/v1';
const backendPort = parsePort(process.env.BACKEND_PORT);
const target = backendPort ? \`http://127.0.0.1:\${backendPort}\` : null;

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: target
      ? {
          [apiPrefix]: {
            target,
            changeOrigin: true,
            secure: false,
          },
        }
      : undefined,
  },
});
`
  );

  await writeFileIfMissing(
    path.join(projectPath, 'leytongo-front/tsconfig.json'),
    `{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "types": ["vite/client"]
  },
  "include": ["src", "vite-env.d.ts"]
}
`
  );

  await writeFileIfMissing(
    path.join(projectPath, 'leytongo-front/vite-env.d.ts'),
    `/// <reference types="vite/client" />
`
  );

  await writeFileIfMissing(
    path.join(projectPath, 'leytongo-front/src/main.tsx'),
    `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
`
  );

  await writeFileIfMissing(
    path.join(projectPath, 'leytongo-front/src/App.tsx'),
    `import { useState } from 'react';

type HealthResponse =
  | { ok: true; [key: string]: unknown }
  | { ok: false; error?: string; [key: string]: unknown };

export default function App() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function checkHealth() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/health', {
        headers: { accept: 'application/json' },
      });
      const text = await res.text();
      const parsed: unknown = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;

      if (!res.ok) {
        setResult(null);
        setError(
          \`Health check failed: \${res.status} \${res.statusText || ''}\`.trim()
        );
        return;
      }

      setResult((parsed ?? { ok: true }) as HealthResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <header className="header">
        <h1 className="title">Welcome to your new project</h1>
        <p className="subtitle">
          Your preview is running. You can now start building your frontend and backend.
        </p>
      </header>

      <section className="card">
        <h2 className="cardTitle">Backend connectivity</h2>
        <p className="cardBody">
          The frontend proxies <code>/api/v1</code> requests to the backend sidecar.
          Use the button below to call <code>/api/v1/health</code>.
        </p>

        <div className="row">
          <button className="button" onClick={checkHealth} disabled={loading}>
            {loading ? 'Checking…' : 'Check /api/v1/health'}
          </button>
          <a className="link" href="/api/v1/health" target="_blank" rel="noreferrer">
            Open health endpoint
          </a>
        </div>

        {error ? (
          <pre className="output error">Error: {error}</pre>
        ) : result ? (
          <pre className="output">{JSON.stringify(result, null, 2)}</pre>
        ) : (
          <pre className="output hint">Health check not run yet.</pre>
        )}
      </section>
    </div>
  );
}
`
  );

  await writeFileIfMissing(
    path.join(projectPath, 'leytongo-front/src/index.css'),
    `:root {
  color-scheme: light;
  --bg: #0b1020;
  --panel: rgba(255, 255, 255, 0.08);
  --text: rgba(255, 255, 255, 0.92);
  --muted: rgba(255, 255, 255, 0.65);
  --border: rgba(255, 255, 255, 0.14);
  --accent: #7c5cff;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto,
    Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji';
  background: radial-gradient(1200px circle at 20% 10%, #1a2457, transparent 60%),
    radial-gradient(900px circle at 70% 30%, #2b1b5f, transparent 60%), var(--bg);
  color: var(--text);
}

code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    'Liberation Mono', 'Courier New', monospace;
}

.page {
  max-width: 920px;
  margin: 0 auto;
  padding: 48px 20px;
}

.header {
  margin-bottom: 20px;
}

.title {
  margin: 0 0 10px;
  font-size: 40px;
  letter-spacing: -0.02em;
}

.subtitle {
  margin: 0;
  color: var(--muted);
  line-height: 1.55;
}

.card {
  border: 1px solid var(--border);
  background: var(--panel);
  border-radius: 16px;
  padding: 18px;
  backdrop-filter: blur(10px);
}

.cardTitle {
  margin: 0 0 8px;
  font-size: 18px;
}

.cardBody {
  margin: 0 0 14px;
  color: var(--muted);
  line-height: 1.55;
}

.row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.button {
  appearance: none;
  border: 1px solid rgba(124, 92, 255, 0.55);
  background: rgba(124, 92, 255, 0.22);
  color: var(--text);
  padding: 10px 14px;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 600;
}

.button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.link {
  color: var(--text);
  text-decoration: none;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.35);
}

.output {
  margin: 0;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.25);
  overflow: auto;
  white-space: pre-wrap;
}

.output.hint {
  color: rgba(255, 255, 255, 0.55);
}

.output.error {
  color: #ffd2d2;
  border-color: rgba(255, 80, 80, 0.35);
  background: rgba(255, 80, 80, 0.08);
}
`
  );

  await writeFileIfMissing(
    path.join(projectPath, 'leytongo-back/tsconfig.json'),
    `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": "src",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "types": ["node"]
  },
  "include": ["src"]
}
`
  );

  await writeFileIfMissing(
    path.join(projectPath, 'leytongo-back/src/index.ts'),
    `import Fastify from 'fastify';
import cors from '@fastify/cors';

function parsePort(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3000;
}

const port = parsePort(process.env.PORT);
const host = process.env.HOST ?? '127.0.0.1';
const apiPrefix = process.env.API_PREFIX ?? '/api/v1';
const corsOrigin = process.env.CORS_ORIGIN;

const app = Fastify({
  logger: true,
});

await app.register(cors, {
  origin: corsOrigin ? [corsOrigin] : true,
});

app.get(\`\${apiPrefix}/health\`, async () => {
  return {
    ok: true,
    service: 'backend',
    time: new Date().toISOString(),
  };
});

app.get('/', async () => {
  return { ok: true, message: 'Backend running' };
});

try {
  await app.listen({ port, host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
`
  );

  const previewMd = [
    '# How To Run This Monorepo in Claudable Preview',
    '',
    'This project is a monorepo with:',
    '- `leytongo-front/` (Vite + React + TypeScript frontend)',
    '- `leytongo-back/` (Fastify + TypeScript backend)',
    '- `devops/` (place for infra files)',
    '',
    'Claudable Preview expects a single `npm run dev` at the project root. This repo provides that and starts both frontend + backend automatically.',
    '',
    '## What Claudable Starts',
    '',
    'When you click Preview (or Claudable starts a preview automatically), Claudable runs:',
    '',
    '1. `npm run predev` (root)',
    '2. `npm run dev -- --port <assignedPort>` (root)',
    '',
    'In this repo:',
    '- predev installs dependencies for both apps:',
    '  - `npm --prefix leytongo-front install`',
    '  - `npm --prefix leytongo-back install`',
    '- dev starts:',
    '  - the backend on an internal sidecar port',
    '  - the frontend on the Claudable-assigned preview port',
    '',
    '## How Frontend and Backend Communication Works',
    '',
    'Claudable preview uses one URL (the frontend preview URL).',
    '',
    '- The browser only talks to the frontend preview URL.',
    '- The frontend calls the backend using the same origin (example: `/api/v1/health`).',
    '- Vite proxies API requests to the backend sidecar:',
    '  - Requests to `http://localhost:<frontendPort>/api/v1/...` are proxied to `http://127.0.0.1:<backendPort>/api/v1/...`.',
    '',
    'This avoids CORS issues and keeps the browser talking to a single URL.',
    '',
    '## Ports Used',
    '',
    '- Frontend port: provided by Claudable via `--port` (example: 3103)',
    '- Backend port: chosen automatically as `frontendPort + 1` (or the next free port)',
    '',
    '## Quick Checks',
    '',
    '- Frontend page: `http://localhost:<frontendPort>/`',
    '- Backend health (via proxy): `http://localhost:<frontendPort>/api/v1/health`',
    '',
  ].join('\n');

  await writeFileIfMissing(
    path.join(projectPath, 'CLAUDABLE_PREVIEW.md'),
    previewMd + '\n'
  );
}

export async function scaffoldBasicNextApp(
  projectPath: string,
  projectId: string
) {
  await fs.mkdir(projectPath, { recursive: true });

  const packageJson = {
    name: projectId,
    private: true,
    version: '0.1.0',
    scripts: {
      dev: 'node scripts/run-dev.js',
      build: 'next build',
      start: 'next start',
      lint: 'next lint',
    },
    dependencies: {
      next: '15.1.0',
      react: '19.0.0',
      'react-dom': '19.0.0',
    },
    devDependencies: {
      typescript: '^5.7.2',
      '@types/react': '^19.0.0',
      '@types/node': '^22.10.0',
      eslint: '^9.17.0',
      'eslint-config-next': '15.1.0',
    },
  };

  await writeFileIfMissing(
    path.join(projectPath, 'package.json'),
    JSON.stringify(packageJson, null, 2) + '\n'
  );

  await writeFileIfMissing(
    path.join(projectPath, 'next.config.js'),
    `/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true,
  },
};

module.exports = nextConfig;
`
  );

  await writeFileIfMissing(
    path.join(projectPath, 'tsconfig.json'),
    `{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
`
  );

  await writeFileIfMissing(
    path.join(projectPath, 'next-env.d.ts'),
    `/// <reference types="next" />
/// <reference types="next/navigation-types/navigation" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/basic-features/typescript for more information.
`
  );

  await writeFileIfMissing(
    path.join(projectPath, 'app/layout.tsx'),
    `import type { ReactNode } from 'react';
import './globals.css';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
}
`
  );

  await writeFileIfMissing(
    path.join(projectPath, 'app/page.tsx'),
    `export default function Home() {
  return (
    <div style={{
      display: 'grid',
      gridTemplateRows: '20px 1fr 20px',
      alignItems: 'center',
      justifyItems: 'center',
      minHeight: '100vh',
      padding: '80px',
      gap: '64px',
      fontFamily: 'var(--font-geist-sans)',
    }}>
      <main style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '32px',
        gridRow: 2,
        alignItems: 'center',
      }}>
        <h1 style={{
          fontSize: '3rem',
          fontWeight: 600,
          textAlign: 'center',
        }}>
          Get started by editing
        </h1>
        <code style={{
          fontFamily: 'monospace',
          fontSize: '1rem',
          padding: '12px 20px',
          background: 'rgba(0, 0, 0, 0.05)',
          borderRadius: '8px',
        }}>
          app/page.tsx
        </code>
      </main>
      <footer style={{
        gridRow: 3,
        display: 'flex',
        gap: '24px',
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}>
        <a
          href="https://nextjs.org/learn"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          Learn →
        </a>
        <a
          href="https://vercel.com/templates"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          Examples →
        </a>
        <a
          href="https://nextjs.org"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          Next.js →
        </a>
      </footer>
    </div>
  );
}
`
  );

  await writeFileIfMissing(
    path.join(projectPath, 'app/globals.css'),
    `:root {
  color-scheme: light;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
}
`
  );

  await writeFileIfMissing(
    path.join(projectPath, 'scripts/run-dev.js'),
    `#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const isWindows = process.platform === 'win32';

function parseCliArgs(argv) {
  const passthrough = [];
  let preferredPort;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--port' || arg === '-p') {
      const value = argv[i + 1];
      if (value && !value.startsWith('-')) {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isNaN(parsed)) {
          preferredPort = parsed;
        }
        i += 1;
        continue;
      }
    } else if (arg.startsWith('--port=')) {
      const value = arg.slice('--port='.length);
      const parsed = Number.parseInt(value, 10);
      if (!Number.isNaN(parsed)) {
        preferredPort = parsed;
      }
      continue;
    } else if (arg.startsWith('-p=')) {
      const value = arg.slice('-p='.length);
      const parsed = Number.parseInt(value, 10);
      if (!Number.isNaN(parsed)) {
        preferredPort = parsed;
      }
      continue;
    }

    passthrough.push(arg);
  }

  return { preferredPort, passthrough };
}

function resolvePort(preferredPort) {
  const candidates = [
    preferredPort,
    process.env.PORT,
    process.env.WEB_PORT,
    process.env.PREVIEW_PORT_START,
    3100,
  ];

  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null) {
      continue;
    }

    const numeric =
      typeof candidate === 'number'
        ? candidate
        : Number.parseInt(String(candidate), 10);

    if (!Number.isNaN(numeric) && numeric > 0 && numeric <= 65535) {
      return numeric;
    }
  }

  return 3100;
}

(async () => {
  const argv = process.argv.slice(2);
  const { preferredPort, passthrough } = parseCliArgs(argv);
  const port = resolvePort(preferredPort);
  const url =
    process.env.NEXT_PUBLIC_APP_URL || \`http://localhost:\${port}\`;

  process.env.PORT = String(port);
  process.env.WEB_PORT = String(port);
  process.env.NEXT_PUBLIC_APP_URL = url;

  console.log(\`🚀 Starting Next.js dev server on \${url}\`);

  const child = spawn(
    'npx',
    ['next', 'dev', '--port', String(port), ...passthrough],
    {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: isWindows,
      env: {
        ...process.env,
        PORT: String(port),
        WEB_PORT: String(port),
        NEXT_PUBLIC_APP_URL: url,
        NEXT_TELEMETRY_DISABLED: '1',
      },
    }
  );

  child.on('exit', (code) => {
    if (typeof code === 'number' && code !== 0) {
      console.error(\`❌ Next.js dev server exited with code \${code}\`);
      process.exit(code);
    }
  });

  child.on('error', (error) => {
    console.error('❌ Failed to start Next.js dev server');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
})();
`
  );
}
