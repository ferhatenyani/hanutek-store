import "server-only";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";
import path from "node:path";
import { mkdirSync } from "node:fs";
import * as schema from "./schema";
import { env } from "../env";

/**
 * One Drizzle API over two engines:
 *  - production / any real Postgres: node-postgres connection pool
 *  - local dev & tests without Docker: PGlite (Postgres compiled to WASM)
 * Both run the same SQL migrations from /drizzle.
 */
export type Db = NodePgDatabase<typeof schema>;
/** A transaction handle (same query API as Db). */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;

type Holder = { db?: Db; ready?: Promise<void>; close?: () => Promise<void> };
const g = globalThis as unknown as { __hanutekDb?: Holder };
const holder: Holder = (g.__hanutekDb ??= {});

export const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle");

export function createDb(url: string): { db: Db; close: () => Promise<void>; migrate: () => Promise<void> } {
  if (url.startsWith("pglite:")) {
    const target = url.slice("pglite:".length);
    const inMemory = target === "memory" || target === "";
    if (!inMemory) mkdirSync(path.resolve(target), { recursive: true });
    const client = inMemory ? new PGlite() : new PGlite(target);
    const db = drizzlePglite(client, { schema }) as unknown as Db;
    return {
      db,
      close: () => client.close(),
      migrate: () => migratePglite(db as never, { migrationsFolder: MIGRATIONS_DIR }),
    };
  }
  const pool = new Pool({
    connectionString: url,
    max: env().DATABASE_POOL_MAX,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    // Guard against runaway queries holding connections.
    statement_timeout: 15_000,
  });
  const db = drizzlePg(pool, { schema });
  return { db, close: () => pool.end(), migrate: () => migratePg(db, { migrationsFolder: MIGRATIONS_DIR }) };
}

/** Lazily-initialized shared database. PGlite databases auto-migrate on first use (dev convenience). */
export async function getDb(): Promise<Db> {
  if (!holder.db) {
    const url = env().DATABASE_URL;
    const created = createDb(url);
    holder.db = created.db;
    holder.close = created.close;
    holder.ready = url.startsWith("pglite:") ? created.migrate() : Promise.resolve();
  }
  await holder.ready;
  return holder.db;
}

/** Test hook — inject an already-migrated database. */
export function setDb(db: Db | undefined) {
  holder.db = db;
  holder.ready = Promise.resolve();
}

export { schema };
