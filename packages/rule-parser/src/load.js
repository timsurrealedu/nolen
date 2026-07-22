import { readFileSync, readdirSync } from 'node:fs';
import { parse } from 'yaml';

const defaultRulesDirectory = new URL('../../../rules/', import.meta.url);

export function duration(value) {
  const match = /^(\d+)(ms|s|m)$/.exec(String(value));
  if (!match) throw new Error(`invalid rule duration: ${value}`);
  return Number(match[1]) * { ms: 1, s: 1_000, m: 60_000 }[match[2]];
}

export function parseRule(source, filename = '<rule>') {
  const rule = parse(source);
  if (!rule || typeof rule !== 'object') throw new Error(`${filename}: rule must be an object`);
  for (const field of ['id', 'name', 'severity']) {
    if (typeof rule[field] !== 'string' || !rule[field]) throw new Error(`${filename}: ${field} is required`);
  }
  if (![rule.match, rule.matches, rule.sequence, rule.requires].some(Boolean)) throw new Error(`${filename}: match, matches, sequence, or requires is required`);
  if (rule.condition) {
    if (!Number.isInteger(rule.condition.count) || rule.condition.count < 1) throw new Error(`${filename}: condition.count must be a positive integer`);
    if (!Array.isArray(rule.group_by) || !rule.group_by.length) throw new Error(`${filename}: group_by is required for count rules`);
    duration(rule.condition.within);
  }
  if (rule.sequence && (!Array.isArray(rule.sequence) || rule.sequence.length < 2 || !Array.isArray(rule.same))) throw new Error(`${filename}: sequence and same must be arrays`);
  if (rule.requires) {
    if (!Array.isArray(rule.requires) || rule.requires.length < 2 || !Array.isArray(rule.same)) throw new Error(`${filename}: requires and same must be arrays`);
    if (!Number.isInteger(rule.confidence) || rule.confidence < 0 || rule.confidence > 100) throw new Error(`${filename}: confidence must be an integer from 0 to 100`);
  }
  if (rule.within) duration(rule.within);
  return rule;
}

export function loadRules(directory = defaultRulesDirectory) {
  const rules = new Map();
  for (const filename of readdirSync(directory).filter(name => name.endsWith('.yaml')).sort()) {
    const rule = parseRule(readFileSync(new URL(filename, directory), 'utf8'), filename);
    if (rules.has(rule.id)) throw new Error(`${filename}: duplicate rule id ${rule.id}`);
    rules.set(rule.id, rule);
  }
  return rules;
}
