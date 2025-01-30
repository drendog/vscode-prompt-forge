export const StorageKeys = {
  SelectedFiles: "selectedFiles",
  PromptHeader: "promptHeader",
  PromptFormat: "promptFormat",
};

export const Commands = {
  ToggleSelection: "extension.toggleSelection",
  GeneratePrompt: "extension.generatePrompt",
  AddActiveEditor: "extension.addActiveEditor",
  RemoveActiveEditor: "extension.removeActiveEditor",
};

export const Icons = {
  Check: "check",
  CircleOutline: "circle-outline",
  Folder: "folder",
  FolderActive: "folder-active",
  FolderPartial: "folder-opened",
};

export const ErrorMessages = {
  ReadDirectoryError: (path: string) => `Error reading directory ${path}:`,
  FileReadError: (path: string) => `Error reading ${path}:`,
  PromptGenerationFailed: "Prompt generation failed:",
};

export const Decoration = {
  Badge: "📜",
  Tooltip: "Selected for LLM Context",
};
