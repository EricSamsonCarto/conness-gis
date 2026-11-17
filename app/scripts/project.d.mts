export declare const PROJECTS_DIR: string
export declare function listProjects(projectsDir?: string): string[]
export declare function resolveProject(
  requested: string | undefined,
  projectsDir?: string,
): { id: string; dir: string }
