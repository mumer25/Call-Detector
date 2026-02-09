import SQLite from "react-native-sqlite-storage";
import { CallLog } from "../utils/CallRecorder";


SQLite.DEBUG(true);
SQLite.enablePromise(true);

let db: SQLite.SQLiteDatabase | null = null;

/* ================= OPEN DATABASE ================= */
export const openDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  if (db) return db;
  try {
    db = await SQLite.openDatabase({ name: "crm.db", location: "default" });
    console.log("Database opened!");
    return db;
  } catch (err) {
    console.error("Failed to open DB:", err);
    throw err;
  }
};

/* ================= INIT TABLES ================= */
export const initDB = async () => {
  const database = await openDatabase();

  // Leads table
  await database.executeSql(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE,
      status TEXT,
      assignee TEXT,
      source TEXT
    );
  `);

  // Call history table
// await database.executeSql("DROP TABLE IF EXISTS history;");
await database.executeSql(`
  CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER,
    phone TEXT NOT NULL,
    date TEXT NOT NULL,
    duration INTEGER,
    type TEXT,
    note TEXT,
    FOREIGN KEY(lead_id) REFERENCES leads(id)
  );
`);


  console.log("Tables created!");
};

/* ================= LEADS ================= */
export const insertLead = async (
  name: string,
  phone: string,
  status: string = "NEW",
  assignee: string = "",
  source: string = "web"
): Promise<number> => {
  const database = await openDatabase();
  const result = await database.executeSql(
    "INSERT OR IGNORE INTO leads (name, phone, status, assignee, source) VALUES (?, ?, ?, ?, ?);",
    [name, phone, status, assignee, source]
  );
  return result[0].insertId;
};

export const getLeads = async (): Promise<any[]> => {
  const database = await openDatabase();
  const results = await database.executeSql("SELECT * FROM leads ORDER BY id DESC;");
  const rows = results[0].rows;
  const leads: any[] = [];
  for (let i = 0; i < rows.length; i++) {
    leads.push(rows.item(i));
  }
  return leads;
};

export const searchLeads = async (query: string): Promise<any[]> => {
  const database = await openDatabase();
  const results = await database.executeSql(
    "SELECT * FROM leads WHERE name LIKE ? OR phone LIKE ? ORDER BY id DESC;",
    [`%${query}%`, `%${query}%`]
  );
  const rows = results[0].rows;
  const leads: any[] = [];
  for (let i = 0; i < rows.length; i++) {
    leads.push(rows.item(i));
  }
  return leads;
};

export const updateLeadStatusDB = async (phone: string, status: string) => {
  const database = await openDatabase();
  await database.executeSql("UPDATE leads SET status = ? WHERE phone = ?;", [status, phone]);
};

/* ================= CALL HISTORY ================= */
export const insertHistory = async (
  lead_id: number | null,
  phone: string,
  date?: string | number,
  duration: number = 0,
  type: string = "dialed",
  note: string = ""
) => {
  const database = await openDatabase();

  let callDate: Date;
  if (!date) {
    callDate = new Date();
  } else {
    const parsedDate = new Date(date);
    // Check if valid
    if (isNaN(parsedDate.getTime())) {
      callDate = new Date(); // fallback
    } else {
      callDate = parsedDate;
    }
  }

  const isoDate = callDate.toISOString();

  await database.executeSql(
    "INSERT INTO history (lead_id, phone, date, duration, type, note) VALUES (?, ?, ?, ?, ?, ?);",
    [lead_id, phone, isoDate, duration, type, note]
  );
};

export const getHistory = async (): Promise<CallLog[]> => {
  const database = await openDatabase();
  const results = await database.executeSql("SELECT * FROM history ORDER BY date DESC;");
  const rows = results[0].rows;
  const history: CallLog[] = [];

  for (let i = 0; i < rows.length; i++) {
    const item = rows.item(i);
    history.push({
      id: item.id,
      number: item.phone || "Unknown",
      duration: item.duration,
      type: item.type as "incoming" | "outgoing" | "missed",
      time: new Date(item.date).toLocaleString(),
    });
  }

  return history;
};


export const getHistoryByLead = async (lead_id: number): Promise<any[]> => {
  const database = await openDatabase();
  const results = await database.executeSql(
    "SELECT * FROM history WHERE lead_id = ? ORDER BY date DESC;",
    [lead_id]
  );
  const rows = results[0].rows;
  const history: any[] = [];
  for (let i = 0; i < rows.length; i++) {
    history.push(rows.item(i));
  }
  return history;
};


export const getLeadByPhone = async (phone: string): Promise<any | null> => {
  const database = await openDatabase();
  const results = await database.executeSql(
    "SELECT * FROM leads WHERE phone = ?;",
    [phone]
  );
  const rows = results[0].rows;
  if (rows.length > 0) return rows.item(0);
  return null;
};


export type TimelineLog = {
  id: string | number;
  number: string;
  type:
    | "incoming"
    | "outgoing"
    | "missed"
    | "whatsapp"
    | "followup"
    | "Interested"
    | "Not Interested";
  duration: number;
  time: string;
  note?: string;
  status?: string;
};

export const getLeadWithHistoryAndStatus = async (phone: string) => {
  await openDatabase();
  if (!db) throw new Error("DB not initialized");

  // 1️⃣ Get lead info
  const leadResult = await db.executeSql("SELECT * FROM leads WHERE phone = ?;", [phone]);
  const leadRow = leadResult[0].rows.length > 0 ? leadResult[0].rows.item(0) : null;
  if (!leadRow) return null;

  // 2️⃣ Get call history (incoming, outgoing, missed)
  const historyResult = await db.executeSql(
    "SELECT * FROM history WHERE phone = ? ORDER BY date DESC;",
    [phone]
  );

  const history: TimelineLog[] = [];
  for (let i = 0; i < historyResult[0].rows.length; i++) {
    const row = historyResult[0].rows.item(i);
    history.push({
      id: row.id.toString(),
      number: row.phone,
      type: row.type as TimelineLog["type"],
      duration: row.duration || 0,
      time: row.date,
      note: row.note || "",
    });
  }

  // 3️⃣ Add lead status as timeline entry if status exists
  if (leadRow.status && leadRow.status !== "NEW") {
    history.push({
      id: "lead_status", // dummy ID
      number: leadRow.phone,
      type: leadRow.status as TimelineLog["type"],
      duration: 0,
      time: new Date().toISOString(),
      status: leadRow.status,
    });
  }

  // 4️⃣ Sort by time descending
  history.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  return { lead: leadRow, history };
};
