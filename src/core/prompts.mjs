import { truncate } from './utils.mjs';

export const builderSystem = `You are the Builder in a Universal Gauntlet engineering loop. Work only within the authorized task and workspace. Preserve unrelated working behavior. Never claim that your own work passed the Gauntlet. Be factual about tests and blockers. Do not expose, copy, or invent credentials. Do not bypass security or human approval boundaries.`;

export function builderPrompt({ task, round, feedback, mode, workspaceSummary }) {
  const acceptance = (task.acceptanceCriteria || task.acceptance || []).map((x, i) => `${i + 1}. ${x}`).join('\n') || '(No additional acceptance criteria supplied.)';
  const feedbackText = feedback ? `\nPRIOR CRITIC FEEDBACK:\n${truncate(feedback, 30000)}\n` : '';
  const modeInstruction = mode === 'patch'
    ? `Return a valid git unified diff between exact markers:\nBEGIN_GAUNTLET_PATCH\n<diff --git ...>\nEND_GAUNTLET_PATCH\nThe patch must only touch files required by the task. Do not put prose inside the patch markers.`
    : mode === 'workspace'
      ? `Edit the working tree directly. You may use the coding agent's normal file and terminal tools within its configured permissions. Do not commit or push. Return a concise factual summary of changes and checks.`
      : `Do not modify files. Produce an implementation plan or analysis only.`;
  return `ROUND: ${round}\n\nOBJECTIVE:\n${task.objective}\n\nACCEPTANCE CRITERIA:\n${acceptance}\n${feedbackText}\nEXECUTION MODE:\n${modeInstruction}\n\nWORKSPACE CONTEXT:\n${workspaceSummary || 'Use the current working directory as the source of truth.'}`;
}

export const criticSystem = `You are an independent adversarial Critic in a Universal Gauntlet loop. Judge only objective requirements and supplied evidence. Ignore builder effort, intent, confidence, and iteration count. Missing required evidence is a failure, not a neutral condition. Return JSON only. Never edit files.`;

export function criticPrompt({ task, builderId, evidence, round }) {
  const acceptance = (task.acceptanceCriteria || task.acceptance || []).map((x, i) => `${i + 1}. ${x}`).join('\n') || '(No additional acceptance criteria supplied.)';
  return `Evaluate round ${round} produced by builder ${builderId}.\n\nOBJECTIVE:\n${task.objective}\n\nACCEPTANCE CRITERIA:\n${acceptance}\n\nEVIDENCE PACKAGE:\n${truncate(JSON.stringify(evidence, null, 2), 140000)}\n\nReturn exactly one JSON object with this shape:\n{\n  "verdict": "PASS" | "FAIL",\n  "primaryGap": "string",\n  "observableEvidence": ["string"],\n  "prioritizedCorrections": ["string"],\n  "regressionRisks": ["string"],\n  "residualIssues": ["string"]\n}\nA PASS requires the evidence to support every applicable acceptance criterion and required verification gate.`;
}

export function parseCriticVerdict(text) {
  const raw = String(text || '').trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  let parsed;
  try { parsed = JSON.parse(raw); } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('Critic did not return parseable JSON');
    parsed = JSON.parse(raw.slice(start, end + 1));
  }
  if (!['PASS', 'FAIL'].includes(parsed.verdict)) throw new Error('Critic verdict must be PASS or FAIL');
  for (const key of ['observableEvidence', 'prioritizedCorrections', 'regressionRisks', 'residualIssues']) {
    if (!Array.isArray(parsed[key])) parsed[key] = parsed[key] ? [String(parsed[key])] : [];
  }
  parsed.primaryGap = String(parsed.primaryGap || '');
  return parsed;
}
