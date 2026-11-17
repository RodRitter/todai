export interface WorkspaceServer {
  identity?: string;
  pid: number;
  command: string;
  directory: string;
  addresses: string[];
}
