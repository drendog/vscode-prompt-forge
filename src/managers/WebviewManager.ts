import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export interface WebviewConfig {
  viewType: string;
  title: string;
  htmlPath: string;
}

export class WebviewManager {
  private readonly _webview: vscode.WebviewView;

  constructor(
    webviewView: vscode.WebviewView,
    private readonly config: WebviewConfig,
    private readonly context: vscode.ExtensionContext
  ) {
    this._webview = webviewView;
    this.initialize();
  }

  private initialize(): void {
    this._webview.webview.options = {
      enableScripts: true,
    };

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
    return html.replace(
      /{{root}}/g,
      this._webview.webview
        .asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath)))
        .toString()
    );
  }

  postMessage(message: any): void {
    this._webview.webview.postMessage(message);
  }

  onMessage(callback: (message: any) => void): void {
    this._webview.webview.onDidReceiveMessage(callback);
  }
}
