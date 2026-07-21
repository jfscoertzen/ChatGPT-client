/*
 * ChatGPT Desktop Wrapper
 * Developer: Stephan Coertzen <coertzen.jfs@gmail.com>
 * License: MIT
 */
const { execFileSync } = require('node:child_process');
const { readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');

const outputPath = resolve(process.argv[2] || 'release-notes.md');
const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
const fromHash = packageJson.releaseNotes?.fromHash;

if (!fromHash) {
  throw new Error('Missing package.json releaseNotes.fromHash');
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

git(['cat-file', '-e', `${fromHash}^{commit}`]);

const tagName =
  process.env.GITHUB_REF_NAME || git(['describe', '--tags', '--always']);
const targetHash = process.env.GITHUB_SHA || git(['rev-parse', 'HEAD']);
const compareRange = `${fromHash}..${targetHash}`;
const commits = git(['log', '--pretty=format:%h%x09%s%x09%an', compareRange]);

const lines = [`# ${tagName}`, '', `Changes since \`${fromHash}\`:`, ''];

if (commits) {
  for (const commit of commits.split('\n')) {
    const [shortHash, subject, author] = commit.split('\t');
    lines.push(`- \`${shortHash}\` ${subject} (${author})`);
  }
} else {
  lines.push('- No commits found in the configured release range.');
}

lines.push('');
writeFileSync(outputPath, `${lines.join('\n')}\n`);
