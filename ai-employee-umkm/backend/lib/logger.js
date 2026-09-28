// Logger leveled sederhana, tanpa dependensi tambahan.
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const threshold = LEVELS[(require('../config').logLevel || 'info').toLowerCase()] ?? LEVELS.info;

const stamp = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

function emit(level, scope, args) {
  if (LEVELS[level] > threshold) return;
  const tag = `${stamp()} ${level.toUpperCase().padEnd(5)} [${scope}]`;
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  fn(tag, ...args);
}

function create(scope) {
  return {
    error: (...a) => emit('error', scope, a),
    warn: (...a) => emit('warn', scope, a),
    info: (...a) => emit('info', scope, a),
    debug: (...a) => emit('debug', scope, a),
    child: (sub) => create(`${scope}:${sub}`),
  };
}

module.exports = { create };
