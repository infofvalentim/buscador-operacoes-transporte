import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dataDirectory = resolve(repositoryRoot, 'data');
const cpfPattern = /\b\d{3}(?:[.\s]?\d{3}){2}-?\d{2}\b/g;
const findings = [];

for (const filename of readdirSync(dataDirectory).filter(name => name.endsWith('.json'))) {
  const contents = readFileSync(resolve(dataDirectory, filename), 'utf8');
  const matches = contents.match(cpfPattern);
  if (matches) findings.push({ filename, count: matches.length });
}

if (findings.length) {
  findings.forEach(({ filename, count }) => {
    console.error(`Possible CPF data found in data/${filename} (${count} match(es)); values omitted.`);
  });
  process.exitCode = 1;
} else {
  console.log('No CPF-like values found in data/*.json.');
}
