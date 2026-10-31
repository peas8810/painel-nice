const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../gestao/workflow.js'), 'utf8');

function harness() {
  const elements = new Map(), timers = [], calls = [];
  function element() {
    return {
      children: [], dataset: {}, value: '', disabled: false, listeners: {}, textContent: '',
      append(child) { this.children.push(child); },
      replaceChildren() { this.children = []; },
      addEventListener(name, fn) { this.listeners[name] = fn; },
      querySelector() { return this.button ||= element(); },
      get options() { return this.children; },
      get selectedOptions() { return this.children.slice(0, 1); }
    };
  }
  const $ = id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); };
  let mutation;
  const db = {
    auth: { onAuthStateChange() {} },
    async rpc(name, args) {
      calls.push({ name, args });
      if (name === 'academy_workflow_list') return { data: [] };
      if (name === 'academy_workflow_snapshot') return { data: [
        { instance_id: 'instance-a', request_id: 'request-a', workflow_name: 'Review', step_label: 'Second', step_order: 2, revision: 4, state: 'EM_ANALISE' }
      ] };
      if (name === 'academy_workflow_transition') return mutation();
      return { data: [] };
    }
  };
  vm.runInNewContext(source, {
    document: { getElementById: $, createElement: element },
    window: { ACADEMY_AUTH_CONFIG: {}, supabase: { createClient: () => db }, addEventListener() {} },
    setTimeout: fn => timers.push(fn), confirm: () => true
  });
  return { $, calls, async load() { await timers.at(-1)(); }, setMutation(fn) { mutation = fn; } };
}

test('decision carries displayed step, blocks double submission and clears note after success', async () => {
  const h = harness(); await h.load();
  let resolve;
  h.setMutation(() => new Promise(done => { resolve = done; }));
  h.$('workflow-decision').value = 'AVANCAR';
  h.$('workflow-note').value = 'Evidence verified';
  const submit = h.$('workflow-decision-form').listeners.submit;
  const event = { preventDefault() {} };
  const first = submit(event);
  await submit(event);
  const decisions = h.calls.filter(x => x.name === 'academy_workflow_transition');
  assert.equal(decisions.length, 1);
  assert.equal(decisions[0].args.p_revision, 4);
  assert.equal(decisions[0].args.p_instance, 'instance-a');
  resolve({ data: 'EM_ANALISE' }); await first;
  assert.equal(h.$('workflow-note').value, '');
  assert.equal(h.$('workflow-decision-form').button.disabled, false);
});

test('network failure preserves note, refreshes inbox and restores decision button', async () => {
  const h = harness(); await h.load();
  h.setMutation(() => Promise.reject(new Error('offline')));
  h.$('workflow-note').value = 'Keep this justification';
  await h.$('workflow-decision-form').listeners.submit({ preventDefault() {} });
  assert.equal(h.$('workflow-note').value, 'Keep this justification');
  assert.match(h.$('workflow-decision-status').textContent, /offline/);
  assert.equal(h.calls.filter(x => x.name === 'academy_workflow_snapshot').length, 2);
  assert.equal(h.$('workflow-decision-form').button.disabled, false);
});
