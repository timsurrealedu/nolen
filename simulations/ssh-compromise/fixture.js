const base = { nef_version: '1.0', host: { id: 'host-1', name: 'ubuntu-lab' }, user: { name: 'deploy' }, source: { ip: '198.51.100.44' }, service: { name: 'ssh' } };
const stamp = second => `2026-07-15T14:32:${String(second).padStart(2, '0')}Z`;
export const sshCompromiseEvents = () => [
  ...Array.from({ length: 10 }, (_, i) => ({ id: `fail-${String(i + 1).padStart(2, '0')}`, timestamp: stamp(i * 2), ...base, event: { category: 'authentication', action: 'login', result: 'failure' } })),
  { id: 'success-01', timestamp: stamp(25), ...base, event: { category: 'authentication', action: 'login', result: 'success' } },
  { id: 'shell-01', nef_version: '1.0', timestamp: stamp(31), host: base.host, user: base.user, event: { category: 'process', action: 'start' }, process: { name: 'bash', pid: 4321, parent_pid: 4000, privilege: 'elevated' } }
];
