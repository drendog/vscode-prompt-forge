import * as vscode from "vscode";
import { SelectionState } from "../states/SelectionState";
import { ErrorMessages, StorageKeys } from "../constants";
import { IFileSystemService } from "../services/FileSystemService";
import { FileProcessorService } from "../services/FileProcessorService";
import { PromptBuilderService } from "../services/PromptBuilderService";

export async function expandUris(uris: vscode.Uri[]): Promise<vscode.Uri[]> {
  const allFiles: vscode.Uri[] = [];

  const tasks = uris.map(async (uri) => {
    try {
      const stat = await vscode.workspace.fs.stat(uri);
      if (stat.type === vscode.FileType.File) {
        allFiles.push(uri);
      } else if (stat.type === vscode.FileType.Directory) {
        const filesInDir = await vscode.workspace.findFiles(
          new vscode.RelativePattern(uri, "**/*")
        );
        allFiles.push(...filesInDir);
      }
    } catch (err) {
      console.error(`Error expanding ${uri.fsPath}:`, err);
    }
  });

  await Promise.all(tasks);

  return Array.from(new Set(allFiles.map((uri) => uri.toString()))).map(
    (uriStr) => vscode.Uri.parse(uriStr)
  );
}

export async function calculateTokenCount(uris: vscode.Uri[]): Promise<number> {
  const expandedUris = await expandUris(uris);
  let tokenCount = 0;
  for (const uri of expandedUris) {
    try {
      const content = await vscode.workspace.fs.readFile(uri);
      const contentStr = Buffer.from(content).toString("utf-8");
      tokenCount += Math.ceil(contentStr.length / 4);
    } catch (error) {
      console.error(`Error reading file ${uri.fsPath}:`, error);
    }
  }
  return tokenCount;
}

export async function generateFullPrompt(
  selectionState: SelectionState,
  context: vscode.ExtensionContext,
  fileSystemService: IFileSystemService
): Promise<string> {
  const selectedFiles = selectionState.getSelectedFiles();
  if (selectedFiles.length === 0) {
    throw new Error(ErrorMessages.FileReadError("No files selected"));
  }

  const fileProcessor = new FileProcessorService(fileSystemService);
  const processedFiles = await fileProcessor.processFiles(selectedFiles);

  const promptBuilder = new PromptBuilderService({
    format: context.workspaceState.get<"markdown" | "xml">(
      StorageKeys.PromptFormat,
      "markdown"
    ),
    promptHeader: context.workspaceState.get(
      StorageKeys.PromptHeader,
      "Analyze the following codebase structure and contents:\n\n[PROJECT OVERVIEW]\n"
    ),
  });

  return promptBuilder.buildPrompt(
    processedFiles.map(({ path, content }) => ({ path, content }))
  );
}
