import * as vscode from "vscode";
import { SelectionState } from "../states/SelectionState";
import { ErrorMessages, StorageKeys } from "../constants";
import { IFileSystemService } from "../services/FileSystemService";
import { FileProcessorService } from "../services/FileProcessorService";
import { PromptBuilderService } from "../services/PromptBuilderService";

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
