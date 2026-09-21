import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

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
const legacyConsultationReferences: string[] = [];
const staleContractArtifacts: string[] = [];
const invalidModuleTopology: string[] = [];
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
    const normalizedPath = path.replaceAll('\\', '/');
    if (
      !normalizedPath.endsWith('.spec.ts') &&
      !normalizedPath.includes('/database/migrations/') &&
      !normalizedPath.endsWith('/scripts/check-backend-boundary.ts') &&
      /modules[\\/]sessions|doctorSessionId|legacyAiSessionId|legacySourceKey|Sessions(?:Module|Service|Controller|Gateway)|LEGACY_SESSION_API_ENABLED/.test(
        content,
      )
    ) {
      legacyConsultationReferences.push(path);
    }
  }
}

inspectDirectory(join(apiRoot, 'src'));

const modulesRoot = join(apiRoot, 'src', 'modules');
const allowedBoundedContexts = new Set([
  'administration',
  'ai-advisory',
  'authentication',
  'billing',
  'consultations',
  'doctors',
  'health-tracking',
  'moderation',
  'notifications',
  'users',
]);
const allowedContextModuleFiles = new Set([
  'administration/administration.module.ts',
  'ai-advisory/ai-advisory.module.ts',
  'authentication/authentication.module.ts',
  'billing/billing.module.ts',
  'consultations/consultations.module.ts',
  'doctors/doctors.module.ts',
  'health-tracking/health-tracking.module.ts',
  'moderation/moderation.module.ts',
  'notifications/notifications.module.ts',
  'users/users.module.ts',
]);

for (const entry of readdirSync(modulesRoot, { withFileTypes: true })) {
  if (entry.isDirectory() && !allowedBoundedContexts.has(entry.name)) {
    invalidModuleTopology.push(join(modulesRoot, entry.name));
  }
}

function inspectContextModuleFiles(directory: string): void {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      inspectContextModuleFiles(path);
      continue;
    }
    if (!entry.name.endsWith('.module.ts')) continue;
    const modulePath = relative(modulesRoot, path).replaceAll('\\', '/');
    if (!allowedContextModuleFiles.has(modulePath)) {
      invalidModuleTopology.push(path);
    }
  }
}
inspectContextModuleFiles(modulesRoot);

if (invalidModuleTopology.length > 0) {
  throw new Error(
    `Backend module topology contains collection-level/legacy modules: ${invalidModuleTopology.join(', ')}`,
  );
}

if (forbiddenImports.length > 0) {
  throw new Error(
    `Backend source crosses the repository boundary: ${forbiddenImports.join(', ')}`,
  );
}

if (existsSync(join(apiRoot, 'src', 'modules', 'sessions'))) {
  legacyConsultationReferences.push(
    join(apiRoot, 'src', 'modules', 'sessions'),
  );
}
if (legacyConsultationReferences.length > 0) {
  throw new Error(
    `Canonical source still contains legacy consultation references: ${legacyConsultationReferences.join(', ')}`,
  );
}

for (const artifact of [
  join(apiRoot, 'openapi', 'openapi.json'),
  join(apiRoot, 'contracts', 'realtime-events.json'),
]) {
  if (
    existsSync(artifact) &&
    /doctorSessionId|LEGACY_SESSION_API_ENABLED|join_session|leave_session|get_session_messages|\/api\/v1\/(?:sessions|admin\/sessions|chat\/session|reviews\/session)/.test(
      readFileSync(artifact, 'utf8'),
    )
  ) {
    staleContractArtifacts.push(artifact);
  }
}
for (const stalePostmanCollection of [
  'Healthcare-API-Complete.postman_collection.json',
  'QUICK-SETUP-TESTS.postman_collection.json',
]) {
  const path = join(apiRoot, stalePostmanCollection);
  if (existsSync(path)) staleContractArtifacts.push(path);
}
if (staleContractArtifacts.length > 0) {
  throw new Error(
    `Canonical contract artifacts still expose legacy APIs: ${staleContractArtifacts.join(', ')}`,
  );
}

console.log('Backend boundary check passed');
