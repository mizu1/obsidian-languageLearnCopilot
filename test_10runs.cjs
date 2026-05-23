/**
 * 连续 10 次，验证 prompt 一致性和结果稳定性
 */
const API_KEY = 'sk-a69007e1e5624df9a6ce2c4d5dcbe3f2';
const MODEL = 'deepseek-v4-flash';

const prompt_antonym = `判断哪些词与目标词有反义关系（反义词）。

严格要求：
- 必须是语义直接对立或相反的词（如 hot↔cold, big↔small）。
- 仅是不同、不相似、或主题无关不算反义。不确定是否反义就返回 []。
- 同义词不算。

返回格式：纯 JSON 数组，没有就返回 []。不要输出其他内容。`;

async function run(n) {
  const { ChatDeepSeek } = require('@langchain/deepseek');
  const llm = new ChatDeepSeek({ model: MODEL, apiKey: API_KEY, temperature: 0 });
  const focus = 'blooms';
  const candidates = ['unchanging','unchanged','shifting','concept','novelty','change','adapt'];

  const system = prompt_antonym.replace('目标词', focus);
  const r = await llm.invoke([{ role:'system', content:system }, { role:'user', content:candidates.join('\n') }]);
  const raw = r.content?.trim();
  const match = raw.match(/\[[\s\S]*\]/);
  const parsed = match ? JSON.parse(match[0]) : [];
  return { n, raw, parsed };
}

async function main() {
  console.log(`\n连续 10 次 (${MODEL})`);
  const results = [];
  for (let i = 0; i < 10; i++) {
    const r = await run(i+1);
    results.push(r);
    console.log(`#${r.n}:`, JSON.stringify(r.parsed));
  }
  const allEmpty = results.every(r => r.parsed.length === 0);
  const allSame = new Set(results.map(r => JSON.stringify(r.parsed))).size === 1;
  console.log(`\n全部为空: ${allEmpty}  全部一致: ${allSame}`);
}
main().catch(e => console.error(e.message));
