import { act, chat } from './wron-ai';

const langLine = (l) =>
  l && l !== 'Automatic' ? `Write your answer in ${l}.` : 'Write your answer in the same language as the input.';

const obj = (properties) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const str = { type: 'string' };
const strs = { type: 'array', items: { type: 'string' } };

const STEP_COUNTS = ['3 to 4', '4 to 6', '6 to 8', '8 to 10', '10 to 14'];
const STEP_STYLE = [
  'broad, simple steps',
  'clear, practical steps',
  'concrete, small steps',
  'very small steps that each take a few minutes',
  'tiny, almost effortless steps, including the smallest possible first move',
];

function cleanList(list) {
  const seen = new Set();
  const out = [];
  (Array.isArray(list) ? list : []).forEach((s) => {
    const v = String(s || '').replace(/^[\s\-*\d.)]+/, '').trim();
    const k = v.toLowerCase();
    if (v && !seen.has(k)) {
      seen.add(k);
      out.push(v);
    }
  });
  return out;
}

export async function breakDown({ task, spice = 3, language, listName }) {
  const level = Math.max(1, Math.min(5, Number(spice) || 3));
  const data = await act({
    instruction:
      `You help people who get overwhelmed by tasks. Break the task into ${STEP_COUNTS[level - 1]} ordered steps, written as ${STEP_STYLE[level - 1]}. ` +
      'Each step is a short imperative sentence (under 12 words). No numbering, no explanations. ' +
      langLine(language),
    input: listName && listName !== task ? `Task: ${task}\nPart of the list: ${listName}` : `Task: ${task}`,
    schema: obj({ steps: strs }),
    maxTokens: 700,
  });
  return cleanList(data && data.steps);
}

export async function estimateTimes({ tasks, language }) {
  const data = await act({
    instruction:
      'Estimate how many minutes a typical person needs for each task. Return one whole number of minutes per task, in the same order, at least 1. ' +
      langLine(language),
    input: tasks.map((t, i) => `${i + 1}. ${t}`).join('\n'),
    schema: obj({ minutes: { type: 'array', items: { type: 'number' } } }),
    maxTokens: 400,
  });
  const arr = (data && data.minutes) || [];
  return tasks.map((_, i) => Math.max(1, Math.round(Number(arr[i]) || 5)));
}

export async function formalize({ text, tone, format, language }) {
  const shape =
    format === 'Email'
      ? 'Format it as a ready-to-send email body with a greeting and a sign-off placeholder only if natural.'
      : format === 'Text'
      ? 'Format it as a short text message.'
      : 'Keep the same overall form as the original.';
  const data = await act({
    instruction:
      `Rewrite the text in a ${String(tone).toLowerCase()} tone. Keep the meaning and every fact; never add new facts or commitments. ${shape} Return only the rewritten text. ` +
      langLine(language),
    input: text,
    schema: obj({ text: str }),
    maxTokens: 900,
  });
  const out = String((data && data.text) || '').trim();
  if (!out) throw new Error('Nothing came back. Please try again.');
  return out;
}

export async function judgeText({ text, language }) {
  const data = await act({
    instruction:
      'You read short messages for emotional tone. Report the primary emotion (one or two words), overall valence, up to five emotions with an intensity from 0 to 100, ' +
      'the level of formality, the likely intent of the sender, how it may come across to the reader, and one practical tip for replying. ' +
      'Be gentle and say these are guesses. valence must be one of: positive, negative, neutral, mixed. ' +
      langLine(language),
    input: text,
    schema: obj({
      primary: str,
      valence: str,
      summary: str,
      emotions: {
        type: 'array',
        items: obj({ name: str, intensity: { type: 'number' } }),
      },
      formality: str,
      intent: str,
      landing: str,
      tip: str,
    }),
    maxTokens: 900,
  });
  if (!data || !data.primary) throw new Error('Nothing came back. Please try again.');
  return data;
}

const LEVELS = {
  ELI5: "Explain like the reader is five years old: tiny words, a friendly analogy, no jargon.",
  Simple: 'Explain simply and clearly in plain language, in a few short paragraphs at most.',
  Detailed: 'Explain thoroughly, with structure, examples and the key nuances.',
  Expert: 'Explain at an expert level, with precise terminology and depth.',
};

export async function professorReply({ messages, level, language }) {
  const system =
    `You are Professor, a patient teacher inside a calm app for people who feel overwhelmed. ${LEVELS[level] || LEVELS.Simple} ` +
    'Be accurate. If you are unsure, say so. Keep formatting light: short paragraphs, no markdown headings. ' +
    langLine(language);
  const reply = await chat(messages, { system, maxTokens: 900 });
  const out = String(reply || '').trim();
  if (!out) throw new Error('Nothing came back. Please try again.');
  return out;
}

export async function consult({ dilemma, options, language }) {
  const data = await act({
    instruction:
      'You help someone make a decision. Give a one-sentence summary of the dilemma, 2 to 4 options (use the ones given, or suggest sensible ones), ' +
      'each with up to 3 short pros and up to 3 short cons, 3 questions the person should ask themselves, and which option seems to fit best with a reason. ' +
      'Be balanced and kind; the final choice is theirs. ' +
      langLine(language),
    input: `Dilemma: ${dilemma}${options ? `\nOptions I am considering: ${options}` : ''}`,
    schema: obj({
      summary: str,
      options: { type: 'array', items: obj({ name: str, pros: strs, cons: strs }) },
      questions: strs,
      leaning: str,
      reason: str,
    }),
    maxTokens: 1200,
  });
  if (!data || !Array.isArray(data.options) || data.options.length === 0) {
    throw new Error('Nothing came back. Please try again.');
  }
  return data;
}
