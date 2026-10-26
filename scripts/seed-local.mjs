import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const sql = await readFile(new URL('./seed-local.sql', import.meta.url), 'utf8');
execFileSync('pnpm', ['--filter','collector','exec','wrangler','d1','execute','DB','--local','--persist-to','../web/.wrangler/state','--command',sql], { stdio:'inherit' });
