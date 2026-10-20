const test = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, filename);
const { filterQuestions, DEFAULT_QUESTION_FILTERS: defaults } = require('../lib/questionFilters.ts');
const now = Date.parse('2026-10-20T12:00:00Z');
const rows = [
 { id:'normal', title:'اقتراح', author_id:'me', created_at:'2026-10-20T10:00:00Z',district:'حي أ', answers_count:0 },
 { id:'tool', title:'إعارة دريل', is_tool_sharing:true, author_id:'me', created_at:'2026-10-18T10:00:00Z',district:'حي ب',answers_count:2 },
 { id:'emergency', title:'طارئ',is_emergency:true,author_id:'other',created_at:'2026-10-20T11:00:00Z',district:'حي ب',best_answer_id:'a',answers_count:8 },
 { id:'donate', title:'أثاث',item_type:'donate',author_id:'other',created_at:'2026-09-01T10:00:00Z',district:'حي ب',answers_count:1 },
];
const run=(filter={},sort='newest')=>filterQuestions(rows,{...defaults,...filter},'me',sort,'حي أ',now).map(q=>q.id);
test('types use stored flags including donations without a title keyword',()=>{assert.deepEqual(run({kind:'تبرعات'}),['donate']);assert.deepEqual(run({kind:'إعارة أدوات'}),['tool']);assert.deepEqual(run({kind:'الطوارئ'}),['emergency']);assert.deepEqual(run({kind:'استفسارات'}),['normal']);});
test('author, status and time filters compose',()=>{assert.deepEqual(run({author:'منشوراتي',status:'تم الرد',period:'هذا الأسبوع'}),['tool']);assert.deepEqual(run({status:'مكتمل'}),['emergency']);assert.deepEqual(run({period:'اليوم',status:'بانتظار المساعدة'}),['normal']);});
test('sorting changes results and keeps source immutable',()=>{assert.equal(run({},'engaged')[0],'emergency');assert.equal(run({},'nearby')[0],'normal');assert.equal(run()[0],'emergency');assert.equal(rows[0].id,'normal');});
test('guest cannot select another users own-post scope',()=>{assert.equal(filterQuestions(rows,{...defaults,author:'منشوراتي'},null,'newest','حي أ',now).length,0);});
