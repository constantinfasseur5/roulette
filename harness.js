'use strict';
// Piepklein testframework (geen pakketten nodig).
let passed = 0;
const failures = [];
let section = '';

function group(name) {
  section = name;
  console.log(`\n# ${name}`);
}

function ok(cond, msg) {
  if (cond) { passed += 1; console.log(`  ok   ${msg}`); }
  else { failures.push(`${section}: ${msg}`); console.log(`  FAIL ${msg}`); }
}

function eq(actual, expected, msg) {
  const same = JSON.stringify(actual) === JSON.stringify(expected);
  if (same) { passed += 1; console.log(`  ok   ${msg}`); }
  else {
    failures.push(`${section}: ${msg} (kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)})`);
    console.log(`  FAIL ${msg}\n       kreeg    ${JSON.stringify(actual)}\n       verwacht ${JSON.stringify(expected)}`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function summary() {
  console.log(`\n${passed} geslaagd, ${failures.length} mislukt`);
  if (failures.length) { console.log(failures.map((f) => ' - ' + f).join('\n')); }
  return failures.length === 0;
}

module.exports = { group, ok, eq, sleep, summary };
