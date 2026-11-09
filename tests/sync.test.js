import test from 'node:test';
import assert from 'node:assert/strict';
import {applyRemote,acceptBatch} from '../src/sync.js';
const record={id:'s',type:'subscription',name:'Local',version:1};
test('empty device downloads cloud without clearing cloud records',()=>{const state=applyRemote({records:[],queue:[],conflicts:[]},[record],12);assert.equal(state.records[0].name,'Local');assert.equal(state.cursor,12);assert.deepEqual(state.queue,[]);});
test('simultaneous edits retain local record and expose conflict',()=>{const state=applyRemote({records:[record],queue:[{id:'b',changes:[{record,baseVersion:1}]}],conflicts:[]},[{...record,name:'Remote',version:2}],20);assert.equal(state.records[0].name,'Local');assert.equal(state.conflicts[0].remote.name,'Remote');assert.equal(state.queue.length,1);});
test('successful write acknowledgement preserves later offline edits',()=>{const later={...record,name:'Second edit'};const state={records:[later],queue:[{id:'b1',changes:[{record,baseVersion:1}]},{id:'b2',changes:[{record:later,baseVersion:1}]}],conflicts:[]};const next=acceptBatch(state,'b1',[{...record,version:2}]);assert.equal(next.records[0].name,'Second edit');assert.equal(next.queue.length,1);assert.equal(next.queue[0].changes[0].baseVersion,2);});
test('remote tombstones are retained for recovery',()=>{const next=applyRemote({records:[record],queue:[],conflicts:[]},[{...record,deletedAt:'2026-11-09T10:00:00Z',version:2}],2);assert.equal(next.records.length,1);assert.ok(next.records[0].deletedAt);});
