import * as vscode from "vscode";

export interface IFileSystemService {
  findFiles(
    pattern: vscode.GlobPattern,
    exclude?: vscode.GlobPattern | null
  ): Promise<vscode.Uri[]>;
  readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]>;
  stat(uri: vscode.Uri): Promise<vscode.FileStat>;
  readFile(uri: vscode.Uri): Promise<Uint8Array>;
}

export class FileSystemService implements IFileSystemService {
  async findFiles(
    include: vscode.GlobPattern,
    exclude?: vscode.GlobPattern | null
  ): Promise<vscode.Uri[]> {
    return vscode.workspace.findFiles(include, exclude);
  }

  async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
    return vscode.workspace.fs.readDirectory(uri);
  }

  async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
    return vscode.workspace.fs.stat(uri);
  }

  async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    return vscode.workspace.fs.readFile(uri);
  }
}
