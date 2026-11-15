import { readFileSync } from 'node:fs';
import { validateContentPack } from './validator.js';

function runCli(): void {
  const filePath = process.argv[2];
  if (!filePath) {
    process.stdout.write('Usage: pnpm validate <path-to-pack.json>\n');
    process.exit(1);
  }

  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
    const report = validateContentPack(raw);
    process.stdout.write(`Pack "${report.packId}" validated successfully.\n`);
    process.stdout.write(`Skill: ${report.skill}, Version: ${report.version}\n`);
    process.stdout.write(`SHA-256: ${report.sha256}, Bytes: ${report.byteLength}\n`);
    if (report.warnings.length > 0) {
      process.stdout.write(`Warnings:\n- ${report.warnings.join('\n- ')}\n`);
    }
  } catch (error) {
    process.stderr.write(`Validation failed: ${(error as Error).message}\n`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli();
}
