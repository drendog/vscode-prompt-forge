import * as vscode from "vscode";
import { FileTreeProvider } from "./providers/FileTreeProvider";
import { SelectionState } from "./states/SelectionState";
import { SelectedFileDecorationProvider } from "./providers/FileDecorationProvider";
import { FileSystemService } from "./services/FileSystemService";
import { Commands, Decoration } from "./constants";
import { PromptInputProvider } from "./providers/PromptInputProvider";
import { QuickSettingsProvider } from "./providers/QuickSettingsProvider";
import { generateFullPrompt } from "./utils";

interface ExtensionServices {
  fileSystemService: FileSystemService;
  selectionState: SelectionState;
  treeProvider: FileTreeProvider;
  decorationProvider: SelectedFileDecorationProvider;
}

export async function activate(context: vscode.ExtensionContext) {
  const services = initializeServices(context);
  const disposables = [
    ...registerStatusBar(services),
    ...registerTreeView(context, services),
    ...registerWebviews(context, services),
    ...registerCommands(context, services),
    ...registerWorkspaceListeners(context, services),
  ];

  context.subscriptions.push(...disposables);
  await updateTokenCount(context, services);
}

function initializeServices(
  context: vscode.ExtensionContext
): ExtensionServices {
  const fileSystemService = new FileSystemService();
  const selectionState = new SelectionState(context.workspaceState);
  const treeProvider = new FileTreeProvider(selectionState, fileSystemService);
  const decorationProvider = new SelectedFileDecorationProvider(selectionState);
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );

  return {
    fileSystemService,
    selectionState,
    treeProvider,
    decorationProvider,
    statusBarItem,
  };
}

interface ExtensionServices {
  fileSystemService: FileSystemService;
  selectionState: SelectionState;
  treeProvider: FileTreeProvider;
  decorationProvider: SelectedFileDecorationProvider;
  statusBarItem: vscode.StatusBarItem;
}

function registerStatusBar(services: ExtensionServices): vscode.Disposable[] {
  services.statusBarItem.text = `${Decoration.Badge} Tokens: 0`;
  services.statusBarItem.show();

  return [services.statusBarItem];
}

function registerTreeView(
  context: vscode.ExtensionContext,
  services: ExtensionServices
): vscode.Disposable[] {
  const treeView = vscode.window.createTreeView("fileSelectorTree", {
    treeDataProvider: services.treeProvider,
    showCollapseAll: true,
    manageCheckboxStateManually: false,
    canSelectMany: true,
  });

  treeView.onDidChangeCheckboxState(async (e) => {
    const changes = new Map(
      e.items.map(([element, state]) => [element.uri, state])
    );
    await services.selectionState.handleCheckboxChanges(changes);
    services.treeProvider.refresh();
    services.decorationProvider.updateDecorations([...changes.keys()]);
    await updateTokenCount(context, services);
  });

  return [
    treeView,
    vscode.window.registerFileDecorationProvider(services.decorationProvider),
  ];
}

function registerWebviews(
  context: vscode.ExtensionContext,
  services: ExtensionServices
): vscode.Disposable[] {
  return [
    vscode.window.registerWebviewViewProvider(
      "promptInput",
      new PromptInputProvider(context, services.selectionState)
    ),
    vscode.window.registerWebviewViewProvider(
      "quickSettings",
      new QuickSettingsProvider(context)
    ),
  ];
}

function registerCommands(
  context: vscode.ExtensionContext,
  services: ExtensionServices
): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand(Commands.AddActiveEditor, async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        await services.selectionState.selectFile(editor.document.uri);
        services.decorationProvider.updateDecorations([editor.document.uri]);
        await updateTokenCount(context, services);
      }
    }),
    vscode.commands.registerCommand(Commands.RemoveActiveEditor, async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        await services.selectionState.deselectFile(editor.document.uri);
        services.decorationProvider.updateDecorations([editor.document.uri]);
        await updateTokenCount(context, services);
      }
    }),
    vscode.commands.registerCommand(Commands.GeneratePrompt, async () => {
      try {
        const prompt = await generateFullPrompt(
          services.selectionState,
          context,
          services.fileSystemService
        );
        await vscode.env.clipboard.writeText(prompt);
        vscode.window.showInformationMessage("Prompt copied to clipboard!");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        vscode.window.showErrorMessage(message);
      }
    }),
  ];
}

function registerWorkspaceListeners(
  context: vscode.ExtensionContext,
  services: ExtensionServices
): vscode.Disposable[] {
  return [
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      services.treeProvider.refresh();
      updateTokenCount(context, services);
    }),
    vscode.workspace.onDidCreateFiles(() => {
      services.treeProvider.refresh();
      updateTokenCount(context, services);
    }),
    vscode.workspace.onDidDeleteFiles(() => {
      services.treeProvider.refresh();
      updateTokenCount(context, services);
    }),
    vscode.workspace.onDidRenameFiles(() => {
      services.treeProvider.refresh();
      updateTokenCount(context, services);
    }),
  ];
}

async function updateTokenCount(
  context: vscode.ExtensionContext,
  services: ExtensionServices
): Promise<void> {
  try {
    const prompt = await generateFullPrompt(
      services.selectionState,
      context,
      services.fileSystemService
    );
    const tokenCount = Math.ceil(prompt.length / 4);
    services.statusBarItem.text = `${Decoration.Badge} Tokens: ~${tokenCount}`;
  } catch (error) {
    console.error("Error updating token count:", error);
    services.statusBarItem.text = `${Decoration.Badge} Tokens: Error`;
  }
}
