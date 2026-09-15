const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const repoRoot = path.resolve(__dirname, "..");
const sourceRoot = path.join(repoRoot, "apps", "api", "src");
const outputFile = path.join(
  repoRoot,
  "docs",
  "current-state",
  "openapi-baseline.json",
);
const postmanOutputFile = path.join(
  repoRoot,
  "docs",
  "current-state",
  "postman-baseline.collection.json",
);

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(entryPath) : [entryPath];
  });
}

function decorators(node) {
  return ts.canHaveDecorators(node) ? (ts.getDecorators(node) ?? []) : [];
}

function decoratorName(decorator) {
  const expression = decorator.expression;
  const target = ts.isCallExpression(expression)
    ? expression.expression
    : expression;
  return ts.isIdentifier(target) ? target.text : target.getText();
}

function decoratorArgs(decorator) {
  return ts.isCallExpression(decorator.expression)
    ? [...decorator.expression.arguments]
    : [];
}

function stringValue(node) {
  if (!node) return "";
  if (
    ts.isStringLiteralLike(node) ||
    ts.isNoSubstitutionTemplateLiteral(node)
  ) {
    return node.text;
  }
  return node.getText().replace(/^['"`]|['"`]$/g, "");
}

function findDecorator(node, name) {
  return decorators(node).find(
    (decorator) => decoratorName(decorator) === name,
  );
}

function decoratorValues(node, name) {
  const decorator = findDecorator(node, name);
  return decorator ? decoratorArgs(decorator).map(stringValue) : [];
}

function readSummary(method) {
  const decorator = findDecorator(method, "ApiOperation");
  const object = decorator && decoratorArgs(decorator)[0];
  if (!object || !ts.isObjectLiteralExpression(object)) return undefined;
  const summary = object.properties.find(
    (property) =>
      ts.isPropertyAssignment(property) &&
      property.name.getText().replace(/['"]/g, "") === "summary",
  );
  return summary && ts.isPropertyAssignment(summary)
    ? stringValue(summary.initializer)
    : undefined;
}

function parameterContract(method) {
  const contract = {};
  for (const parameter of method.parameters) {
    const type = parameter.type?.getText();
    for (const decorator of decorators(parameter)) {
      const name = decoratorName(decorator);
      if (name === "Body" && type) contract.bodyDto = type;
      if (name === "Query" && type && type !== "string" && type !== "number") {
        contract.queryDto = type;
      }
    }
  }
  return contract;
}

function joinRoute(base, route) {
  const raw = `/api/v1/${base}/${route}`.replace(/\/+/g, "/");
  return raw.replace(/\/:([A-Za-z0-9_]+)/g, "/{$1}").replace(/\/$/, "") || "/";
}

const httpDecorators = new Map([
  ["Get", "get"],
  ["Post", "post"],
  ["Put", "put"],
  ["Patch", "patch"],
  ["Delete", "delete"],
]);

const paths = {};
const endpointInventory = [];

for (const fileName of walk(sourceRoot).filter((file) =>
  file.endsWith(".controller.ts"),
)) {
  const sourceText = fs.readFileSync(fileName, "utf8");
  const source = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  for (const statement of source.statements) {
    if (!ts.isClassDeclaration(statement)) continue;
    const controller = findDecorator(statement, "Controller");
    if (!controller) continue;

    const baseRoute = stringValue(decoratorArgs(controller)[0]);
    const classGuards = decoratorValues(statement, "UseGuards");
    const classRoles = decoratorValues(statement, "Roles");
    const classBearer = Boolean(findDecorator(statement, "ApiBearerAuth"));
    const classPublic = Boolean(findDecorator(statement, "Public"));
    const tags = decoratorValues(statement, "ApiTags");

    for (const member of statement.members) {
      if (!ts.isMethodDeclaration(member)) continue;
      const httpDecorator = decorators(member).find((decorator) =>
        httpDecorators.has(decoratorName(decorator)),
      );
      if (!httpDecorator) continue;

      const method = httpDecorators.get(decoratorName(httpDecorator));
      const route = stringValue(decoratorArgs(httpDecorator)[0]);
      const endpointPath = joinRoute(baseRoute, route);
      const methodName = member.name.getText();
      const methodGuards = decoratorValues(member, "UseGuards");
      const methodRoles = decoratorValues(member, "Roles");
      const isPublic = classPublic || Boolean(findDecorator(member, "Public"));
      const bearer =
        classBearer || Boolean(findDecorator(member, "ApiBearerAuth"));
      const guards = [...classGuards, ...methodGuards];
      const roles = methodRoles.length ? methodRoles : classRoles;
      const contract = parameterContract(member);
      const sourceLine =
        source.getLineAndCharacterOfPosition(member.getStart()).line + 1;

      const operation = {
        tags: tags.length ? tags : [baseRoute],
        operationId: `${statement.name?.text ?? "Controller"}_${methodName}`,
        summary: readSummary(member) ?? methodName,
        responses: {
          default: {
            description:
              "Legacy response; runtime schema was not capturable in RF-0.",
          },
        },
        "x-source": path.relative(repoRoot, fileName).replaceAll("\\", "/"),
        "x-source-line": sourceLine,
        "x-guards": guards,
        "x-roles": roles,
        "x-body-dto": contract.bodyDto,
        "x-query-dto": contract.queryDto,
      };

      if (
        !isPublic &&
        (bearer || guards.some((guard) => guard.includes("JwtAuthGuard")))
      ) {
        operation.security = [{ bearer: [] }];
      }

      paths[endpointPath] ??= {};
      paths[endpointPath][method] = operation;
      endpointInventory.push({
        method: method.toUpperCase(),
        path: endpointPath,
      });
    }
  }
}

const sortedPaths = Object.fromEntries(
  Object.entries(paths).sort(([left], [right]) => left.localeCompare(right)),
);

const document = {
  openapi: "3.0.3",
  info: {
    title: "Healthcare API — RF-0 source baseline",
    version: "legacy-rf0-2026-09-15",
    description:
      "Static source-derived contract inventory. It is not a runtime Swagger snapshot because the legacy API does not compile at the RF-0 baseline.",
  },
  servers: [{ url: "/" }],
  paths: sortedPaths,
  components: {
    securitySchemes: {
      bearer: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  },
  "x-baseline-mode": "static-source-audit",
  "x-runtime-snapshot-status": "blocked",
  "x-runtime-snapshot-blockers": [
    "apps/api/src/createIndex.ts is a Mongo shell script included in TypeScript compilation.",
    "Doctor/DoctorDocument/DoctorSchema exports are missing from doctorProfile.schema.ts.",
    "Mongoose cannot infer the runtime type of auth User.role during test bootstrap.",
  ],
  "x-endpoint-count": endpointInventory.length,
};

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, `${JSON.stringify(document, null, 2)}\n`, "utf8");

const postmanFolders = new Map();
for (const [endpointPath, operations] of Object.entries(sortedPaths)) {
  for (const [method, operation] of Object.entries(operations)) {
    const tag = operation.tags[0] ?? "other";
    if (!postmanFolders.has(tag)) postmanFolders.set(tag, []);
    const relativePath = endpointPath
      .replace(/^\/api\/v1/, "")
      .replace(/\{([^}]+)\}/g, ":$1");
    const request = {
      method: method.toUpperCase(),
      header: [],
      url: `{{baseUrl}}${relativePath}`,
      description: `${operation.summary}\n\nSource: ${operation["x-source"]}:${operation["x-source-line"]}`,
    };
    if (operation.security) {
      request.auth = {
        type: "bearer",
        bearer: [{ key: "token", value: "{{accessToken}}", type: "string" }],
      };
    }
    if (operation["x-body-dto"]) {
      request.header.push({ key: "Content-Type", value: "application/json" });
      request.body = {
        mode: "raw",
        raw: "{}",
        options: { raw: { language: "json" } },
      };
    }
    postmanFolders.get(tag).push({
      name: `${method.toUpperCase()} ${relativePath || "/"}`,
      request,
      response: [],
    });
  }
}

const postmanCollection = {
  info: {
    name: "Healthcare API — RF-0 source baseline",
    description:
      "Source-derived request inventory. Response examples are unavailable because the legacy API cannot bootstrap at the RF-0 baseline.",
    schema:
      "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  item: [...postmanFolders.entries()].map(([name, item]) => ({ name, item })),
  variable: [
    { key: "baseUrl", value: "http://localhost:3000/api/v1" },
    { key: "accessToken", value: "" },
  ],
};

fs.writeFileSync(
  postmanOutputFile,
  `${JSON.stringify(postmanCollection, null, 2)}\n`,
  "utf8",
);
console.log(
  `Wrote ${endpointInventory.length} operations to OpenAPI and Postman baselines`,
);
