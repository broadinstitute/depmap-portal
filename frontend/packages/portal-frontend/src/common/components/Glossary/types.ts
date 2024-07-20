export interface GlossaryItem {
  term: string;
  definition: string;
  multipartDefinition?: string[];
  references?: Record<string, { url: string; text?: string }>;
}
