"use client";

import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from "@capacitor-community/sqlite";
import { Capacitor } from "@capacitor/core";
import { getActiveWorkspace } from "./workspaces";

const GLOBAL_DB_NAME = "prontuario_auth";

let sqlite: SQLiteConnection | null = null;

// Conexão e cache do banco clínico por Workspace
let activeDbName: string | null = null;
let dbInstance: SQLiteDBConnection | null = null;
let initPromise: Promise<SQLiteDBConnection> | null = null;

// Conexão e cache do banco global de autenticação (compartilhado entre workspaces)
let globalDbInstance: SQLiteDBConnection | null = null;
let globalInitPromise: Promise<SQLiteDBConnection> | null = null;

const AUTH_SCHEMA = `
CREATE TABLE IF NOT EXISTS User (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Session (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  userId TEXT NOT NULL REFERENCES User(id) ON DELETE CASCADE,
  createdAt TEXT NOT NULL
);
`;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS Patient (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  birthDate TEXT NOT NULL,
  gender TEXT NOT NULL,
  bed TEXT NOT NULL DEFAULT '',
  diagnosis TEXT NOT NULL DEFAULT '',
  allergies TEXT NOT NULL DEFAULT '',
  emergencyContact TEXT NOT NULL DEFAULT '',
  emergencyPhone TEXT NOT NULL DEFAULT '',
  photo TEXT NOT NULL DEFAULT '',
  admissionDate TEXT NOT NULL,
  dischargeDate TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 0,
  condition TEXT NOT NULL DEFAULT '',
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS VitalSign (
  id TEXT PRIMARY KEY,
  patientId TEXT NOT NULL REFERENCES Patient(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  value REAL NOT NULL,
  systolic INTEGER,
  diastolic INTEGER,
  unit TEXT NOT NULL,
  recordedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Medication (
  id TEXT PRIMARY KEY,
  patientId TEXT NOT NULL REFERENCES Patient(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dose TEXT NOT NULL,
  schedule TEXT NOT NULL,
  frequencyHours INTEGER,
  administered INTEGER NOT NULL DEFAULT 0,
  administeredAt TEXT,
  observation TEXT NOT NULL DEFAULT '',
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS MedicationAdministration (
  id TEXT PRIMARY KEY,
  medicationId TEXT NOT NULL,
  patientId TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',
  scheduleTime TEXT NOT NULL DEFAULT '',
  scheduledTime TEXT NOT NULL DEFAULT '',
  administered INTEGER NOT NULL DEFAULT 1,
  administeredAt TEXT NOT NULL,
  observation TEXT NOT NULL DEFAULT '',
  earlyAdministration INTEGER NOT NULL DEFAULT 0,
  duplicateOverride INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS NursingNote (
  id TEXT PRIMARY KEY,
  patientId TEXT NOT NULL REFERENCES Patient(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS TeamMember (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Enfermeiro',
  color TEXT NOT NULL DEFAULT '#3b82f6',
  shift TEXT NOT NULL DEFAULT 'MANHA',
  team TEXT NOT NULL DEFAULT '',
  isCover INTEGER NOT NULL DEFAULT 0,
  gender TEXT NOT NULL DEFAULT '',
  horarioFixo TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Scale6x1 (
  id TEXT PRIMARY KEY,
  month TEXT NOT NULL UNIQUE,
  data TEXT NOT NULL,
  savedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  hospitalName TEXT NOT NULL DEFAULT '',
  defaultWhatsapp TEXT NOT NULL DEFAULT '',
  pin TEXT NOT NULL DEFAULT '',
  groqApiKey TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS Task (
  id TEXT PRIMARY KEY,
  patientId TEXT REFERENCES Patient(id) ON DELETE CASCADE,
  patientName TEXT NOT NULL,
  description TEXT NOT NULL,
  scheduledAt TEXT NOT NULL,
  notificationId INTEGER NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL
);
`;

/**
 * Garante que o jeep-sqlite (elemento web) esteja registrado quando rodando
 * no navegador (dev/testes). Em Android/iOS nativos isso é ignorado.
 */
async function ensureWebStore(): Promise<void> {
  if (Capacitor.getPlatform() !== "web") return;
  await import("jeep-sqlite/dist/components/jeep-sqlite");
  const jeepEl = document.querySelector("jeep-sqlite");
  if (!jeepEl) {
    const el = document.createElement("jeep-sqlite");
    document.body.appendChild(el);
    await customElements.whenDefined("jeep-sqlite");
  }
  await CapacitorSQLite.initWebStore();
}

/**
 * Obtém ou instancia a interface SQLiteConnection do Capacitor.
 */
async function getSqliteConnection(): Promise<SQLiteConnection> {
  await ensureWebStore();
  if (!sqlite) {
    sqlite = new SQLiteConnection(CapacitorSQLite);
  }
  return sqlite;
}

/**
 * Abre ou recupera uma conexão SQLite de maneira tolerante a falhas.
 * Resolve problemas comuns em Android onde a WebView é recarregada
 * (window.location.reload ou href), deixando conexões nativas abertas no processo Java.
 */
async function openOrRetrieveConnection(dbName: string): Promise<SQLiteDBConnection> {
  const sq = await getSqliteConnection();

  // Sincroniza estado se a plataforma nativa tiver conexões órfãs
  try {
    await sq.checkConnectionsConsistency();
  } catch {
    // Ignora em plataformas ou drivers onde o método não se aplica
  }

  let db: SQLiteDBConnection;
  let isConn = false;
  try {
    const check = await sq.isConnection(dbName, false);
    isConn = !!check?.result;
  } catch {
    isConn = false;
  }

  if (isConn) {
    try {
      db = await sq.retrieveConnection(dbName, false);
    } catch {
      // Falha ao recuperar conexão em cache JS: tenta fechar e recriar
      try {
        await sq.closeConnection(dbName, false);
      } catch {}
      db = await sq.createConnection(dbName, false, "no-encryption", 1, false);
    }
  } else {
    try {
      db = await sq.createConnection(dbName, false, "no-encryption", 1, false);
    } catch (createErr: any) {
      const msg = String(createErr?.message || createErr || "");
      if (msg.toLowerCase().includes("already exists")) {
        // Conexão nativa permaneceu aberta no Java após reload da WebView: fecha e recria
        try {
          await CapacitorSQLite.closeConnection({ database: dbName, readonly: false });
        } catch {}
        try {
          await sq.closeConnection(dbName, false);
        } catch {}
        db = await sq.createConnection(dbName, false, "no-encryption", 1, false);
      } else {
        throw createErr;
      }
    }
  }

  // Verifica se o banco já está aberto antes de chamar open()
  try {
    const openRes = await db.isDBOpen();
    if (!openRes || !openRes.result) {
      await db.open();
    }
  } catch {
    try {
      await db.open();
    } catch (openErr: any) {
      const openMsg = String(openErr?.message || openErr || "");
      if (!openMsg.toLowerCase().includes("already open")) {
        throw openErr;
      }
    }
  }

  return db;
}

export async function getGlobalDb(): Promise<SQLiteDBConnection> {
  if (globalDbInstance) {
    try {
      const openRes = await globalDbInstance.isDBOpen();
      if (openRes && openRes.result) {
        return globalDbInstance;
      }
    } catch {
      globalDbInstance = null;
    }
  }
  if (globalInitPromise) return globalInitPromise;

  globalInitPromise = (async () => {
    try {
      const db = await openOrRetrieveConnection(GLOBAL_DB_NAME);
      await db.execute(AUTH_SCHEMA);

      // Migração tolerante: copiar usuários e sessões de 'prontuario' antigo se 'prontuario_auth' estiver vazio
      try {
        const userCountRes = await db.query("SELECT COUNT(*) as count FROM User", []);
        const count = (userCountRes.values?.[0]?.count as number) || 0;
        if (count === 0) {
          const oldDb = await openOrRetrieveConnection("prontuario");
          const tableCheck = await oldDb.query(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='User'",
            []
          );
          if (tableCheck.values && tableCheck.values.length > 0) {
            const oldUsers = await oldDb.query("SELECT * FROM User", []);
            if (oldUsers.values && oldUsers.values.length > 0) {
              for (const u of oldUsers.values) {
                await db.run(
                  "INSERT OR IGNORE INTO User (id, name, email, password, createdAt) VALUES (?, ?, ?, ?, ?)",
                  [u.id, u.name, u.email, u.password, u.createdAt]
                );
              }
            }

            const sessionCheck = await oldDb.query(
              "SELECT name FROM sqlite_master WHERE type='table' AND name='Session'",
              []
            );
            if (sessionCheck.values && sessionCheck.values.length > 0) {
              const oldSessions = await oldDb.query("SELECT * FROM Session", []);
              if (oldSessions.values && oldSessions.values.length > 0) {
                for (const s of oldSessions.values) {
                  await db.run(
                    "INSERT OR IGNORE INTO Session (id, token, userId, createdAt) VALUES (?, ?, ?, ?)",
                    [s.id, s.token, s.userId, s.createdAt]
                  );
                }
              }
            }
          }
        }
      } catch (migErr) {
        console.warn("Verificação de migração de login legado para prontuario_auth:", migErr);
      }

      globalDbInstance = db;
      return db;
    } catch (err) {
      globalInitPromise = null;
      throw err;
    }
  })();

  return globalInitPromise;
}

export async function getDb(): Promise<SQLiteDBConnection> {
  const currentWorkspace = await getActiveWorkspace();
  const targetDbName = currentWorkspace.dbName;

  // Se o banco em cache for de outro workspace, fecha a conexão e limpa cache
  if (dbInstance && activeDbName !== targetDbName) {
    try {
      const sq = await getSqliteConnection();
      await sq.closeConnection(activeDbName!, false);
    } catch (e) {
      console.warn("Erro ao fechar conexão do workspace anterior:", e);
    }
    dbInstance = null;
    initPromise = null;
    activeDbName = null;
  }

  if (dbInstance && activeDbName === targetDbName) {
    try {
      const isOpenRes = await dbInstance.isDBOpen();
      if (isOpenRes && isOpenRes.result) {
        return dbInstance;
      }
    } catch {
      dbInstance = null;
    }
  }

  if (initPromise && activeDbName === targetDbName) {
    return initPromise;
  }

  activeDbName = targetDbName;

  initPromise = (async () => {
    try {
      const db = await openOrRetrieveConnection(targetDbName);
      await db.execute(SCHEMA);

      // Migrações tolerantes a banco existente
      try { await db.run("ALTER TABLE MedicationAdministration ADD COLUMN patientId TEXT DEFAULT ''"); } catch {}
      try { await db.run("ALTER TABLE MedicationAdministration ADD COLUMN scheduledTime TEXT DEFAULT ''"); } catch {}
      try { await db.run("ALTER TABLE MedicationAdministration ADD COLUMN observation TEXT DEFAULT ''"); } catch {}
      try { await db.run("ALTER TABLE MedicationAdministration ADD COLUMN earlyAdministration INTEGER DEFAULT 0"); } catch {}
      try { await db.run("ALTER TABLE MedicationAdministration ADD COLUMN duplicateOverride INTEGER DEFAULT 0"); } catch {}

      // Seed inicial de settings (linha "global"), se ainda não existir
      await db.run(
        `INSERT OR IGNORE INTO Settings (id, hospitalName, defaultWhatsapp, pin) VALUES ('global', '', '', '')`,
        []
      );

      dbInstance = db;
      return db;
    } catch (err) {
      initPromise = null;
      dbInstance = null;
      activeDbName = null;
      throw err;
    }
  })();

  return initPromise;
}

/**
 * Fecha de forma limpa todas as conexões SQLite ativas (clínicas e de autenticação)
 * antes de trocar de área de trabalho ou recarregar a interface.
 */
export async function closeAllWorkspaceConnections(): Promise<void> {
  const sq = sqlite || (await getSqliteConnection().catch(() => null));

  if (dbInstance && activeDbName && sq) {
    try {
      await sq.closeConnection(activeDbName, false);
    } catch {}
  }
  dbInstance = null;
  initPromise = null;
  activeDbName = null;

  if (globalDbInstance && sq) {
    try {
      await sq.closeConnection(GLOBAL_DB_NAME, false);
    } catch {}
  }
  globalDbInstance = null;
  globalInitPromise = null;

  if (sq) {
    try {
      await sq.closeAllConnections();
    } catch {}
  }
}

export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
