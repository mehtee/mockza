'use strict';

const fs = require('node:fs');
const { builtinModules } = require('node:module');
const path = require('node:path');

const WEB_SRC_DIR = path.resolve(__dirname, 'src');
const EXTENSIONS = ['.ts', '.tsx', '.mts', '.mjs', '.js', '.jsx', '.astro'];
const BUILTIN_SET = new Set(builtinModules);

function resolveFileWithExtensions(basePath) {
  if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) {
    return basePath;
  }
  for (const ext of EXTENSIONS) {
    const candidate = `${basePath}${ext}`;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  if (fs.existsSync(basePath) && fs.statSync(basePath).isDirectory()) {
    for (const ext of EXTENSIONS) {
      const indexCandidate = path.join(basePath, `index${ext}`);
      if (fs.existsSync(indexCandidate) && fs.statSync(indexCandidate).isFile()) {
        return indexCandidate;
      }
    }
  }
  return null;
}

exports.interfaceVersion = 2;

exports.resolve = function resolve(source, file) {
  if (source.startsWith('node:') || BUILTIN_SET.has(source)) {
    return { found: true, path: null };
  }

  let candidateBase = null;
  if (source.startsWith('@/')) {
    candidateBase = path.resolve(WEB_SRC_DIR, source.slice(2));
  } else if (source.startsWith('./') || source.startsWith('../')) {
    candidateBase = path.resolve(path.dirname(file), source);
  } else {
    // External / workspace package — let boundaries classify as external module.
    return { found: false };
  }

  const resolved = resolveFileWithExtensions(candidateBase);
  if (resolved) {
    return { found: true, path: resolved };
  }
  return { found: false };
};
