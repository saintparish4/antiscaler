export interface PackageManagerAdapter {
    name: string; 
    runScript(scriptName: string, cwd: string): Promise<void>; 
    install(cwd: string): Promise<void>; 
}

export interface RuntimeAdapter {
    name: string; 
    available(): boolean; 
    version(): string | null;  
}

export interface FrameworkAdapter {
  name: string;
  detect(cwd: string): boolean | Promise<boolean>;
  devCommand(): string;
  buildCommand(): string;
}