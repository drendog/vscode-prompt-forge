import * as path from "path";
import * as fs from "fs";
import * as vscode from "vscode";
import { StorageKeys } from "../constants";

export class QuickSettingsProvider implements vscode.WebviewViewProvider {
  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void | Thenable<void> {
    webviewView.webview.options = {
      enableScripts: true,
    };

    const htmlPath = path.join(
      this.context.extensionPath,
      "media",
      "webviews",
      "quick-settings.html"
    );
    const htmlContent = fs.readFileSync(htmlPath, "utf-8");

    webviewView.webview.html = htmlContent;

    const currentFormat = this.context.workspaceState.get<string>(
      StorageKeys.PromptFormat,
      "markdown"
    );
    webviewView.webview.postMessage({
      type: "setFormat",
      format: currentFormat,
    });

    const thinkingTagsEnabled = this.context.workspaceState.get<boolean>(
      StorageKeys.ThinkingTags,
      false
    );
    webviewView.webview.postMessage({
      type: "setThinkingTags",
      enabled: thinkingTagsEnabled,
    });

    webviewView.webview.onDidReceiveMessage(async (message) => {
      if (message.command === "updateFormat") {
        await this.context.workspaceState.update(
          StorageKeys.PromptFormat,
          message.format
        );
        vscode.window.showInformationMessage(
          `Prompt format updated to ${message.format}`
        );
      } else if (message.command === "updateThinkingTags") {
        await this.context.workspaceState.update(
          StorageKeys.ThinkingTags,
          message.enabled
        );
        vscode.window.showInformationMessage(
          `Thinking tags ${message.enabled ? "enabled" : "disabled"}`
        );
      }
    });
  }
}
