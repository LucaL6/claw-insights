import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const typeDefs = readFileSync(resolve(__dirname, 'schema.graphql'), 'utf-8');
