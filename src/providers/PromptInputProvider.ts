import * as vscode from "vscode";
import { SelectionState } from "../states/SelectionState";
import { StorageKeys } from "../constants";
import { WebviewManager } from "../managers/WebviewManager";
import { FileSystemService } from "../services/FileSystemService";
import { generateFullPrompt } from "../utils";

interface LLMService {
  name: string;
  url: string;
  getUrlWithPrompt: (prompt: string) => string;
}

const LLM_SERVICES: Record<string, LLMService> = {
  chatgpt: {
    name: "ChatGPT",
    url: "https://chat.openai.com/",
    getUrlWithPrompt: (prompt: string) =>
      `https://chat.openai.com/?prompt=${encodeURIComponent(prompt)}`,
  },
  claude: {
    name: "Claude",
    url: "https://claude.ai/",
    getUrlWithPrompt: (prompt: string) =>
      `https://claude.ai/new?q=${encodeURIComponent(prompt)}`,
  },
};

export class PromptInputProvider implements vscode.WebviewViewProvider {
  private webviewManager?: WebviewManager;
  private readonly fileSystemService: FileSystemService;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly selectionState: SelectionState
  ) {
    this.fileSystemService = new FileSystemService();
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.webviewManager = new WebviewManager(
      webviewView,
      {
        viewType: "promptInput",
        title: "Prompt Generation",
        htmlPath: "media/webviews/general.html",
      },
      this.context
    );

    this.setupMessageHandlers();
    this.initializeState();
  }

  private setupMessageHandlers(): void {
    if (!this.webviewManager) {
      return;
    }

    this.webviewManager.onMessage(
      "onPromptInputChange",
      this.handlePromptInputChange
    );
    this.webviewManager.onMessage(
      "copyToClipboard",
      this.handleCopyToClipboard
    );
    this.webviewManager.onMessage("newFile", this.handleNewFile);
    this.webviewManager.onMessage("openInBrowser", this.handleOpenInBrowser);
  }

  private async handlePromptInputChange(message: {
    text: string;
  }): Promise<void> {
    await this.context.workspaceState.update(
      StorageKeys.PromptHeader,
      message.text
    );
  }

  private async handleCopyToClipboard(): Promise<void> {
    await this.executeWithProgress("Copying Full Prompt", async () => {
      const fullPrompt = await generateFullPrompt(
        this.selectionState,
        this.context,
        this.fileSystemService
      );
      await vscode.env.clipboard.writeText(fullPrompt);
      vscode.window.showInformationMessage("Full prompt copied to clipboard!");
    });
  }

  private async handleNewFile(): Promise<void> {
    await this.executeWithProgress("Creating New File", async () => {
      const fullPrompt = await generateFullPrompt(
        this.selectionState,
        this.context,
        this.fileSystemService
      );
      const document = await vscode.workspace.openTextDocument({
        content: fullPrompt,
      });
      await vscode.window.showTextDocument(document, {
        viewColumn: vscode.ViewColumn.One,
        preview: false,
        preserveFocus: true,
      });
    });
  }

  private async handleOpenInBrowser(message: {
    service: keyof typeof LLM_SERVICES;
  }): Promise<void> {
    const service = LLM_SERVICES[message.service];
    if (!service) {
      vscode.window.showErrorMessage("Unknown LLM service");
      return;
    }

    await this.executeWithProgress("Generating Prompt", async () => {
      const fullPrompt = await generateFullPrompt(
        this.selectionState,
        this.context,
        this.fileSystemService
      );
      const urlWithPrompt = service.getUrlWithPrompt(fullPrompt);
      await vscode.env.openExternal(vscode.Uri.parse(urlWithPrompt));
    });
  }

  private async executeWithProgress<T>(
    title: string,
    task: () => Promise<T>
  ): Promise<T | void> {
    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title,
        cancellable: false,
      },
      async (progress) => {
        progress.report({ message: "Processing..." });
        try {
          return await task();
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : "An unknown error occurred";
          vscode.window.showWarningMessage(errorMessage);
        }
      }
    );
  }

  private initializeState(): void {
    if (!this.webviewManager) {
      return;
    }

    const savedPrompt = this.context.workspaceState.get(
      StorageKeys.PromptHeader,
      ""
    );
    this.webviewManager.postMessage({
      command: "setPrompt",
      text: savedPrompt,
    });
  }
}
