import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

interface PromptYamlDocument {
  version?: string;
  skill?: string;
  template: string;
}

const PROMPTS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../prompts');

/**
 * Loads and renders a prompt template from `backend/packages/ai/prompts/<name>.yaml`.
 * Reading on demand ensures YAML edits take effect without a TypeScript rebuild.
 */
export function renderPromptFromYaml(
  promptName: string,
  variables: Record<string, string>,
): string {
  const filePath = resolve(PROMPTS_DIR, `${promptName}.yaml`);
  const raw = readFileSync(filePath, 'utf8');
  const parsed = parseYaml(raw) as PromptYamlDocument | null;
  if (!parsed || typeof parsed.template !== 'string' || parsed.template.trim().length === 0) {
    throw new Error(`Invalid prompt YAML at ${filePath}: missing non-empty "template" string.`);
  }

  let rendered = parsed.template;
  for (const [key, value] of Object.entries(variables)) {
    rendered = rendered.replaceAll(`{{${key}}}`, value);
  }
  return rendered.trim();
}
