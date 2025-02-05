import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export interface WebviewConfig {
  viewType: string;
  title: string;
  htmlPath: string;
  scripts?: boolean;
  contentReplacements?: Record<string, string>;
}

export class WebviewManager {
  private readonly _webview: vscode.WebviewView;
  private readonly _messageHandlers: Map<string, (message: any) => void>;

  constructor(
    webviewView: vscode.WebviewView,
    private readonly config: WebviewConfig,
    private readonly context: vscode.ExtensionContext
  ) {
    this._webview = webviewView;
    this._messageHandlers = new Map();
    this.initialize();
  }

  private initialize(): void {
    this.setupWebviewOptions();
    this.loadContent();
  }

  private setupWebviewOptions(): void {
    this._webview.webview.options = {
      enableScripts: this.config.scripts ?? true,
      localResourceRoots: [
        vscode.Uri.file(path.join(this.context.extensionPath)),
      ],
    };
  }

  private loadContent(): void {
    const htmlContent = this.getHtmlContent();
    this._webview.webview.html = this.processHtml(htmlContent);
  }

  private getHtmlContent(): string {
    const htmlPath = path.join(
      this.context.extensionPath,
      this.config.htmlPath
    );
    return fs.readFileSync(htmlPath, "utf-8");
  }

  private processHtml(html: string): string {
    let processed = html;
    const baseReplacements = {
      root: this._webview.webview
        .asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath)))
        .toString(),
    };

    const replacements = {
      ...baseReplacements,
      ...this.config.contentReplacements,
    };

    Object.entries(replacements).forEach(([key, value]) => {
      processed = processed.replace(new RegExp(`{{${key}}}`, "g"), value);
    });

    return processed;
  }

  postMessage(message: any): void {
    this._webview.webview.postMessage(message);
  }

  onMessage(command: string, handler: (message: any) => void): void {
    this._messageHandlers.set(command, handler);

    if (this._messageHandlers.size === 1) {
      this._webview.webview.onDidReceiveMessage((message) => {
        const handler = this._messageHandlers.get(message.command);
        if (handler) {
          handler(message);
        }
      });
    }
  }

  refresh(): void {
    this.loadContent();
  }
}
