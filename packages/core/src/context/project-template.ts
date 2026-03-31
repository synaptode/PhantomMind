export type ProjectTemplateName =
  | 'auto'
  | 'default'
  | 'node-library'
  | 'node-cli'
  | 'react-app'
  | 'nextjs-app';

export interface ProjectTemplate {
  name: Exclude<ProjectTemplateName, 'auto'>;
  displayName: string;
  languageRules: string[];
  frameworkRules: string[];
  fileOrganization: string[];
  importRules: string[];
  testingRules: string[];
  performanceRules: string[];
  documentationRules: string[];
  forbiddenPatterns: string[];
  customRules: string[];
}

export const PROJECT_TEMPLATES: Record<Exclude<ProjectTemplateName, 'auto'>, ProjectTemplate> = {
  default: {
    name: 'default',
    displayName: 'Default Project',
    languageRules: ['Prefer explicit types where they clarify public APIs.'],
    frameworkRules: ['Preserve existing framework conventions before introducing new abstractions.'],
    fileOrganization: ['Keep related code close together and avoid deep nesting without strong justification.'],
    importRules: ['Prefer stable imports over brittle relative paths when aliases already exist.'],
    testingRules: ['Add or update tests when behavior changes.'],
    performanceRules: ['Measure before optimizing hot paths.'],
    documentationRules: ['Document non-obvious architecture decisions close to the code.'],
    forbiddenPatterns: ['Large files with mixed responsibilities', 'Silent failure paths'],
    customRules: [],
  },
  'node-library': {
    name: 'node-library',
    displayName: 'Node Library',
    languageRules: ['Keep exported APIs stable and avoid implicit breaking changes.'],
    frameworkRules: ['Favor small composable modules over framework-heavy abstractions.'],
    fileOrganization: ['Separate CLI entrypoints, runtime code, and shared utilities.'],
    importRules: ['Use the node: protocol for built-in modules.'],
    testingRules: ['Cover public APIs and error cases.'],
    performanceRules: ['Avoid unnecessary startup work in library entrypoints.'],
    documentationRules: ['Document exported types and user-facing CLI behavior.'],
    forbiddenPatterns: ['Top-level side effects in reusable modules', 'Breaking output format without versioning'],
    customRules: ['Keep generated files deterministic when possible.'],
  },
  'node-cli': {
    name: 'node-cli',
    displayName: 'Node CLI',
    languageRules: ['Keep command handlers focused and side-effect boundaries clear.'],
    frameworkRules: ['Provide actionable CLI output for both success and failure paths.'],
    fileOrganization: ['Keep one command per file when command complexity grows.'],
    importRules: ['Centralize command registration in the CLI entrypoint.'],
    testingRules: ['Cover parsing and output contracts for commands with branching behavior.'],
    performanceRules: ['Avoid blocking startup with unnecessary scans before argument parsing.'],
    documentationRules: ['Document commands, flags, and examples.'],
    forbiddenPatterns: ['Ambiguous command names', 'Hidden destructive behavior'],
    customRules: ['Prefer dry-run support before destructive writes.'],
  },
  'react-app': {
    name: 'react-app',
    displayName: 'React App',
    languageRules: ['Model component props explicitly and keep rendering logic predictable.'],
    frameworkRules: ['Prefer composition over prop-drilling-heavy component trees.'],
    fileOrganization: ['Group components by feature or route rather than by file type alone.'],
    importRules: ['Keep browser-only code out of shared server modules.'],
    testingRules: ['Test behavior visible to users rather than implementation details.'],
    performanceRules: ['Avoid unnecessary renders before adding memoization.'],
    documentationRules: ['Document app-level state boundaries and data flow.'],
    forbiddenPatterns: ['Monolithic page components', 'State duplicated across distant branches'],
    customRules: ['Keep hooks pure and deterministic.'],
  },
  'nextjs-app': {
    name: 'nextjs-app',
    displayName: 'Next.js App',
    languageRules: ['Keep server and client boundaries explicit.'],
    frameworkRules: ['Prefer Server Components by default and use client components only when needed.'],
    fileOrganization: ['Keep route segments cohesive and colocate data-fetching with routes when appropriate.'],
    importRules: ['Do not import server-only modules into client components.'],
    testingRules: ['Cover route handlers, data loaders, and rendering edge cases.'],
    performanceRules: ['Be deliberate about caching, revalidation, and bundle size.'],
    documentationRules: ['Document route conventions and env var requirements.'],
    forbiddenPatterns: ['Mixing browser-only APIs into server modules', 'Fetching the same data redundantly across nested routes'],
    customRules: ['Use route handlers and server actions consistently within a feature.'],
  },
};

export function detectProjectTemplate(input: {
  frameworks: string[];
  entryPoints: string[];
  projectType: string;
}): Exclude<ProjectTemplateName, 'auto'> {
  const frameworks = new Set(input.frameworks);
  const entryPoints = input.entryPoints.join(' ');

  if (frameworks.has('Next.js')) return 'nextjs-app';
  if (frameworks.has('React')) return 'react-app';
  if (entryPoints.includes('bin') || input.projectType.toLowerCase().includes('cli')) return 'node-cli';
  if (input.projectType.toLowerCase().includes('monorepo') || input.projectType.toLowerCase().includes('module')) return 'node-library';
  return 'default';
}