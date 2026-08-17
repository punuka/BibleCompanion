const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Metro must watch the whole monorepo, or edits to packages/shared do not
// trigger a reload.
config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Resolve @bible/shared to its TypeScript source rather than the compiled
// dist/. Metro transpiles TS natively, so this keeps hot reload working on
// shared code without needing a build step in the mobile dev loop. (The API
// consumes dist/ instead, because tsx will not transpile inside node_modules.)
const SHARED_SRC = path.resolve(workspaceRoot, 'packages/shared/src');

config.resolver.extraNodeModules = {
  '@bible/shared': SHARED_SRC,
};

// packages/shared/src writes relative imports with a `.js` extension, because
// its compiled output in dist/ has to satisfy Node's ESM loader (which demands
// explicit extensions). Metro resolves against the TypeScript source, where
// only `./languages.ts` exists — so `./languages.js` fails to resolve.
//
// Rewrite those specifiers back to extensionless for files inside the shared
// package, and let Metro's normal .ts/.tsx resolution take over. Scoped to that
// one directory so nothing in the app or node_modules is affected.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const isRelative = moduleName.startsWith('./') || moduleName.startsWith('../');
  const fromShared = context.originModulePath?.startsWith(SHARED_SRC);

  if (isRelative && fromShared && moduleName.endsWith('.js')) {
    moduleName = moduleName.slice(0, -'.js'.length);
  }

  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

config.resolver.disableHierarchicalLookup = false;

module.exports = config;
