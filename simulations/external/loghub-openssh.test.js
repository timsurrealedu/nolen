import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOpenSshLine } from './loghub-openssh.js';
import { validateEvent } from '../../packages/nef/src/validate.js';

test('maps terminal OpenSSH outcomes to valid NEF without double-counting precursor logs', () => {
  const invalid = parseOpenSshLine('Dec 10 06:55:48 LabSZ sshd[24200]: Failed password for invalid user webmaster from 173.234.31.186 port 38926 ssh2', { year: 2017, lineNumber: 6 });
  const success = parseOpenSshLine('Dec 10 06:55:48 LabSZ sshd[24200]: Accepted password for alice from 203.0.113.7 port 22 ssh2', { year: 2017, lineNumber: 7 });
  assert.deepEqual(validateEvent(invalid).errors, []);
  assert.equal(invalid.event.action, 'invalid_user');
  assert.equal(success.event.result, 'success');
  assert.equal(parseOpenSshLine('Dec 10 06:55:46 LabSZ sshd[24200]: Invalid user webmaster from 173.234.31.186', { year: 2017, lineNumber: 2 }), null);
});
