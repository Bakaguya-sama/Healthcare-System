import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const apiRoot = resolve(process.cwd());
const packageJson = JSON.parse(
  readFileSync(join(apiRoot, 'package.json'), 'utf8'),
) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
const dependencies = {
  ...packageJson.dependencies,
  ...packageJson.devDependencies,
};
const workspaceDependencies = Object.entries(dependencies).filter(([, value]) =>
  value.startsWith('workspace:'),
);
if (workspaceDependencies.length > 0) {
  throw new Error(
    `Backend has workspace dependencies: ${workspaceDependencies.map(([name]) => name).join(', ')}`,
  );
}

const forbiddenImports: string[] = [];
function inspectDirectory(directory: string): void {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      inspectDirectory(path);
      continue;
    }
    if (!entry.name.endsWith('.ts')) continue;
    const content = readFileSync(path, 'utf8');
    if (
      /apps[\\/](?:client|admin)|(?:client|admin)[\\/]src|@repo\//.test(content)
    ) {
      forbiddenImports.push(path);
    }
  }
}

inspectDirectory(join(apiRoot, 'src'));
if (forbiddenImports.length > 0) {
  throw new Error(
    `Backend source crosses the repository boundary: ${forbiddenImports.join(', ')}`,
  );
}

console.log('Backend boundary check passed');
