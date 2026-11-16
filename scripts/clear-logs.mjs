// Empties the local test-session log. Truncates instead of deleting, because the running
// API keeps the file open and would otherwise keep writing to a deleted file.
import { existsSync, truncateSync } from 'node:fs';

const file = 'logs/dev.log';
if (existsSync(file)) {
  truncateSync(file, 0);
  console.log(`Cleared ${file}`);
} else {
  console.log(`Nothing to clear (${file} does not exist yet)`);
}
