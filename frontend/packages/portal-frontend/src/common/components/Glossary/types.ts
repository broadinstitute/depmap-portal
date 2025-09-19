export interface GlossaryItem {
  term: string;
  definition: string;
  addLeftMargin?: boolean;
  multipartDefinition?: string[];
  references?: Record<string, { url: string; text?: string }>;
}
