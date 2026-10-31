// The unit tests that read files use these two Node calls; there are no @types/node in the project.
declare module 'node:crypto' { export function createHash(algorithm: string): { update(data: unknown): { digest(encoding: string): string } } }
declare module 'node:fs' { export function readFileSync(path: string): unknown }
