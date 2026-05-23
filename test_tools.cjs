/**
 * 孤立测试：DeepSeek 流式 tool calling 能否传参。
 * node test_tools.cjs
 */
const API_KEY = 'sk-a69007e1e5624df9a6ce2c4d5dcbe3f2';
const BASE_URL = 'https://api.deepseek.com';
const MODEL = 'deepseek-v4-flash';

const tools = [{
    type: 'function',
    function: {
        name: 'readDirectoryStructure',
        description: '列出指定目录下的文件。dirPath 为目录路径，如 "/"。',
        parameters: { type: 'object', properties: { dirPath: { type: 'string', description: '目录路径，如 "/"、"_word_notes"' } }, required: [] }
    }
}];

async function main() {
    const { default: OpenAI } = require('openai');
    const client = new OpenAI({ apiKey: API_KEY, baseURL: BASE_URL });

    // ── Test 1: OpenAI 非流式 ──
    console.log('\n=== Test 1: OpenAI 非流式 ===');
    const r1 = await client.chat.completions.create({ model: MODEL, messages: [{ role: 'user', content: '看一下我当前目录里有什么' }], tools, temperature: 0.3 });
    const m1 = r1.choices[0].message;
    console.log('content:', m1.content?.slice(0, 100));
    console.log('tool_calls:', JSON.stringify(m1.tool_calls?.[0]?.function?.arguments));

    // ── Test 2: OpenAI 流式 ──
    console.log('\n=== Test 2: OpenAI 流式 ===');
    const s2 = await client.chat.completions.create({ model: MODEL, messages: [{ role: 'user', content: '看一下我当前目录里有什么' }], tools, temperature: 0.3, stream: true });
    let c2 = '', tcs2 = [];
    for await (const c of s2) {
        const d = c.choices[0]?.delta;
        if (d?.content) { c2 += d.content; process.stdout.write(d.content); }
        if (d?.tool_calls) for (const tc of d.tool_calls) {
            const i = tc.index ?? tcs2.length;
            if (!tcs2[i]) tcs2[i] = { function: { name: '', arguments: '' } };
            if (tc.function?.name) tcs2[i].function.name += tc.function.name;
            if (tc.function?.arguments) tcs2[i].function.arguments += tc.function.arguments;
        }
    }
    console.log('\n  arguments:', tcs2[0]?.function?.arguments);

    // ── Test 3: LangChain ChatDeepSeek 非流式 ──
    console.log('\n=== Test 3: LangChain ChatDeepSeek 非流式 ===');
    const { ChatDeepSeek } = require('@langchain/deepseek');
    const l3 = new ChatDeepSeek({ model: MODEL, apiKey: API_KEY, temperature: 0.3 }).bindTools(tools);
    const r3 = await l3.invoke([{ role: 'user', content: '看一下我当前目录里有什么' }]);
    console.log('content:', r3.content?.slice(0, 100));
    console.log('args:', JSON.stringify(r3.tool_calls?.[0]?.args));

    // ── Test 4: LangChain ChatDeepSeek 流式 ──
    console.log('\n=== Test 4: LangChain ChatDeepSeek 流式 ===');
    const l4 = new ChatDeepSeek({ model: MODEL, apiKey: API_KEY, temperature: 0.3 }).bindTools(tools);
    const s4 = await l4.stream([{ role: 'user', content: '看一下我当前目录里有什么' }]);
    let c4 = '', tcs4 = [];
    for await (const c of s4) {
        if (c.content) { const t = typeof c.content === 'string' ? c.content : ''; c4 += t; process.stdout.write(t); }
        if (c.tool_calls?.length) { console.log('\n[chunk.tool_calls]', JSON.stringify(c.tool_calls)); tcs4 = c.tool_calls; }
    }
    console.log('\n  args:', JSON.stringify(tcs4[0]?.args));
}

main().catch(e => console.error(e.message, e.status || ''));
