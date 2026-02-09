import SQLite from "react-native-sqlite-storage";

SQLite.DEBUG(true);
SQLite.enablePromise(true);

let db: SQLite.SQLiteDatabase | null = null;

// Open DB
export const openDatabase = async () => {
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

// Initialize tables
export const initDB = async () => {
  const database = await openDatabase();

  // Leads table
  await database.executeSql(
    `CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      status TEXT,
      assignee TEXT,
      source TEXT
    );`
  );

  // Call history table
  await database.executeSql(
    `CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER,
      phone TEXT NOT NULL,
      date TEXT NOT NULL,
      duration TEXT,
      FOREIGN KEY(lead_id) REFERENCES leads(id)
    );`
  );

  console.log("Tables created!");
};

// Insert a lead
export const insertLead = async (name: string, phone: string, status?: string, assignee?: string, source?: string) => {
  const database = await openDatabase();
  const result = await database.executeSql(
    "INSERT INTO leads (name, phone, status, assignee, source) VALUES (?, ?, ?, ?, ?);",
    [name, phone, status || "NEW", assignee || "", source || "web"]
  );
  return result[0].insertId;
};

// Get all leads
export const getLeads = async () => {
  const database = await openDatabase();
  const results = await database.executeSql("SELECT * FROM leads;");
  const rows = results[0].rows;
  const leads: any[] = [];
  for (let i = 0; i < rows.length; i++) {
    leads.push(rows.item(i));
  }
  return leads;
};

// Insert call history
export const insertHistory = async (lead_id: number | null, phone: string, date: string, duration?: string) => {
  const database = await openDatabase();
  await database.executeSql(
    "INSERT INTO history (lead_id, phone, date, duration) VALUES (?, ?, ?, ?);",
    [lead_id, phone, date, duration || null]
  );
};

// Get call history
export const getHistory = async () => {
  const database = await openDatabase();
  const results = await database.executeSql("SELECT * FROM history ORDER BY date DESC;");
  const rows = results[0].rows;
  const history: any[] = [];
  for (let i = 0; i < rows.length; i++) {
    history.push(rows.item(i));
  }
  return history;
};
