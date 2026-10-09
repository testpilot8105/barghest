// The three-command ontology build (pnpm ontology:build): maker compiles ontology.mts to IR, the converter turns
// the IR into ontology.json (the Foundry Ontology v2 metadata that faux serves and the generator reads), and the
// OSDK CLI generates the typed SDK into sdk/. All offline, no Foundry.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OntologyIrToFullMetadataConverter } from '@osdk/generator-converters.ontologyir';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bin = (name) => join(root, 'node_modules', '.bin', process.platform === 'win32' ? `${name}.cmd` : name);
const run = (name, args) => execFileSync(bin(name), args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });

console.log('1/3 maker: ontology/ontology.mts -> ontology/ontology.ir.json');
run('maker', [
  '-i', 'ontology/ontology.mts',
  '-o', 'ontology/ontology.ir.json',
  '--snapshotDir', 'ontology/snapshots',
  '--writeLocks', '--yes',
]);

console.log('2/3 converter: ontology/ontology.ir.json -> ontology/ontology.json');
const ir = JSON.parse(readFileSync(join(root, 'ontology', 'ontology.ir.json'), 'utf8'));
const meta = OntologyIrToFullMetadataConverter.getFullMetadataFromIr(ir.ontology);
// The converter leaves pluralDisplayName empty; the explorer's pickers need it, so carry it over from the IR.
for (const [apiName, def] of Object.entries(meta.objectTypes)) {
  const plural = ir.ontology.objectTypes[apiName]?.objectType?.displayMetadata?.pluralDisplayName;
  if (plural && !def.objectType.pluralDisplayName) def.objectType.pluralDisplayName = plural;
}
writeFileSync(join(root, 'ontology', 'ontology.json'), JSON.stringify(meta, null, 2));
console.log(`    ${Object.keys(meta.objectTypes).length} object types, ${Object.keys(meta.actionTypes).length} actions, ontology ${meta.ontology.rid}`);

console.log('3/3 osdk: ontology/ontology.json -> sdk/');
run('osdk', [
  'unstable', 'typescript', 'generate',
  '--ontologyPath', 'ontology/ontology.json',
  '--outDir', 'sdk',
  '--version', 'dev',
  '--packageType', 'module',
  '--beta', 'true',
  '--clean',
  // The generator otherwise rewrites package.json: carets on the pinned OSDK versions and a peerDependencies block.
  '--skipPackageJsonUpdate',
]);
console.log('ontology:build: done');
