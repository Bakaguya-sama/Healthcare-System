import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { OpenAPIObject } from '@nestjs/swagger';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppModule } from '../app.module';
import { configureApplication } from '../bootstrap/configure-application';
import { createOpenApiDocument } from '../core/openapi/openapi';

const artifactPath = resolve(process.cwd(), 'openapi/openapi.json');

function collectRemovedOperations(
  baseline: OpenAPIObject,
  candidate: OpenAPIObject,
): string[] {
  const removed: string[] = [];
  for (const [path, pathItem] of Object.entries(baseline.paths)) {
    const candidatePath = candidate.paths[path];
    if (!candidatePath) {
      removed.push(path);
      continue;
    }
    for (const method of Object.keys(pathItem ?? {})) {
      if (method === 'parameters' || method === '$ref') continue;
      if (!(method in candidatePath))
        removed.push(`${method.toUpperCase()} ${path}`);
    }
  }
  return removed;
}

async function generateDocument(): Promise<OpenAPIObject> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    logger: false,
  });
  try {
    configureApplication(app, app.get(ConfigService), {
      mountSwagger: false,
      useWebSocketAdapter: false,
    });
    return createOpenApiDocument(app);
  } finally {
    await app.close();
  }
}

async function main(): Promise<void> {
  const candidate = await generateDocument();
  const serialized = `${JSON.stringify(candidate, null, 2)}\n`;
  const check = process.argv.includes('--check');

  if (!check) {
    mkdirSync(resolve(process.cwd(), 'openapi'), { recursive: true });
    writeFileSync(artifactPath, serialized, 'utf8');
    return;
  }
  if (!existsSync(artifactPath)) {
    throw new Error('OpenAPI baseline is missing; run openapi:generate');
  }

  const baselineText = readFileSync(artifactPath, 'utf8');
  const baseline = JSON.parse(baselineText) as OpenAPIObject;
  const removed = collectRemovedOperations(baseline, candidate);
  if (removed.length > 0) {
    throw new Error(`Breaking OpenAPI changes detected: ${removed.join(', ')}`);
  }
  if (baselineText !== serialized) {
    throw new Error(
      'OpenAPI artifact is stale; inspect the diff and run openapi:generate',
    );
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
