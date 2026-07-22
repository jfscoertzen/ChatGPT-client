/*
 * ChatGPT Desktop Wrapper
 * Developer: Stephan Coertzen <coertzen.jfs@gmail.com>
 * License: MIT
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const RELEASE_EXTENSIONS = new Set(['.AppImage', '.deb', '.flatpak', '.rpm']);

function getCurrentVersion(baseDir = process.cwd()) {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(baseDir, 'package.json'), 'utf8')
  );
  return packageJson.version;
}

function isReleaseArtifact(fileName, version) {
  const extension = RELEASE_EXTENSIONS.has(path.extname(fileName))
    ? path.extname(fileName)
    : fileName.endsWith('.AppImage')
      ? '.AppImage'
      : '';

  return Boolean(extension && fileName.includes(version));
}

function sha256File(filePath, fsImpl = fs) {
  const hash = crypto.createHash('sha256');
  hash.update(fsImpl.readFileSync(filePath));
  return hash.digest('hex');
}

function generateChecksums(options = {}) {
  const baseDir = options.baseDir || process.cwd();
  const distDir = options.distDir || path.join(baseDir, 'dist');
  const fsImpl = options.fs || fs;
  const version = options.version || getCurrentVersion(baseDir);
  const files = fsImpl
    .readdirSync(distDir)
    .filter((fileName) => isReleaseArtifact(fileName, version))
    .sort();

  if (files.length === 0) {
    throw new Error(`No release artifacts found for version ${version}.`);
  }

  const checksumFiles = [];

  for (const fileName of files) {
    const artifactPath = path.join(distDir, fileName);
    const checksum = sha256File(artifactPath, fsImpl);
    const checksumPath = `${artifactPath}.sha256`;
    fsImpl.writeFileSync(checksumPath, `${checksum}  ${fileName}\n`, 'utf8');
    checksumFiles.push(checksumPath);
  }

  return checksumFiles;
}

if (require.main === module) {
  for (const checksumPath of generateChecksums()) {
    console.log(checksumPath);
  }
}

module.exports = {
  RELEASE_EXTENSIONS,
  generateChecksums,
  isReleaseArtifact,
  sha256File
};
