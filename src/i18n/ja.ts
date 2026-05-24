import { UIStrings } from './types';

export const ja: UIStrings = {
	selection: { analyze: '分析', translate: '翻訳', loading: '...', error: 'エラー', processing: '分析中、しばらくお待ちください...' },
	note: { word: '単語', phrase: 'フレーズ', meaning: '意味', pronunciation: '発音', etymology: '語源', example: '例文と文脈分析', fullNote: '完全なノートを開く', reinterpret: '現在の文脈で再解釈', confirmAppend: 'ノートに追加を確認', cancel: 'キャンセル', appended: 'ノートに追加しました ✓', appendFailed: '追加に失敗しました' },
	panel: { title: '言語学習AIパネル', welcome: '👋 言語学習AIアシスタント', welcomeSub: 'テキストを選択すると、AIの解釈がここに表示されます。直接質問することもできます。', placeholder: '質問を入力...', send: '送信', newChat: '+ 新規作成', graph: 'グラフ', reset: 'リセット', completed: '✓ 関係グラフの生成が完了しました', processing: '処理中:' },
	settings: { ai: 'AI 設定', provider: 'モデルプロバイダー', endpoint: 'API アドレス', apiKey: 'API Key', model: 'モデル', language: '言語環境', nativeLang: '母国語', nativeLangDesc: 'あなたの母国語', targetLang: '学習言語', targetLangDesc: '学習中の言語', storage: 'ストレージパス', wordFolder: '単語ノートフォルダ', phraseFolder: 'フレーズノートフォルダ', hover: 'ホバーウィンドウ', hoverEnabled: 'ホバーウィンドウを有効にする' },
	commands: { analyze: '選択したテキストを分析', forceStore: '選択したテキストを強制保存', reanalyze: '現在の単語/フレーズを再分析', generateRelations: '関係グラフを生成', refreshIndex: 'インデックスを更新' },
	notice: { generated: '"{text}" のノートを生成中...', generating: '分析中...', failed: '処理に失敗しました: {msg}\n\nAI設定が正しいか確認してください。', cleared: '✓ すべての関係マークとノート内のリンクがクリアされました', checkConfig: 'AI設定が正しいか確認してください。', langChanged: '言語を切り替えました。設定ページを再度開いて完全な効果を確認してください' },
	vocab: { noHistory: '(履歴なし)' },
};
