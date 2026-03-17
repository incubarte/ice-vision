import fs from 'fs';
import path from 'path';

const symlinkPath = path.join(process.cwd(), 'storageTest', 'ephemeral');

export default function globalTeardown() {
  if (fs.lstatSync(symlinkPath, { throwIfNoEntry: false })?.isSymbolicLink()) {
    const target = fs.readlinkSync(symlinkPath);
    if (fs.existsSync(target)) {
      fs.rmSync(target, { recursive: true, force: true });
    }
    fs.unlinkSync(symlinkPath);
  }
}
