const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const moduleUnderTest = { exports: {} };
const code = ts.transpileModule(fs.readFileSync('lib/chatMedia.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
vm.runInNewContext('(function(exports){' + code + '})')(moduleUnderTest.exports);
const { parseChatImage, chatImagePath } = moduleUnderTest.exports;
test('private image paths and legacy public URLs resolve to the same stored object', () => {
  assert.equal(chatImagePath(parseChatImage('{"type":"image","storage_path":"owner/photo.jpg"}')), 'owner/photo.jpg');
  assert.equal(chatImagePath(parseChatImage('{"type":"image","url":"https://project.supabase.co/storage/v1/object/public/chat-media/owner/photo.jpg"}')), 'owner/photo.jpg');
});
test('malformed messages, traversal and external URLs never become storage paths', () => {
  assert.equal(parseChatImage('normal chat text'), null);
  assert.equal(parseChatImage('{"type":"location","url":"x"}'), null);
  for (const storage_path of ['../other/file.jpg', 'owner/../file.jpg', 'owner//file.jpg', 'owner\\file.jpg']) assert.equal(chatImagePath({type:'image', storage_path}), null);
  assert.equal(chatImagePath({type:'image',url:'https://example.com/photo.jpg'}), null);
});
