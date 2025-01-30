import * as vscode from "vscode";
import { SelectionState } from "../states/SelectionState";
import { TreeNode } from "../models/TreeNode";
import { IFileSystemService } from "../services/FileSystemService";
import { ErrorMessages } from "../constants";
import { calculateTokenCount } from "../utils";

export class FileTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    TreeNode | undefined
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    private readonly selectionState: SelectionState,
    private readonly fileSystemService: IFileSystemService
  ) {}

  refresh(node?: TreeNode): void {
    this._onDidChangeTreeData.fire(node);
  }

  async getTreeItem(element: TreeNode): Promise<vscode.TreeItem> {
    const item = new vscode.TreeItem(
      element.uri,
      element.isDirectory
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );

    item.resourceUri = element.uri;
    item.contextValue = element.isDirectory ? "directory" : "file";

    if (element.isDirectory) {
      await this.setDirectoryCheckboxState(item, element.uri);
    } else {
      item.checkboxState = this.selectionState.isSelected(element.uri)
        ? vscode.TreeItemCheckboxState.Checked
        : vscode.TreeItemCheckboxState.Unchecked;
      item.description = `~${await calculateTokenCount([element.uri])}`;
    }

    return item;
  }

  private async setDirectoryCheckboxState(
    item: vscode.TreeItem,
    uri: vscode.Uri
  ): Promise<void> {
    try {
      const files = await vscode.workspace.findFiles(
        new vscode.RelativePattern(uri, "**/*")
      );
      const total = files.length;
      const selected = files.filter((f) =>
        this.selectionState.isSelected(f)
      ).length;

      if (total > 0 && selected === total) {
        item.checkboxState = vscode.TreeItemCheckboxState.Checked;
        item.description = "";
      } else {
        item.checkboxState = vscode.TreeItemCheckboxState.Unchecked;
        item.description = selected > 0 && selected < total ? "(partial)" : "";
      }
    } catch (error) {
      console.error("Error computing directory selection:", error);
      item.checkboxState = vscode.TreeItemCheckboxState.Unchecked;
    }
  }

  async getChildren(element?: TreeNode): Promise<TreeNode[]> {
    return element
      ? this.getDirectoryNodes(element.uri)
      : this.getWorkspaceNodes();
  }

  private async getWorkspaceNodes(): Promise<TreeNode[]> {
    const roots = vscode.workspace.workspaceFolders;
    if (!roots) {
      return [];
    }

    return Promise.all(
      roots.map(async (root) => {
        const uri = root.uri;
        const stat = await this.fileSystemService.stat(uri);
        return new TreeNode(root.name, true, uri, stat.size);
      })
    );
  }

  private async getDirectoryNodes(uri: vscode.Uri): Promise<TreeNode[]> {
    try {
      const files = await this.fileSystemService.readDirectory(uri);
      const sortedFiles = this.sortDirectoryEntries(files);

      return Promise.all(
        sortedFiles.map(([name, type]) => this.createTreeNode(uri, name, type))
      );
    } catch (error) {
      console.error(ErrorMessages.ReadDirectoryError(uri.fsPath), error);
      return [];
    }
  }

  private sortDirectoryEntries(
    entries: [string, vscode.FileType][]
  ): [string, vscode.FileType][] {
    return entries.slice().sort(([nameA, typeA], [nameB, typeB]) => {
      if (typeA === typeB) {
        return nameA.localeCompare(nameB);
      }
      return typeA === vscode.FileType.Directory ? -1 : 1;
    });
  }

  private async createTreeNode(
    parentUri: vscode.Uri,
    name: string,
    type: vscode.FileType
  ): Promise<TreeNode> {
    const fileUri = vscode.Uri.joinPath(parentUri, name);
    const stat = await this.fileSystemService.stat(fileUri);
    return new TreeNode(
      name,
      type === vscode.FileType.Directory,
      fileUri,
      stat.size
    );
  }
}
