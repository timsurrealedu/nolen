const required = (value, path, errors) => {
  const found = path.split('.').reduce((item, key) => item?.[key], value);
  if (found === undefined || found === null || found === '') errors.push(`${path} is required`);
};

/** Validate the MVP subset of NEF without mutating the received evidence. */
export function validateNef(event) {
  const errors = [];
  if (!event || typeof event !== 'object' || Array.isArray(event)) return ['event must be an object'];
  required(event, 'id', errors);
  required(event, 'timestamp', errors);
  required(event, 'host.id', errors);
  required(event, 'event.category', errors);
  required(event, 'event.action', errors);
  if (event.nef_version !== '1.0') errors.push('nef_version must be 1.0');
  if (Number.isNaN(Date.parse(event.timestamp))) errors.push('timestamp must be an ISO-8601 timestamp');
  if (!['authentication', 'process', 'file'].includes(event.event?.category)) errors.push('event.category is unsupported');
  if (event.event?.category === 'authentication') {
    required(event, 'event.result', errors); required(event, 'service.name', errors);
    if (event.service?.name !== 'ssh') errors.push('authentication service.name must be ssh');
  }
  if (event.event?.category === 'process') {
    required(event, 'process.name', errors); required(event, 'process.pid', errors); required(event, 'user.name', errors);
  }
  if (event.event?.category === 'file') required(event, 'file.path', errors);
  return errors;
}
