// The assistant loop:
//   1. Send the conversation and the allowed tools to the AI.
//   2. If the AI asks for a READ tool, run it on this user's data and send the result back; repeat.
//   3. If the AI asks for a WRITE tool, build a preview card and stop. Nothing changes until the user confirms.
//   4. If the AI replies with text, that's the answer.
import { chatCompletion } from './llm.js';
import { READ_TOOLS, WRITE_TOOLS, WRITE_TOOL_NAMES } from './tools.js';
import { runReadTool } from './readTools.js';
import { prepareWrite } from './writeTools.js';
import { systemPrompt } from './prompt.js';
import { signAction } from '../auth.js';
import { loadAll } from '../services/account.js';

const MAX_STEPS = 5;

/** Keep only the last few messages, as plain text, so requests stay small. */
const cleanHistory = (history = []) => history
  .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
  .slice(-8)
  .map((m) => ({ role: m.role, content: m.content.slice(0, 1500) }));

export async function runAssistant({ userId, mode, message, history }) {
  const data = await loadAll(userId);
  const tools = mode === 'write' ? [...READ_TOOLS, ...WRITE_TOOLS] : READ_TOOLS;
  const messages = [
    { role: 'system', content: systemPrompt(data.seller, mode) },
    ...cleanHistory(history),
    { role: 'user', content: String(message).slice(0, 2000) },
  ];
  const used = [];
  let engine = null;

  for (let step = 0; step < MAX_STEPS; step++) {
    const { message: reply, provider } = await chatCompletion(messages, tools);
    engine = provider;
    const calls = reply.tool_calls || [];

    if (!calls.length) {
      return { text: (reply.content || '').trim() || 'Sorry, I didn’t get that. Could you rephrase?', sources: used, engine };
    }

    messages.push({ role: 'assistant', content: reply.content || '', tool_calls: calls });

    for (const call of calls) {
      const name = call.function?.name;
      let args = {};
      try { args = JSON.parse(call.function?.arguments || '{}'); } catch { /* keep {} */ }
      used.push(name);

      let result;
      if (WRITE_TOOL_NAMES.has(name)) {
        if (mode !== 'write') {
          result = { error: 'Changes are not allowed in Read mode. Tell the user to switch to Write mode.' };
        } else {
          try {
            const { action, card } = prepareWrite(name, args, data);
            return {
              text: 'Here’s the change I’ll make. Nothing is saved until you confirm.',
              card, token: signAction(userId, action), sources: used, engine,
            };
          } catch (err) {
            result = { error: err.message }; // the AI explains the problem or asks the user
          }
        }
      } else {
        try { result = runReadTool(name, args, data); } catch (err) { result = { error: err.message }; }
      }
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result).slice(0, 8000) });
    }
  }
  return { text: 'Sorry, that took too many steps. Please ask in a simpler way.', sources: used, engine };
}
