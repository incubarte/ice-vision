import fs from 'fs';
import path from 'path';
import os from 'os';

const protoDataDir = path.join(process.cwd(), 'storageTest', 'protoData');
const symlinkPath = path.join(process.cwd(), 'storageTest', 'ephemeral');

export default function globalSetup() {
  // Clean up any stale symlink
  if (fs.existsSync(symlinkPath)) {
    const target = fs.readlinkSync(symlinkPath);
    if (fs.existsSync(target)) {
      fs.rmSync(target, { recursive: true, force: true });
    }
    fs.unlinkSync(symlinkPath);
  }

  // Create an ephemeral temp directory and copy seed data into it
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'icevision-test-'));
  fs.cpSync(protoDataDir, path.join(tmpDir, 'data'), { recursive: true });

  // Symlink so the webServer command can reference a static path
  fs.symlinkSync(tmpDir, symlinkPath);
}
