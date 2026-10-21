import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import {
  BufferJSON,
  initAuthCreds,
  proto,
  type AuthenticationCreds,
  type AuthenticationState,
  type SignalDataTypeMap,
} from "baileys";

/*
 * Estado de autenticación de Baileys guardado en Neon (tabla petcare_whatsapp_auth).
 * Equivale a useMultiFileAuthState, pero sin depender del disco: Render borra el disco en cada reinicio.
 */

const CREDS_KEY = "creds";

async function ensureTable(sql: NeonQueryFunction<false, false>) {
  await sql`
    CREATE TABLE IF NOT EXISTS petcare_whatsapp_auth (
      id TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

export async function useNeonAuthState(databaseUrl: string): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
  const sql = neon(databaseUrl);
  await ensureTable(sql);

  const read = async (id: string) => {
    const rows = await sql`SELECT value FROM petcare_whatsapp_auth WHERE id = ${id}` as Array<{ value: string }>;
    return rows[0] ? JSON.parse(rows[0].value, BufferJSON.reviver) : null;
  };
  const write = async (entries: Array<[string, unknown]>) => {
    if (!entries.length) return;
    await sql.query(
      `INSERT INTO petcare_whatsapp_auth (id, value, updated_at)
       SELECT * , now() FROM unnest($1::text[], $2::text[])
       ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [entries.map(([id]) => id), entries.map(([, value]) => JSON.stringify(value, BufferJSON.replacer))],
    );
  };
  const remove = async (ids: string[]) => {
    if (ids.length) await sql.query("DELETE FROM petcare_whatsapp_auth WHERE id = ANY($1::text[])", [ids]);
  };

  const creds: AuthenticationCreds = (await read(CREDS_KEY)) ?? initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
          const result: { [id: string]: SignalDataTypeMap[T] } = {};
          if (!ids.length) return result;
          const rows = await sql.query(
            "SELECT id, value FROM petcare_whatsapp_auth WHERE id = ANY($1::text[])",
            [ids.map((id) => `${type}:${id}`)],
          ) as Array<{ id: string; value: string }>;
          const byId = new Map(rows.map((row) => [row.id, row.value]));
          for (const id of ids) {
            const raw = byId.get(`${type}:${id}`);
            if (!raw) continue;
            let value = JSON.parse(raw, BufferJSON.reviver);
            if (type === "app-state-sync-key" && value) value = proto.Message.AppStateSyncKeyData.fromObject(value);
            result[id] = value;
          }
          return result;
        },
        set: async (data) => {
          const upserts: Array<[string, unknown]> = [];
          const deletions: string[] = [];
          for (const category in data) {
            const entries = data[category as keyof SignalDataTypeMap] ?? {};
            for (const id in entries) {
              const value = entries[id];
              if (value) upserts.push([`${category}:${id}`, value]);
              else deletions.push(`${category}:${id}`);
            }
          }
          await Promise.all([write(upserts), remove(deletions)]);
        },
      },
    },
    saveCreds: () => write([[CREDS_KEY, creds]]),
  };
}

export async function clearAuthState(databaseUrl: string) {
  const sql = neon(databaseUrl);
  await ensureTable(sql);
  await sql`DELETE FROM petcare_whatsapp_auth`;
}
