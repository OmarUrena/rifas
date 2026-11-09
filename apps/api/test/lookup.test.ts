import assert from 'node:assert/strict';
import { test } from 'node:test';
import { maskHalf, maskLookupEmail, normalizeLookupPhone } from '../src/ticket-lookup/lookup.core';
test('consulta: censura al menos la mitad y nunca publica completo un valor corto',()=>{
  for(const name of ['A','AB','ABC','CLIENTE DEMO','ÁÉÍÓÚ','😀AB']) {
    const masked=maskHalf(name);
    assert.notEqual(masked,name);
    assert.equal(masked.match(/\*/g)!.length,Math.ceil(Array.from(name).length/2));
  }
  assert.equal(maskLookupEmail(null),null);
  assert.equal(maskLookupEmail(''),null);
  assert.equal(maskLookupEmail('a@b.c'),'*@b**');
  assert.equal(maskLookupEmail('bad-email'),'***');
  assert.equal(maskLookupEmail('demo@example.invalid'),'de**@example********');
});
test('consulta: teléfono exacto internacional y formas dominicanas, sin inferir otro país',()=>{
  for(const phone of ['8095550100','18095550100','+1 (809) 555-0100'])assert.equal(normalizeLookupPhone(phone),'+18095550100');
  assert.equal(normalizeLookupPhone('+44 20 7946 0000'),'+442079460000');
  for(const value of ['5550100','1234567890','+0123456789','8095550100 OR 1=1','+18095550100x'])assert.equal(normalizeLookupPhone(value),undefined);
});
