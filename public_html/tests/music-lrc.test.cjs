const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const context = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../js/music-lyrics.js'), 'utf8'), context);
const parse = text => JSON.parse(JSON.stringify(context.window.MeowLrc.parse(text)));

assert.deepEqual(parse('\uFEFF[ti:Sample]\r\n[00:03.125]Tiếng Việt\r\n[00:01.5]Một\r\n[00:06]'), [
  {start:1.5,text:'Một'}, {start:3.125,text:'Tiếng Việt'}, {start:6,text:''}
]);
assert.deepEqual(parse('[00:02][00:12.50]Điệp khúc\n[offset:+500]'), [
  {start:1.5,text:'Điệp khúc'}, {start:12,text:'Điệp khúc'}
]);
assert.deepEqual(parse('[offset:-500]\n[00:02.00]<00:02.00>Xin <00:02.50>chào'), [{start:2.5,text:'Xin chào'}]);
assert.deepEqual(parse('[00:03]Một\n[00:03]Hai\n[00:03]Hai\n[00:03]\n[00:04]'), [
  {start:3,text:'Một / Hai'}, {start:4,text:''}
]);
assert.deepEqual(parse('[ar:Artist]\nplain words\n[00:99]invalid\n[00:01.9999]invalid'), []);
assert.deepEqual(parse('[offset:500]\n[00:00.20]Beginning'), [{start:0,text:'Beginning'}]);
console.log('6 LRC parser checks passed');
