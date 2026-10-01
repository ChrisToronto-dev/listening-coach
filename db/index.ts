import { drizzle } from 'drizzle-orm/libsql';
import { getDb as getLibsqlClient } from '@/lib/db';
import * as schema from './schema';

export function getDb() {
  return drizzle(getLibsqlClient(), { schema });
}
