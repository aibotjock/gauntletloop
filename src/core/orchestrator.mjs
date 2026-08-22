import fs from 'node:fs';
import path from 'node:path';
import { invokeAgent, resolveAgent, resolveCritics } from './agents.mjs';
import { applyPatch, assertGitRepo, collectWorkspacePatch, currentHead, extractPatch, gitStatus } from './git.mjs';
import { builderPrompt, builderSystem, criticPrompt, criticSystem, parseCriticVerdict } from './prompts.mjs';
import { runVerification } from './verification.mjs';
import { nowId, truncate, writeJson } from './utils.mjs';

function passVotes(verdicts, policy = 'all') {
  const passes = verdicts.filter((v) => v.verdict === 'PASS').length;
  if (!verdicts.length) return false;
  return policy === 'majority' ? passes > verdicts.length / 2 : passes === verdicts.length;
}

function feedbackFrom(verdicts) {
  const failures = verdicts.filter((v) => v.verdict !== 'PASS');
  return failures.map((v) => [
    `Critic ${v.criticId}: ${v.primaryGap || 'FAIL'}`,
    ...(v.prioritizedCorrections || []).map((x) => `- ${x}`),
    ...(v.regressionRisks || []).map((x) => `Regression risk: ${x}`)
  ].join('\n')).join('\n\n');
}

function evidenceForCritic({ statusBefore, statusAfter, patch, verification, builderResult, builderError }) {
  return {
    workspaceStatusBefore: statusBefore,
    workspaceStatusAfter: statusAfter,
    patch: truncate(patch, 100000),
    verification,
    builderReport: builderResult ? truncate(builderResult.text, 30000) : null,
    builderError: builderError || null
  };
}

async function runCritics({ config, critics, builder, task, evidence, round, workspace }) {
  const verdicts = [];
  for (const critic of critics) {
    try {
      const response = await invokeAgent(config, critic, {
        system: criticSystem,
        prompt: criticPrompt({ task, builderId: builder.id, evidence, round }),
        cwd: workspace
      });
      verdicts.push({ criticId: critic.id, ...parseCriticVerdict(response.text), latencyMs: response.latencyMs, model: response.model, providerId: response.providerId });
    } catch (error) {
      verdicts.push({ criticId: critic.id, verdict: 'FAIL', primaryGap: `Critic invocation failed: ${error.message}`, observableEvidence: [], prioritizedCorrections: [], regressionRisks: [], residualIssues: [], error: error.message });
    }
  }
  return verdicts;
}

export async function runGauntlet({ config, workspace, targetUrl, onEvent = () => {} }) {
  await assertGitRepo(workspace);
  const runId = nowId('gauntlet');
  const runRoot = path.join(workspace, '.gauntlet', 'runs', runId);
  fs.mkdirSync(runRoot, { recursive: true });
  const task = config.task;
  const workflow = { maxRounds: 3, passPolicy: 'all', requireIndependentCritic: true, requireCleanWorkspace: true, ...config.workflow };
  const builder = resolveAgent(config, workflow.builder, 'builder', workflow.builderCapabilities || []);
  const critics = resolveCritics(config, workflow.critics, builder.id, workflow.criticCapabilities || []);
  if (critics.length < (workflow.minimumCritics || 1)) throw new Error(`Only ${critics.length} critics resolved; minimum is ${workflow.minimumCritics || 1}`);
  const initialHead = await currentHead(workspace);
  const initialStatus = await gitStatus(workspace);
  if (workflow.requireCleanWorkspace && initialStatus.trim()) throw new Error('Workspace is not clean. Commit/stash existing changes or set workflow.requireCleanWorkspace=false.');
  const state = { runId, task, builder: builder.id, critics: critics.map((c) => c.id), startedAt: new Date().toISOString(), rounds: [], finalVerdict: 'GAUNTLET NOT PASSED' };
  writeJson(path.join(runRoot, 'state.json'), state);
  onEvent({ type: 'start', runId, builder: builder.id, critics: critics.map((c) => c.id) });

  let feedback = '';
  let latestEvidence = null;
  let latestVerdicts = [];
  for (let round = 1; round <= workflow.maxRounds; round++) {
    const roundDir = path.join(runRoot, `round-${round}`);
    fs.mkdirSync(roundDir, { recursive: true });
    const statusBefore = await gitStatus(workspace);
    let builderResult = null;
    let builderError = null;
    let appliedPaths = [];
    onEvent({ type: 'round-start', round, builder: builder.id });
    try {
      builderResult = await invokeAgent(config, builder, {
        system: builderSystem,
        prompt: builderPrompt({ task, round, feedback, mode: builder.mode, workspaceSummary: config.workspaceSummary }),
        cwd: workspace
      });
      writeJson(path.join(roundDir, 'builder.json'), { agent: builder.id, provider: builderResult.providerId, model: builderResult.model, mode: builder.mode, latencyMs: builderResult.latencyMs, text: builderResult.text });
      if (builder.mode === 'patch') {
        const patch = extractPatch(builderResult.text);
        appliedPaths = await applyPatch(workspace, patch, config.security || {});
      }
    } catch (error) {
      builderError = error.message;
      writeJson(path.join(roundDir, 'builder-error.json'), { error: builderError });
    }
    const headAfter = await currentHead(workspace);
    if (!builderError && headAfter !== initialHead) builderError = 'Builder changed Git HEAD/created a commit. Commits are reserved for human/orchestrator authority.';
    const statusAfter = await gitStatus(workspace);
    const patch = await collectWorkspacePatch(workspace, config.security?.maxUntrackedBytes || 2_000_000);
    const verification = builderError ? { passed: false, skipped: true, reason: 'builder failed before verification' } : await runVerification({ config, workspace, runDir: path.join(roundDir, 'evidence'), targetUrl });
    const evidence = evidenceForCritic({ statusBefore, statusAfter, patch, verification, builderResult, builderError });
    latestEvidence = evidence;
    writeJson(path.join(roundDir, 'evidence.json'), evidence);
    const verdicts = await runCritics({ config, critics, builder, task, evidence, round, workspace });
    latestVerdicts = verdicts;
    writeJson(path.join(roundDir, 'critics.json'), verdicts);
    const verificationRequired = config.verification?.required !== false;
    const roundPassed = !builderError && (!verificationRequired || verification.passed) && passVotes(verdicts, workflow.passPolicy);
    const roundRecord = { round, builderError, appliedPaths, verificationPassed: verification.passed, verdicts, passed: roundPassed };
    state.rounds.push(roundRecord);
    writeJson(path.join(runRoot, 'state.json'), state);
    onEvent({ type: 'round-end', round, passed: roundPassed, verdicts: verdicts.map((v) => ({ critic: v.criticId, verdict: v.verdict })) });
    if (roundPassed) {
      const finalCritic = critics[round % critics.length];
      let finalReview;
      try {
        const response = await invokeAgent(config, finalCritic, {
          system: `${criticSystem}\nThis is the final adversarial review. Your assignment is to prove the product is NOT finished if credible evidence supports any remaining failure.`,
          prompt: criticPrompt({ task, builderId: builder.id, evidence, round: `${round}-FINAL` }),
          cwd: workspace
        });
        finalReview = { criticId: finalCritic.id, ...parseCriticVerdict(response.text), latencyMs: response.latencyMs };
      } catch (error) {
        finalReview = { criticId: finalCritic.id, verdict: 'FAIL', primaryGap: `Final critic failed: ${error.message}`, observableEvidence: [], prioritizedCorrections: [], regressionRisks: [], residualIssues: [], error: error.message };
      }
      writeJson(path.join(runRoot, 'final-adversarial-review.json'), finalReview);
      if (finalReview.verdict === 'PASS') {
        state.finalVerdict = 'GAUNTLET PASSED';
        state.completedAt = new Date().toISOString();
        state.finalReview = finalReview;
        writeJson(path.join(runRoot, 'state.json'), state);
        writeJson(path.join(runRoot, 'final-report.json'), { runId, verdict: state.finalVerdict, builder: builder.id, critics: critics.map((c) => c.id), rounds: state.rounds.length, finalReview, evidence: latestEvidence });
        onEvent({ type: 'complete', verdict: state.finalVerdict, runId });
        return { runId, runRoot, state, verdict: state.finalVerdict };
      }
      feedback = feedbackFrom([finalReview]);
    } else {
      feedback = builderError ? `Builder/runtime failure: ${builderError}` : feedbackFrom(verdicts);
    }
  }
  state.finalVerdict = 'GAUNTLET NOT PASSED';
  state.completedAt = new Date().toISOString();
  state.remainingGaps = latestVerdicts.filter((v) => v.verdict === 'FAIL').map((v) => ({ critic: v.criticId, primaryGap: v.primaryGap, corrections: v.prioritizedCorrections }));
  writeJson(path.join(runRoot, 'state.json'), state);
  writeJson(path.join(runRoot, 'final-report.json'), { runId, verdict: state.finalVerdict, rounds: state.rounds.length, remainingGaps: state.remainingGaps, evidence: latestEvidence });
  onEvent({ type: 'complete', verdict: state.finalVerdict, runId });
  return { runId, runRoot, state, verdict: state.finalVerdict };
}
