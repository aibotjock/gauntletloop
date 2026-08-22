import fs from 'node:fs';
import path from 'node:path';

export function verifyBrowserEvidence(manifestPath) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const failures = [];
  if (manifest.fatalError) failures.push(`fatal browser error: ${manifest.fatalError.message}`);
  const policy = manifest.policy || {};
  for (const record of manifest.records || []) {
    const label = `${record.viewport?.name}/${record.route}/${record.kind}:${record.scenario}`;
    if (record.navigationError) failures.push(`${label}: navigation failed: ${record.navigationError.message}`);
    if (!record.screenshot) failures.push(`${label}: screenshot missing`);
    else if (!fs.existsSync(path.join(path.dirname(manifestPath), record.screenshot))) failures.push(`${label}: screenshot file missing`);
    if (record.responseStatus && record.responseStatus >= 400) failures.push(`${label}: HTTP status ${record.responseStatus}`);
    if (policy.failOnConsoleErrors && (record.consoleErrors?.length || record.pageErrors?.length)) failures.push(`${label}: browser/page errors detected`);
    if (policy.failOnRequestFailures && record.requestFailures?.length) failures.push(`${label}: failed network requests detected`);
    if (policy.failOnHorizontalOverflow && record.audit?.documentHasHorizontalOverflow) failures.push(`${label}: horizontal overflow detected`);
    if (policy.failOnA11yHeuristics && record.audit?.a11yHeuristicIssues?.length) failures.push(`${label}: baseline accessibility heuristic issues detected`);
  }
  for (const viewport of (manifest.viewports || []).filter((v) => v.required !== false)) {
    for (const route of manifest.routes || []) {
      const found = (manifest.records || []).some((r) => r.viewport?.name === viewport.name && r.route === route.name && r.kind === 'base');
      if (!found) failures.push(`missing required base evidence: ${viewport.name}/${route.name}`);
    }
  }
  return { passed: failures.length === 0, failures, recordCount: manifest.records?.length || 0 };
}
