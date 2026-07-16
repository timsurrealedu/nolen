import { normalOperationsEvents } from './normal-operations/fixture.js';
import { sshCompromiseEvents } from './ssh-compromise/fixture.js';

const authBase = { nef_version: '1.0', host: { id: 'host-sim-1', name: 'sim-01' }, source: { ip: '203.0.113.20' }, service: { name: 'ssh' } };
const stamp = second => new Date(Date.parse('2026-07-16T09:00:00Z') + second * 1_000).toISOString();
const authEvent = (id, second, action, user) => ({ ...authBase, id, timestamp: stamp(second), ...(user && { user: { name: user } }), event: { category: 'authentication', action, result: 'failure' } });

const unknownUserBruteForceEvents = () => Array.from({ length: 10 }, (_, index) => authEvent(`unknown-fail-${index + 1}`, index * 2, 'login'));
const invalidUserEnumerationEvents = () => Array.from({ length: 5 }, (_, index) => authEvent(`invalid-user-${index + 1}`, 60 + index * 3, 'invalid_user', `ghost${index + 1}`));
const authorizedMaintenanceEvents = () => [
  { ...authBase, id: 'maintenance-login', timestamp: stamp(120), user: { name: 'admin' }, event: { category: 'authentication', action: 'login', result: 'success' } },
  { nef_version: '1.0', id: 'maintenance-shell', timestamp: stamp(125), host: authBase.host, user: { name: 'admin' }, event: { category: 'process', action: 'start' }, process: { name: 'bash', pid: 5100, privilege: 'elevated' } },
  { nef_version: '1.0', id: 'maintenance-sudoers', timestamp: stamp(130), host: authBase.host, user: { name: 'admin' }, event: { category: 'file', action: 'modify' }, file: { path: '/etc/sudoers' } }
];

export const securityScenarios = () => {
  const compromise = sshCompromiseEvents();
  return [
    { id: 'normal_operations', events: normalOperationsEvents(), expectedRuleIds: [], expectedIncidentCount: 0 },
    { id: 'ssh_compromise_failures_only', events: compromise.filter(event => event.event.result === 'failure'), expectedRuleIds: ['NOLEN-SSH-001'], expectedIncidentCount: 0 },
    { id: 'unknown_user_brute_force', events: unknownUserBruteForceEvents(), expectedRuleIds: ['NOLEN-SSH-003'], expectedIncidentCount: 0 },
    { id: 'invalid_user_enumeration', events: invalidUserEnumerationEvents(), expectedRuleIds: ['NOLEN-SSH-002'], expectedIncidentCount: 0 },
    { id: 'authorized_maintenance', events: authorizedMaintenanceEvents(), expectedRuleIds: ['NOLEN-FILE-001', 'NOLEN-PROC-001'], expectedIncidentCount: 0 },
    { id: 'ssh_compromise', events: compromise, expectedRuleIds: ['NOLEN-PROC-001', 'NOLEN-SEQ-001', 'NOLEN-SSH-001'], expectedIncidentCount: 1 }
  ];
};
