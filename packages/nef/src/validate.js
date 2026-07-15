import { isIP } from 'node:net';

const secretPatterns = [
  /\b(?:password|passwd|pwd|token|api_key|secret|credential)\s*[=:]\s*([^\s]+)/gi,
  /\b(?:authorization\s*:\s*bearer)\s+([^\s]+)/gi,
  /(?:--password|-p)\s+([^\s]+)/gi,
  /https?:\/\/[^\s/:]+:([^@\s]+)@/gi,
  /-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----[\s\S]*?-----END(?: [A-Z]+)? PRIVATE KEY-----/g
];

const copy = value => structuredClone(value);
const hasText = value => typeof value === 'string' && value.trim().length > 0;
const isIsoUtc = value => hasText(value) && /Z$/.test(value) && !Number.isNaN(Date.parse(value));
const isIp = value => hasText(value) && isIP(value) !== 0;

export function redactText(value) {
  if (!hasText(value)) return value;
  return secretPatterns.reduce((text, pattern) => text.replace(pattern, match => {
    if (match.startsWith('-----BEGIN')) return '[REDACTED PRIVATE KEY]';
    const separator = match.includes('=') ? '=' : match.includes(':') ? ': ' : ' ';
    if (match.startsWith('http')) return match.replace(/:([^@\s]+)@/, ':[REDACTED]@');
    return `${match.split(separator)[0]}${separator}[REDACTED]`;
  }), value);
}

export function sanitizeEvent(event) {
  const result = copy(event);
  if (!result.process) return { event: result, redacted: false };
  let redacted = false;
  for (const field of ['command_line', 'parent_command_line']) {
    if (!hasText(result.process[field])) continue;
    const safe = redactText(result.process[field]);
    redacted ||= safe !== result.process[field];
    result.process[field] = safe;
  }
  if (Array.isArray(result.process.args)) {
    result.process.args = result.process.args.map(arg => {
      const safe = redactText(arg);
      redacted ||= safe !== arg;
      return safe;
    });
  }
  return { event: result, redacted };
}

export function validateEvent(event) {
  const errors = [];
  const category = event?.event?.category;
  const action = event?.event?.action;
  for (const [path, value] of [['nef_version', event?.nef_version], ['id', event?.id], ['host.id', event?.host?.id]]) if (!hasText(value)) errors.push(`${path} is required`);
  if (event?.nef_version !== '1.0') errors.push('nef_version must be 1.0');
  if (!isIsoUtc(event?.timestamp)) errors.push('timestamp must be a UTC ISO-8601 value');
  if (!['authentication', 'process', 'file'].includes(category)) errors.push('event.category is invalid');

  if (category === 'authentication') {
    if (!['login', 'invalid_user'].includes(action)) errors.push('authentication action is invalid');
    if (!['success', 'failure'].includes(event?.event?.result)) errors.push('authentication result is invalid');
    if (event?.service?.name !== 'ssh') errors.push('authentication service.name must be ssh');
    if (!isIp(event?.source?.ip)) errors.push('authentication source.ip must be a valid IP address');
    if (action === 'login' && event?.event?.result === 'success' && !hasText(event?.user?.name)) errors.push('successful login requires user.name');
  }
  if (category === 'process') {
    if (action !== 'start') errors.push('process action must be start');
    if (!hasText(event?.process?.name)) errors.push('process.name is required');
    if (!Number.isInteger(event?.process?.pid) || event.process.pid < 0) errors.push('process.pid must be a non-negative integer');
    if (!['standard', 'elevated', 'unknown'].includes(event?.process?.privilege)) errors.push('process.privilege is invalid');
    if (!hasText(event?.user?.name)) errors.push('process user.name is required');
  }
  if (category === 'file') {
    if (!['access', 'modify'].includes(action)) errors.push('file action is invalid');
    if (!hasText(event?.file?.path) || !event.file.path.startsWith('/')) errors.push('file.path must be an absolute path');
  }
  return { valid: errors.length === 0, errors };
}
