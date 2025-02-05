import * as vscode from "vscode";
import { StorageKeys } from "../constants";

export class SelectionState {
  private readonly selectedFiles = new Set<string>();
  private isUpdating = false;

  constructor(private readonly storage: vscode.Memento) {
    this.loadSavedState();
  }

  public isSelected(uri: vscode.Uri): boolean {
    return this.selectedFiles.has(uri.toString());
  }

  public getSelectedFiles(): vscode.Uri[] {
    return Array.from(this.selectedFiles).map((uri) => vscode.Uri.parse(uri));
  }

  public async selectFile(uri: vscode.Uri): Promise<void> {
    this.selectedFiles.add(uri.toString());
    await this.saveState();
  }

  public async deselectFile(uri: vscode.Uri): Promise<void> {
    this.selectedFiles.delete(uri.toString());
    await this.saveState();
  }

  public async getDirectoryCheckboxState(uri: vscode.Uri): Promise<{
    checkboxState: vscode.TreeItemCheckboxState;
    description: string;
  }> {
    try {
      const files = await vscode.workspace.findFiles(
        new vscode.RelativePattern(uri, "**/*")
      );
      const total = files.length;
      const selectedCount = files.filter((file) =>
        this.selectedFiles.has(file.toString())
      ).length;

      if (total > 0 && selectedCount === total) {
        return {
          checkboxState: vscode.TreeItemCheckboxState.Checked,
          description: "",
        };
      } else if (selectedCount > 0 && selectedCount < total) {
        return {
          checkboxState: vscode.TreeItemCheckboxState.Unchecked,
          description: "(partial)",
        };
      } else {
        return {
          checkboxState: vscode.TreeItemCheckboxState.Unchecked,
          description: "",
        };
      }
    } catch (error) {
      console.error("Error computing directory selection state:", error);
      return {
        checkboxState: vscode.TreeItemCheckboxState.Unchecked,
        description: "",
      };
    }
  }

  private async withLock(operation: () => Promise<void>): Promise<void> {
    while (this.isUpdating) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    this.isUpdating = true;
    try {
      await operation();
    } finally {
      this.isUpdating = false;
    }
  }

  public async handleCheckboxChanges(
    changes: Map<vscode.Uri, vscode.TreeItemCheckboxState>
  ): Promise<void> {
    await this.withLock(async () => {
      try {
        const validChanges = new Map<
          vscode.Uri,
          vscode.TreeItemCheckboxState
        >();
        for (const [uri, state] of changes.entries()) {
          if (
            state === vscode.TreeItemCheckboxState.Checked ||
            state === vscode.TreeItemCheckboxState.Unchecked
          ) {
            validChanges.set(uri, state);
          } else {
            console.warn(
              `Ignoring unsupported checkbox state for ${uri.toString()}`
            );
          }
        }
        const [fileChanges, dirChanges] = await this.categorizeChanges(
          validChanges
        );
        this.handleFileChanges(fileChanges);
        await this.handleDirectoryChanges(dirChanges, fileChanges);
        await this.saveState();
      } catch (error) {
        console.error("Error handling checkbox changes:", error);
        throw error;
      }
    });
  }

  private async categorizeChanges(
    changes: Map<vscode.Uri, vscode.TreeItemCheckboxState>
  ): Promise<
    [
      Array<[vscode.Uri, vscode.TreeItemCheckboxState]>,
      Array<[vscode.Uri, vscode.TreeItemCheckboxState]>
    ]
  > {
    const fileChanges: Array<[vscode.Uri, vscode.TreeItemCheckboxState]> = [];
    const dirChanges: Array<[vscode.Uri, vscode.TreeItemCheckboxState]> = [];

    for (const [uri, state] of changes.entries()) {
      try {
        const stat = await vscode.workspace.fs.stat(uri);
        if (stat.type === vscode.FileType.Directory) {
          dirChanges.push([uri, state]);
        } else {
          fileChanges.push([uri, state]);
        }
      } catch (error) {
        fileChanges.push([uri, state]);
      }
    }
    return [fileChanges, dirChanges];
  }

  private handleFileChanges(
    fileChanges: Array<[vscode.Uri, vscode.TreeItemCheckboxState]>
  ): void {
    for (const [uri, state] of fileChanges) {
      if (state === vscode.TreeItemCheckboxState.Checked) {
        this.selectedFiles.add(uri.toString());
      } else {
        this.selectedFiles.delete(uri.toString());
      }
    }
  }

  private async handleDirectoryChanges(
    dirChanges: Array<[vscode.Uri, vscode.TreeItemCheckboxState]>,
    fileChanges: Array<[vscode.Uri, vscode.TreeItemCheckboxState]>
  ): Promise<void> {
    for (const [dirUri, state] of dirChanges) {
      const dirPrefix = this.getDirPrefix(dirUri);

      if (this.hasDescendantToggled(dirPrefix, fileChanges)) {
        continue;
      }
      await this.updateDirectorySelection(dirUri, dirPrefix, state);
    }
  }

  private getDirPrefix(dirUri: vscode.Uri): string {
    const dirStr = dirUri.toString();
    return dirStr.endsWith("/") ? dirStr : dirStr + "/";
  }

  private hasDescendantToggled(
    dirPrefix: string,
    fileChanges: Array<[vscode.Uri, vscode.TreeItemCheckboxState]>
  ): boolean {
    return fileChanges.some(([fileUri, _]) =>
      fileUri.toString().startsWith(dirPrefix)
    );
  }

  private async updateDirectorySelection(
    dirUri: vscode.Uri,
    dirPrefix: string,
    state: vscode.TreeItemCheckboxState
  ): Promise<void> {
    try {
      if (state === vscode.TreeItemCheckboxState.Checked) {
        const filesInDir = await vscode.workspace.findFiles(
          new vscode.RelativePattern(dirUri, "**/*")
        );
        for (const fileUri of filesInDir) {
          this.selectedFiles.add(fileUri.toString());
        }
      } else {
        const toRemove = Array.from(this.selectedFiles).filter((selected) =>
          selected.startsWith(dirPrefix)
        );
        for (const selected of toRemove) {
          this.selectedFiles.delete(selected);
        }
      }
    } catch (error) {
      console.error(
        `Error updating directory selection for ${dirUri.toString()}:`,
        error
      );
    }
  }

  private loadSavedState(): void {
    const stored = this.storage.get<readonly string[]>(
      StorageKeys.SelectedFiles,
      []
    );
    stored.forEach((uri) => this.selectedFiles.add(uri));
  }

  private async saveState(): Promise<void> {
    await this.storage.update(
      StorageKeys.SelectedFiles,
      Array.from(this.selectedFiles)
    );
  }
}
