const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  generateChecksums,
  isReleaseArtifact,
  sha256File
} = require('../../scripts/generate-checksums');

function createTempProject() {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatgpt-checksums-'));
  const distDir = path.join(baseDir, 'dist');
  fs.mkdirSync(distDir);
  fs.writeFileSync(
    path.join(baseDir, 'package.json'),
    JSON.stringify({ version: '1.0.5' }),
    'utf8'
  );
  return { baseDir, distDir };
}

describe('release checksum generation', () => {
  test('identifies only current-version release artifacts', () => {
    expect(isReleaseArtifact('ChatGPT-1.0.5-x64.AppImage', '1.0.5')).toBe(true);
    expect(isReleaseArtifact('ChatGPT-1.0.5-x64.deb', '1.0.5')).toBe(true);
    expect(isReleaseArtifact('ChatGPT-1.0.5-x64.rpm', '1.0.5')).toBe(true);
    expect(isReleaseArtifact('ChatGPT-1.0.5-x64.flatpak', '1.0.5')).toBe(true);
    expect(isReleaseArtifact('ChatGPT-1.0.4-x64.AppImage', '1.0.5')).toBe(
      false
    );
    expect(isReleaseArtifact('latest-linux.yml', '1.0.5')).toBe(false);
  });

  test('generates one sha256 file per current-version artifact', () => {
    const { baseDir, distDir } = createTempProject();
    const artifactPath = path.join(distDir, 'ChatGPT-1.0.5-x64.AppImage');
    const oldArtifactPath = path.join(distDir, 'ChatGPT-1.0.4-x64.AppImage');
    fs.writeFileSync(artifactPath, 'current artifact', 'utf8');
    fs.writeFileSync(oldArtifactPath, 'old artifact', 'utf8');

    const checksumFiles = generateChecksums({ baseDir });

    expect(checksumFiles).toEqual([`${artifactPath}.sha256`]);
    expect(fs.readFileSync(`${artifactPath}.sha256`, 'utf8')).toBe(
      `${sha256File(artifactPath)}  ChatGPT-1.0.5-x64.AppImage\n`
    );
    expect(fs.existsSync(`${oldArtifactPath}.sha256`)).toBe(false);
  });

  test('fails when no current-version release artifacts exist', () => {
    const { baseDir, distDir } = createTempProject();
    fs.writeFileSync(
      path.join(distDir, 'latest-linux.yml'),
      'metadata',
      'utf8'
    );

    expect(() => generateChecksums({ baseDir })).toThrow(
      /No release artifacts/
    );
  });
});
