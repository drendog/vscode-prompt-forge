import * as vscode from "vscode";
import { IFileSystemService } from "./FileSystemService";
import { ErrorMessages } from "../constants";

export interface ProcessedFile {
  path: string;
  content: string;
  tokenCount: number;
}

export class FileProcessorService {
  constructor(private readonly fileSystemService: IFileSystemService) {}

  async processFiles(uris: vscode.Uri[]): Promise<ProcessedFile[]> {
    const processedFiles: ProcessedFile[] = [];

    for (const uri of uris) {
      try {
        const content = await this.readFileContent(uri);
        const tokenCount = this.calculateTokenCount(content);

        processedFiles.push({
          path: vscode.workspace.asRelativePath(uri),
          content,
          tokenCount,
        });
      } catch (error) {
        this.handleFileError(uri, error);
      }
    }

    return processedFiles;
  }

  private async readFileContent(uri: vscode.Uri): Promise<string> {
    const content = await this.fileSystemService.readFile(uri);
    return Buffer.from(content).toString("utf-8");
  }

  private calculateTokenCount(content: string): number {
    return Math.ceil(content.length / 4);
  }

  private handleFileError(uri: vscode.Uri, error: unknown): void {
    vscode.window.showErrorMessage(
      `${ErrorMessages.FileReadError(uri.fsPath)} ${error}`
    );
  }
}
