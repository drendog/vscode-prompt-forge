import { XMLBuilder } from "fast-xml-parser";

export interface PromptBuilderOptions {
  format: "markdown" | "xml";
  promptHeader: string;
  thinkingTagsEnabled?: boolean;
}

export class PromptBuilderService {
  constructor(private readonly options: PromptBuilderOptions) {}

  buildPrompt(files: Array<{ path: string; content: string }>): string {
    if (this.options.thinkingTagsEnabled) {
      const basePrompt =
        this.options.format === "xml"
          ? this.buildXmlPrompt(files)
          : this.buildMarkdownPrompt(files);

      return `${basePrompt}\n\nPlease think through your response step by step, using <thinking>...</thinking> XML tags.`;
    }

    return this.options.format === "xml"
      ? this.buildXmlPrompt(files)
      : this.buildMarkdownPrompt(files);
  }

  private buildMarkdownPrompt(
    files: Array<{ path: string; content: string }>
  ): string {
    const promptBody = files
      .map((f) => `## ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
      .join("\n\n");
    return `${this.options.promptHeader}\n\n${promptBody}`.trim();
  }

  private buildXmlPrompt(
    files: Array<{ path: string; content: string }>
  ): string {
    const xmlFiles = files.map((f) => ({
      "@_path": f.path,
      content: `\n${f.content}\n`,
    }));

    const promptObject = {
      prompt: {
        instructions: this.options.promptHeader,
        context: {
          file: xmlFiles,
        },
      },
    };

    const builder = new XMLBuilder({
      ignoreAttributes: false,
      format: true,
    });

    return builder.build(promptObject).trim();
  }
}
