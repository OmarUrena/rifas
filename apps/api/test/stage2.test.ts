import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chooseNumbers } from '../src/checkout/numbers';
import { progress, ticketWidth } from '../src/catalog/progress';

test('muestreo por rangos alcanza ambos extremos y todos los huecos sin duplicados',()=>{
  for(let rank=0;rank<6;rank++)assert.equal(chooseNumbers(10,[1,3,6,8],1,()=>rank)[0],[0,2,4,5,7,9][rank]);
  assert.deepEqual(chooseNumbers(10,[1,3,6,8],6,()=>0).sort((a,b)=>a-b),[0,2,4,5,7,9]);
  const occupied=Array.from({length:99998},(_,i)=>i+1);
  assert.deepEqual(chooseNumbers(100000,occupied,2).sort((a,b)=>a-b),[0,99999]);
  assert.throws(()=>chooseNumbers(3,[0,1,2],1));
  assert.throws(()=>chooseNumbers(3,[1,1],1));
});
test('CSPRNG devuelve solo números únicos elegibles sin crear el universo',()=>{
  const selected=chooseNumbers(100000,[0,10,99999],100);
  assert.equal(new Set(selected).size,100);
  assert.ok(selected.every(n=>n>0&&n<99999&&n!==10));
});
test('progreso entero exacto conserva precisión y distingue falta de objetivo',()=>{
  assert.deepEqual(progress('123',null),{progressPercent:null,actualProgressPercent:null});
  assert.deepEqual(progress('9999','10000'),{progressPercent:99,actualProgressPercent:'99'});
  assert.deepEqual(progress('30075','60150'),{progressPercent:50,actualProgressPercent:'50'});
  assert.deepEqual(progress('90071992547409910000','9007199254740991'),{progressPercent:100,actualProgressPercent:'1000000'});
  assert.equal(ticketWidth(100000,5),5);assert.equal(ticketWidth(10,1),5);assert.equal(ticketWidth(1000000,6),6);
});
