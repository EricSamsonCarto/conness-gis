export declare const TEMPLATE_DIR: string
export declare function projectId(name: string): string
export declare function freeId(id: string, existing: string[]): string
export declare function createProject(
  name: string,
  projectsDir?: string,
  templateDir?: string,
): { id: string; dir: string }
export declare function copyProject(
  sourceDir: string,
  name: string,
  projectsDir?: string,
): { id: string; dir: string }
