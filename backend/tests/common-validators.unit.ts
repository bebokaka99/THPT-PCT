import assert from 'node:assert/strict';
import {
  asRecord,
  flexibleBoolean,
  optionalNullableString,
  optionalString,
  parsePositiveInteger,
  positiveIntegerValue,
  requiredString,
} from '../src/validators/common.js';

assert.deepEqual(asRecord({ value: 1 }), { value: 1 });
assert.throws(() => asRecord(null), /Request body is required/);
assert.throws(() => asRecord([]), /Request body is required/);

assert.equal(optionalString('  value  ', 'field'), 'value');
assert.equal(optionalString('  ', 'field'), undefined);
assert.equal(optionalNullableString('  ', 'field'), null);
assert.equal(requiredString(' value ', 'field'), 'value');
assert.throws(() => requiredString('', 'field'), /field is required/);

assert.equal(parsePositiveInteger(undefined, 10, 'limit'), 10);
assert.equal(parsePositiveInteger(['5'], 10, 'limit'), 5);
assert.throws(() => parsePositiveInteger('0', 10, 'limit'), /positive integer/);
assert.equal(positiveIntegerValue('7', 'id'), 7);

assert.equal(flexibleBoolean('true', 'active'), true);
assert.equal(flexibleBoolean('0', 'active'), false);
assert.throws(() => flexibleBoolean('maybe', 'active'), /active must be boolean/);

console.log('Common validators unit test passed.');
