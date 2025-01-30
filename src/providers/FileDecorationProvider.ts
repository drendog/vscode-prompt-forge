import * as vscode from "vscode";
import { SelectionState } from "../states/SelectionState";
import { Decoration } from "../constants";

export class SelectedFileDecorationProvider
  implements vscode.FileDecorationProvider
{
  private readonly _onDidChange = new vscode.EventEmitter<vscode.Uri[]>();

  constructor(private readonly selectionState: SelectionState) {}

  readonly onDidChangeFileDecorations = this._onDidChange.event;

  provideFileDecoration(
    uri: vscode.Uri
  ): vscode.ProviderResult<vscode.FileDecoration> {
    return this.selectionState.isSelected(uri)
      ? {
          badge: Decoration.Badge,
          tooltip: Decoration.Tooltip,
          color: undefined,
        }
      : undefined;
  }

  updateDecorations(uris: vscode.Uri[]): void {
    this._onDidChange.fire(uris);
  }
}
