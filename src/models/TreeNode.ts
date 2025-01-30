import * as vscode from "vscode";

export class TreeNode {
  constructor(
    public readonly label: string,
    public readonly isDirectory: boolean,
    public readonly uri: vscode.Uri,
    public readonly size: number
  ) {}
}
