import { UIStrings } from './types';

export const zhCN: UIStrings = {
	selection: { analyze: '分析', translate: '翻译', loading: '...', error: '出错了', processing: '正在分析，请稍候...' },
	note: { word: '单词', phrase: '短语', meaning: '含义', pronunciation: '读音', etymology: '词源', example: '例句与语境分析', fullNote: '打开完整笔记', reinterpret: '当前语境下重新解释', confirmAppend: '确认追加到笔记', cancel: '取消', appended: '已追加到笔记 ✓', appendFailed: '追加失败' },
	panel: { title: '语言学习AI面板', welcome: '👋 语言学习AI助手', welcomeSub: '划词后AI解释会在此显示。你也可以直接输入问题。', placeholder: '输入问题...', send: '发送', newChat: '+ 新建', graph: '图谱', reset: '重置', completed: '✓ 关系图谱生成完成', processing: '正在处理:' },
	settings: { ai: 'AI 配置', provider: '模型提供商', endpoint: 'API 地址', apiKey: 'API Key', model: '模型', language: '语言环境', nativeLang: '用户语言', nativeLangDesc: '你的母语', targetLang: '学习语言', targetLangDesc: '你正在学习的语言', storage: '存储路径', wordFolder: '单词笔记文件夹', phraseFolder: '短语笔记文件夹', hover: '悬浮窗', hoverEnabled: '启用悬浮窗' },
	commands: { analyze: '分析选中文本', forceStore: '强制存储选中文本', reanalyze: '重新分析当前单词/短语', generateRelations: '生成关系图谱', refreshIndex: '刷新索引' },
	notice: { generated: '正在为 "{text}" 生成笔记...', generating: '正在分析...', failed: '处理失败: {msg}\n\n请检查 AI 配置是否正确。', cleared: '✓ 已清除所有关系标记和笔记中的关联链接', checkConfig: '请检查 AI 配置是否正确。', langChanged: '语言已切换。重新打开设置页查看完整效果' },
	vocab: { noHistory: '(无历史)' },
};
