const event = (id, timestamp, body) => ({ nef_version: '1.0', id, timestamp, ...body });

export const normalOperationsEvents = () => [
  event('normal-auth-01', '2026-07-10T08:00:00Z', { host: { id: 'host-dev-1', name: 'dev-01' }, user: { name: 'alice' }, source: { ip: '10.0.0.12' }, service: { name: 'ssh' }, event: { category: 'authentication', action: 'login', result: 'success' } }),
  event('normal-proc-01', '2026-07-10T08:00:03Z', { host: { id: 'host-dev-1', name: 'dev-01' }, user: { name: 'alice' }, event: { category: 'process', action: 'start' }, process: { name: 'bash', pid: 2001, parent_pid: 1999, privilege: 'standard', command_line: 'bash' } }),
  event('normal-file-01', '2026-07-10T08:01:00Z', { host: { id: 'host-dev-1', name: 'dev-01' }, user: { name: 'alice' }, event: { category: 'file', action: 'access' }, file: { path: '/etc/passwd' } }),
  event('normal-auth-02', '2026-07-11T13:10:00Z', { host: { id: 'host-app-1', name: 'app-01' }, user: { name: 'bob' }, source: { ip: '10.0.2.20' }, service: { name: 'ssh' }, event: { category: 'authentication', action: 'login', result: 'success' } }),
  event('normal-proc-02', '2026-07-11T13:10:04Z', { host: { id: 'host-app-1', name: 'app-01' }, user: { name: 'bob' }, event: { category: 'process', action: 'start' }, process: { name: 'vim', pid: 3110, parent_pid: 3102, privilege: 'standard', command_line: 'vim deployment-notes.txt' } })
];
