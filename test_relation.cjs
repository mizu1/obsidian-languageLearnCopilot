/**
 * Isolated relation matching test.
 * node test_relation.cjs
 */
const API_KEY = 'sk-a69007e1e5624df9a6ce2c4d5dcbe3f2';
const MODEL = 'deepseek-v4-flash';

const prompts = {
  synonym: `判断哪些词与目标词有同义关系（同义词）。

严格要求：
- 必须是含义相同或极高度相近的词，可以互换使用而不改变句意。
- 仅是相关领域或主题相近不算。不确定是否同义就返回 []。
- 反义词不算。

返回格式：纯 JSON 数组，没有就返回 []。不要输出其他内容。`,

  antonym: `判断哪些词与目标词有反义关系（反义词）。

严格要求：
- 必须是语义直接对立或相反的词（如 hot↔cold, big↔small）。
- 仅是不同、不相似、或主题无关不算反义。不确定是否反义就返回 []。
- 同义词不算。

返回格式：纯 JSON 数组，没有就返回 []。不要输出其他内容。`,

  cognate: `判断哪些词与目标词有同源关系。

严格要求：
- 必须共享明确可辨识的词根（如 inspect/respect/spectator 共享 -spect-）。
- 必须是同一拉丁/希腊/日耳曼等语源的派生词，你能明确说出词根是什么。
- 仅拼写相似、发音接近、或主题相关不算。不确定就返回 []。

返回格式：纯 JSON 数组，没有就返回 []。不要输出其他内容。`
};

const words = ['unchanging','unchanged','shifting','concept','novelty','change','adapt','blooms'];

async function askAI(type, focus, candidates) {
  const { ChatDeepSeek } = require('@langchain/deepseek');
  const llm = new ChatDeepSeek({ model: MODEL, apiKey: API_KEY, temperature: 0.3 });

  const system = prompts[type].replace('目标词', focus);
  const user = candidates.join('\n');

  console.log(`\n=== [${type}] focus="${focus}" candidates=${candidates.length} ===`);
  console.log('System:', system.slice(0,150));
  console.log('User:', user);

  const r = await llm.invoke([{ role:'system', content:system }, { role:'user', content:user }]);
  const raw = r.content?.trim() || '';

  console.log('Raw:', raw);

  const match = raw.match(/\[[\s\S]*\]/);
  const parsed = match ? (() => { try { return JSON.parse(match[0]); } catch { return []; } })() : [];
  console.log('Parsed:', JSON.stringify(parsed));

  const result = Array.isArray(parsed)
    ? parsed.map(p => typeof p === 'string' ? p : p.word2 || p.word1 || '').filter(Boolean)
    : [];
  console.log('Result:', result);
  return result;
}

async function main() {
  console.log('=== Relation Matching Test ===\n');

  const focus = 'blooms';
  const candidates = words.filter(w => w !== focus);

  console.log('\n--- SYNONYM ---');
  const syn = await askAI('synonym', focus, candidates);

  console.log('\n--- ANTONYM ---');
  const ant = await askAI('antonym', focus, candidates);

  console.log('\n--- COGNATE ---');
  const cog = await askAI('cognate', focus, candidates);

  console.log('\n=== SUMMARY ===');
  console.log('blooms synonym:', syn);
  console.log('blooms antonym:', ant);
  console.log('blooms cognate:', cog);

  // Test: run antonym twice to see consistency
  console.log('\n--- ANTONYM (repeat to check consistency) ---');
  const ant2 = await askAI('antonym', focus, candidates);
  console.log('Match with first run?', JSON.stringify(ant) === JSON.stringify(ant2));
}

main().catch(e => console.error(e.message));
