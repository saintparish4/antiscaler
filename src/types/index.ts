export type Strategy = "adaptive" | "strict"; 

export interface TaskConfig {
    inputs?: string[]; 
    dependsOn?: string[]; 
    command?: string; 
}

export interface CacheConfig {
    mode: "content";
    directory: string; 
} 

export interface AntiscaleConfig {
    strategy?: Strategy; 
    cache?: Partial<CacheConfig>;  
    tasks?: Record<string, TaskConfig>;  
}

export interface ResolvedAntiscaleConfig {
    strategy: Strategy; 
    cache: CacheConfig; 
    tasks: Record<string, TaskConfig>;  
}

/** Built by the DAG layer (`core/graph`); class implements this contract. -- CHANGES LATER IN PROGRESS*/ 
export interface TaskGraph {
    addTask(name: string): void;
    addDependency(task: string, dep: string): void;
    toLevels(target: string): string[][];
}

export interface AntiscaleContext {
    cwd: string; 
    config: ResolvedAntiscaleConfig; 
    pm: string; 
    runtime: RuntimeInfo;
    framework: string | null; 
    graph: TaskGraph; 
    cacheDir: string; 
}

export interface RuntimeInfo {
    primary: string; 
    fallback: string;  
}

