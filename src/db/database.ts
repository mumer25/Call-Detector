import SQLite from "react-native-sqlite-storage";

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


  // Users table (Login)
await database.executeSql(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id TEXT,
    user_name TEXT,
    login_time TEXT
  );
`);

// await database.executeSql("DROP TABLE IF EXISTS leads;");

  // Leads table
  await database.executeSql(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE,
      status TEXT,
      taskName TEXT,
      status_time TEXT,
      assignee TEXT,
      source TEXT,
      follow_up_date TEXT,
      created_at TEXT,
      status_note TEXT,   
      task_note TEXT 
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



export interface CallLog {
  id: number;
  number: string;
  time: string;   // ISO string
  duration: number;
  type: "incoming" | "outgoing" | "missed" | string;
}


/* ================= HELPER — Parse "2025-02-23, 02:20 PM" → ISO ================= */
const parseFollowUpDateStr = (dateStr: string): string | null => {
  try {
    // Accepts: "2026-02-25 02:00 PM" or "2026-02-25, 02:00 PM"
    const normalized = dateStr.replace(",", "").trim(); // remove comma
    const parts = normalized.split(" ");                // ["2026-02-25", "02:00", "PM"]
    if (parts.length < 3) return null;

    const [datePart, timePart, ampm] = parts;
    const [year, month, day] = datePart.split("-").map(Number);
    const [rawHours, rawMins] = timePart.split(":").map(Number);

    let hours = rawHours;
    if (ampm === "PM" && hours !== 12) hours += 12;
    if (ampm === "AM" && hours === 12) hours = 0;

    const parsed = new Date(year, month - 1, day, hours, rawMins, 0);
    return !isNaN(parsed.getTime()) ? parsed.toISOString() : null;
  } catch {
    return null;
  }
};

// ====================== Schemas =====================

export const saveLoggedInUser = async (
  entityId: string,
  userName: string
) => {
  const database = await openDatabase();

  const now = new Date().toISOString();

  // Remove previous user (only 1 active login allowed)
  await database.executeSql("DELETE FROM users;");

  await database.executeSql(
    "INSERT INTO users (entity_id, user_name, login_time) VALUES (?, ?, ?);",
    [entityId, userName, now]
  );
};

export const getLoggedInUser = async () => {
  const database = await openDatabase();

  const result = await database.executeSql(
    "SELECT * FROM users LIMIT 1;"
  );

  const rows = result[0].rows;

  if (rows.length > 0) {
    return rows.item(0);
  }

  return null;
};


export const clearLoggedInUser = async () => {
  const database = await openDatabase();
  await database.executeSql("DELETE FROM users;");
  await database.executeSql("DELETE FROM leads;");
  await database.executeSql("DELETE FROM history;");
};



/* ================= LEADS ================= */
export const insertLead = async (
  lead_id: number,
  name: string,
  phone: string,
  status: string = "Open",
  taskName: string | null = null,
  assignee: string = "",
  source: string = "web"
): Promise<void> => {
  const database = await openDatabase();

  // 1️⃣ Check if lead already exists
  const existing = await database.executeSql(
    "SELECT * FROM leads WHERE phone = ?;",
    [phone]
  );

  const now = new Date().toISOString();

  if (existing[0].rows.length > 0) {
    const oldLead = existing[0].rows.item(0);

    // 2️⃣ Only update if something changed
    if (
      oldLead.name !== name ||
      oldLead.status !== status ||
      oldLead.taskName !== null || // always update taskName to null on new lead creation
      oldLead.assignee !== assignee ||
      oldLead.source !== source
    ) {
      await database.executeSql(
        `UPDATE leads 
         SET name = ?, 
             status = ?, 
             assignee = ?, 
             source = ?,
             taskName = ?,
             status_time = CASE 
               WHEN status != ? THEN ? 
               ELSE status_time 
             END
         WHERE phone = ?;`,
        [name, status, assignee, source, taskName, status, now, phone]
      );
    }
  } else {
    // 3️⃣ Insert new lead
    await database.executeSql(
      `INSERT INTO leads 
        (id, name, phone, status, taskName, status_time, assignee, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [lead_id, name, phone, status, null, now, assignee, source]
    );
  }
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

/* ================= SYNC FOLLOW UP TO SERVER ================= */
const syncFollowUpToServer = async (
  leadId: number,
  followUpDateISO: string,
) => {
  try {
    // ✅ Only send YYYY-MM-DD
    const dateOnly = followUpDateISO.split("T")[0]; // "2026-02-26"

    const url =
      "https://server103.multi-techno.com:8383/ords/ard_holdings/crm_app/Update_followup_date";

    const body = `LEAD_ID=${leadId}&FOLLOW_UP_DATE=${encodeURIComponent(
      dateOnly
    )}`;

    console.log("📡 Calling API (FORM POST):", body);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body,
    });

    const text = await response.text();
    console.log("Status:", response.status);
    console.log("Response:", text);

    if (!response.ok) {
      console.error("❌ Follow up API error");
    } else {
      console.log("✅ Follow up synced successfully");
    }
  } catch (e) {
    console.error("❌ Failed to sync follow up:", e);
  }
};

/* ================= UPDATE LEAD STATUS ================= */
export const updateLeadStatusDB = async (
  phone: string,
  status: string,
  taskName?: string | null,
  note?: string
) => {
  const database = await openDatabase();
  const now = new Date().toISOString();
  const FOLLOW_UP_PREFIX = "Follow Up:";

  try {
    // ================= FOLLOW UP =================
    if (taskName && taskName.startsWith(FOLLOW_UP_PREFIX)) {
      const dateStr = taskName.replace(FOLLOW_UP_PREFIX, "").trim();
      const followUpDateISO = parseFollowUpDateStr(dateStr) ?? now;

      // ✅ Save to task_note — status_note stays untouched
      if (note && note.trim()) {
        await database.executeSql(
          `UPDATE leads SET taskName = ?, follow_up_date = ?, status_time = ?, task_note = ? WHERE phone = ?;`,
          [taskName, followUpDateISO, now, note.trim(), phone]
        );
      } else {
        await database.executeSql(
          `UPDATE leads SET taskName = ?, follow_up_date = ?, status_time = ? WHERE phone = ?;`,
          [taskName, followUpDateISO, now, phone]
        );
      }

      const lead = await getLeadByPhone(phone);
      const entityId = await getEntityId();
      if (lead?.id && entityId) {
        await syncFollowUpToServer(lead.id, followUpDateISO);
      }

      return;
    }

    // ================= STATUS ONLY =================
    // ✅ Save to status_note — task_note stays untouched
    if (note && note.trim()) {
      await database.executeSql(
        `UPDATE leads SET status = ?, status_time = ?, status_note = ? WHERE phone = ?;`,
        [status, now, note.trim(), phone]
      );
    } else {
      await database.executeSql(
        `UPDATE leads SET status = ?, status_time = ? WHERE phone = ?;`,
        [status, now, phone]
      );
    }

  } catch (error) {
    console.error("❌ updateLeadStatusDB error:", error);
  }
};


export const getEntityId = async (): Promise<string | null> => {
  const database = await openDatabase();
  const result = await database.executeSql("SELECT entity_id FROM users LIMIT 1;");
  const rows = result[0].rows;
  if (rows.length > 0) return rows.item(0).entity_id;
  return null;
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

  const callDate = date ? new Date(date) : new Date();
  const isoDate = isNaN(callDate.getTime())
    ? new Date().toISOString()
    : callDate.toISOString();

  await database.executeSql(
    "INSERT OR IGNORE INTO history (lead_id, phone, date, duration, type, note) VALUES (?, ?, ?, ?, ?, ?);",
    [lead_id, phone, isoDate, duration, type, note]
  );
};

export const getHistory = async (): Promise<CallLog[]> => {
  const database = await openDatabase();
  const results = await database.executeSql(
    "SELECT * FROM history ORDER BY date DESC;"
  );

  const rows = results[0].rows;
  const history: CallLog[] = [];

  for (let i = 0; i < rows.length; i++) {
    const item = rows.item(i);

    history.push({
      id: item.id,
      number: item.phone || "Unknown",
      duration: item.duration || 0,
      type: item.type,
      time: item.date,   // 🔥 return ISO string directly
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
  leadNote?: string;
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
  if (leadRow.status && leadRow.status !== "Open") {
    history.push({
      id: "lead_status", // dummy ID
      number: leadRow.phone,
      type: leadRow.status as TimelineLog["type"],
      duration: 0,
      time: leadRow.status_time || new Date().toISOString(),
      status: leadRow.status,
    });
  }

  // 4️⃣ Sort by time descending
  history.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  return { lead: leadRow, history };
};


// ===================== Updated Timeline Function =====================
export const getAllLeadsWithHistoryAndStatus = async (): Promise<{ lead: any; history: TimelineLog[] }[]> => {
  await openDatabase();
  if (!db) throw new Error("DB not initialized");

  const [leadsResult, historyResult] = await Promise.all([
    db.executeSql("SELECT * FROM leads ORDER BY id DESC;"),
    db.executeSql("SELECT * FROM history ORDER BY date DESC;"),
  ]);

  const leads = leadsResult[0].rows;
  const historyRows = historyResult[0].rows;

  const historyByPhone: Record<string, TimelineLog[]> = {};

  // 1️⃣ Group call history by phone
  for (let i = 0; i < historyRows.length; i++) {
    const row = historyRows.item(i);

    const log: TimelineLog = {
      id: row.id.toString(),
      number: row.phone,
      type: row.type as TimelineLog["type"],
      duration: row.duration || 0,
      time: row.date,
      note: row.note || "",
    };

    if (!historyByPhone[row.phone]) {
      historyByPhone[row.phone] = [];
    }

    historyByPhone[row.phone].push(log);
  }

  const finalData: { lead: any; history: TimelineLog[] }[] = [];

  // 2️⃣ Merge lead status + follow-up
  for (let i = 0; i < leads.length; i++) {
    const lead = leads.item(i);
    let logs = historyByPhone[lead.phone] ? [...historyByPhone[lead.phone]] : [];

    // ✅ Add STATUS (Interested / Not Interested / Wrong Number)
    if (lead.status && lead.status !== "Open" && lead.status !== "New") {
      logs.push({
        id: `status_${lead.id}`,
        number: lead.phone,
        type: lead.status as TimelineLog["type"],
        duration: 0,
        time: lead.status_time || new Date().toISOString(),
        status: lead.status,
        leadNote: lead.status_note || "",
      });
    }

    // ✅ Add FOLLOW UP (from taskName) with actual follow up date/time
    if (lead.taskName && lead.taskName.startsWith("Follow Up:")) {
      // Extract the date string after "Follow Up:"
      const followUpDateStr = lead.taskName.replace("Follow Up:", "").trim();

      // Try to parse it — works for both ISO and locale strings
      const followUpDate = new Date(followUpDateStr);
      const validTime =
        !isNaN(followUpDate.getTime())
          ? followUpDate.toISOString()
          : lead.status_time || new Date().toISOString(); // fallback

      logs.push({
        id: `followup_${lead.id}`,
        number: lead.phone,
        type: "followup",
        duration: 0,
        time: validTime,       // ✅ actual scheduled follow up date/time
        note: lead.taskName,   // ✅ "Follow Up: 2/23/2025, 3:00 PM" for display
        leadNote: lead.task_note || "",
      });
    }

    // 3️⃣ Sort by time descending
    logs.sort(
      (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
    );

    // 4️⃣ Remove duplicates
    const uniqueLogs: TimelineLog[] = [];
    logs.forEach((log) => {
      const last = uniqueLogs[uniqueLogs.length - 1];
      if (
        !last ||
        last.type !== log.type ||
        last.status !== log.status ||
        last.note !== log.note ||
        last.duration !== log.duration
      ) {
        uniqueLogs.push(log);
      }
    });

    // Include only leads with activity
    if (uniqueLogs.length > 0) {
      finalData.push({
        lead,
        history: uniqueLogs,
      });
    }
  }

  // 5️⃣ Sort leads by latest activity
  finalData.sort((a, b) => {
    const aTime = a.history.length ? new Date(a.history[0].time).getTime() : 0;
    const bTime = b.history.length ? new Date(b.history[0].time).getTime() : 0;
    return bTime - aTime;
  });

  return finalData;
};




// import SQLite from "react-native-sqlite-storage";

// SQLite.DEBUG(true);
// SQLite.enablePromise(true);

// let db: SQLite.SQLiteDatabase | null = null;

// /* ================= OPEN DATABASE ================= */
// export const openDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
//   if (db) return db;
//   try {
//     db = await SQLite.openDatabase({ name: "crm.db", location: "default" });
//     console.log("Database opened!");
//     return db;
//   } catch (err) {
//     console.error("Failed to open DB:", err);
//     throw err;
//   }
// };

// /* ================= INIT TABLES ================= */
// export const initDB = async () => {
//   const database = await openDatabase();


//   // Users table (Login)
// await database.executeSql(`
//   CREATE TABLE IF NOT EXISTS users (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     entity_id TEXT,
//     user_name TEXT,
//     login_time TEXT
//   );
// `);

// // await database.executeSql("DROP TABLE IF EXISTS leads;");

//   // Leads table
//   await database.executeSql(`
//     CREATE TABLE IF NOT EXISTS leads (
//       id INTEGER PRIMARY KEY,
//       name TEXT NOT NULL,
//       phone TEXT NOT NULL UNIQUE,
//       status TEXT,
//       taskName TEXT,
//       status_time TEXT,
//       assignee TEXT,
//       source TEXT,
//       follow_up_date TEXT,
//       created_at TEXT
//     );
//   `);

//   // Call history table
// // await database.executeSql("DROP TABLE IF EXISTS history;");
// await database.executeSql(`
//   CREATE TABLE IF NOT EXISTS history (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     lead_id INTEGER,
//     phone TEXT NOT NULL,
//     date TEXT NOT NULL,
//     duration INTEGER,
//     type TEXT,
//     note TEXT,
//     FOREIGN KEY(lead_id) REFERENCES leads(id)
//   );
// `);


//   console.log("Tables created!");
// };



// export interface CallLog {
//   id: number;
//   number: string;
//   time: string;   // ISO string
//   duration: number;
//   type: "incoming" | "outgoing" | "missed" | string;
// }


// /* ================= HELPER — Parse "2025-02-23, 02:20 PM" → ISO ================= */
// const parseFollowUpDateStr = (dateStr: string): string | null => {
//   try {
//     // Accepts: "2026-02-25 02:00 PM" or "2026-02-25, 02:00 PM"
//     const normalized = dateStr.replace(",", "").trim(); // remove comma
//     const parts = normalized.split(" ");                // ["2026-02-25", "02:00", "PM"]
//     if (parts.length < 3) return null;

//     const [datePart, timePart, ampm] = parts;
//     const [year, month, day] = datePart.split("-").map(Number);
//     const [rawHours, rawMins] = timePart.split(":").map(Number);

//     let hours = rawHours;
//     if (ampm === "PM" && hours !== 12) hours += 12;
//     if (ampm === "AM" && hours === 12) hours = 0;

//     const parsed = new Date(year, month - 1, day, hours, rawMins, 0);
//     return !isNaN(parsed.getTime()) ? parsed.toISOString() : null;
//   } catch {
//     return null;
//   }
// };
// // const parseFollowUpDateStr = (dateStr: string): string | null => {
// //   try {
// //     // Format: "2025-02-23, 02:20 PM"
// //     const normalized = dateStr.replace(",", "").trim(); // "2025-02-23 02:20 PM"
// //     const parts = normalized.split(" ");                // ["2025-02-23", "02:20", "PM"]
// //     if (parts.length < 3) return null;

// //     const [datePart, timePart, ampm] = parts;
// //     const [year, month, day] = datePart.split("-").map(Number);
// //     const [rawHours, rawMins] = timePart.split(":").map(Number);

// //     let hours = rawHours;
// //     if (ampm === "PM" && hours !== 12) hours += 12;
// //     if (ampm === "AM" && hours === 12) hours = 0;

// //     const parsed = new Date(year, month - 1, day, hours, rawMins, 0);
// //     return !isNaN(parsed.getTime()) ? parsed.toISOString() : null;
// //   } catch {
// //   return null;
// // }
// // };

// // ====================== Schemas =====================

// export const saveLoggedInUser = async (
//   entityId: string,
//   userName: string
// ) => {
//   const database = await openDatabase();

//   const now = new Date().toISOString();

//   // Remove previous user (only 1 active login allowed)
//   await database.executeSql("DELETE FROM users;");

//   await database.executeSql(
//     "INSERT INTO users (entity_id, user_name, login_time) VALUES (?, ?, ?);",
//     [entityId, userName, now]
//   );
// };

// export const getLoggedInUser = async () => {
//   const database = await openDatabase();

//   const result = await database.executeSql(
//     "SELECT * FROM users LIMIT 1;"
//   );

//   const rows = result[0].rows;

//   if (rows.length > 0) {
//     return rows.item(0);
//   }

//   return null;
// };


// export const clearLoggedInUser = async () => {
//   const database = await openDatabase();
//   await database.executeSql("DELETE FROM users;");
//   await database.executeSql("DELETE FROM leads;");
//   await database.executeSql("DELETE FROM history;");
// };



// /* ================= LEADS ================= */
// export const insertLead = async (
//   lead_id: number,
//   name: string,
//   phone: string,
//   status: string = "Open",
//   taskName: string | null = null,
//   assignee: string = "",
//   source: string = "web"
// ): Promise<void> => {
//   const database = await openDatabase();

//   // 1️⃣ Check if lead already exists
//   const existing = await database.executeSql(
//     "SELECT * FROM leads WHERE phone = ?;",
//     [phone]
//   );

//   const now = new Date().toISOString();

//   if (existing[0].rows.length > 0) {
//     const oldLead = existing[0].rows.item(0);

//     // 2️⃣ Only update if something changed
//     if (
//       oldLead.name !== name ||
//       oldLead.status !== status ||
//       oldLead.taskName !== null || // always update taskName to null on new lead creation
//       oldLead.assignee !== assignee ||
//       oldLead.source !== source
//     ) {
//       await database.executeSql(
//         `UPDATE leads 
//          SET name = ?, 
//              status = ?, 
//              assignee = ?, 
//              source = ?,
//              taskName = ?,
//              status_time = CASE 
//                WHEN status != ? THEN ? 
//                ELSE status_time 
//              END
//          WHERE phone = ?;`,
//         [name, status, assignee, source, taskName, status, now, phone]
//       );
//     }
//   } else {
//     // 3️⃣ Insert new lead
//     await database.executeSql(
//       `INSERT INTO leads 
//         (id, name, phone, status, taskName, status_time, assignee, source)
//        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
//       [lead_id, name, phone, status, null, now, assignee, source]
//     );
//   }
// };


// export const getLeads = async (): Promise<any[]> => {
//   const database = await openDatabase();
//   const results = await database.executeSql("SELECT * FROM leads ORDER BY id DESC;");
//   const rows = results[0].rows;
//   const leads: any[] = [];
//   for (let i = 0; i < rows.length; i++) {
//     leads.push(rows.item(i));
//   }
//   return leads;
// };

// export const searchLeads = async (query: string): Promise<any[]> => {
//   const database = await openDatabase();
//   const results = await database.executeSql(
//     "SELECT * FROM leads WHERE name LIKE ? OR phone LIKE ? ORDER BY id DESC;",
//     [`%${query}%`, `%${query}%`]
//   );
//   const rows = results[0].rows;
//   const leads: any[] = [];
//   for (let i = 0; i < rows.length; i++) {
//     leads.push(rows.item(i));
//   }
//   return leads;
// };

// /* ================= UPDATE LEAD STATUS ================= */
// // export const updateLeadStatusDB = async (
// //   phone: string,
// //   status: string,
// //   taskName?: string | null | undefined
// // ) => {
// //   const database = await openDatabase();
// //   const now = new Date().toISOString();

// //   if (taskName !== undefined && taskName !== null && taskName.startsWith("Follow Up:")) {
// //     // ✅ Parse "Follow Up: 2025-02-23, 02:20 PM" → ISO for DB storage
// //     const dateStr = taskName.replace("Follow Up:", "").trim();
// //     const followUpDate = parseFollowUpDateStr(dateStr) ?? now;

// //     console.log("💾 Saving follow_up_date:", followUpDate, "| taskName:", taskName);

// //     await database.executeSql(
// //       `UPDATE leads SET taskName = ?, follow_up_date = ?, status_time = ? WHERE phone = ?;`,
// //       [taskName, followUpDate, now, phone]
// //     );

// //     // ✅ Verify saved correctly
// //     const check = await database.executeSql(
// //       "SELECT follow_up_date, taskName FROM leads WHERE phone = ?;", [phone]
// //     );
// //     console.log("✅ Verified:", check[0].rows.item(0));

// //   } else if (taskName === undefined) {
// //     // ✅ Only status — never touch taskName or follow_up_date
// //     await database.executeSql(
// //       `UPDATE leads SET status = ?, status_time = ? WHERE phone = ?;`,
// //       [status, now, phone]
// //     );

// //   } else {
// //     // ✅ Status with explicit null — only update status
// //     await database.executeSql(
// //       `UPDATE leads SET status = ?, status_time = ? WHERE phone = ?;`,
// //       [status, now, phone]
// //     );
// //   }
// // };

// // const formatForOracle = (isoString: string) => {
// //   const date = new Date(isoString);

// //   const yyyy = date.getFullYear();
// //   const mm = String(date.getMonth() + 1).padStart(2, "0");
// //   const dd = String(date.getDate()).padStart(2, "0");
// //   const hh = String(date.getHours()).padStart(2, "0");
// //   const min = String(date.getMinutes()).padStart(2, "0");
// //   const ss = String(date.getSeconds()).padStart(2, "0");

// //   return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
// // };

// /* ================= SYNC FOLLOW UP TO SERVER ================= */
// const syncFollowUpToServer = async (
//   leadId: number,
//   followUpDateISO: string,
// ) => {
//   try {
//     // ✅ Only send YYYY-MM-DD
//     const dateOnly = followUpDateISO.split("T")[0]; // "2026-02-26"

//     const url =
//       "https://server103.multi-techno.com:8383/ords/ard_holdings/crm_app/Update_followup_date";

//     const body = `LEAD_ID=${leadId}&FOLLOW_UP_DATE=${encodeURIComponent(
//       dateOnly
//     )}`;

//     console.log("📡 Calling API (FORM POST):", body);

//     const response = await fetch(url, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/x-www-form-urlencoded",
//       },
//       body: body,
//     });

//     const text = await response.text();
//     console.log("Status:", response.status);
//     console.log("Response:", text);

//     if (!response.ok) {
//       console.error("❌ Follow up API error");
//     } else {
//       console.log("✅ Follow up synced successfully");
//     }
//   } catch (e) {
//     console.error("❌ Failed to sync follow up:", e);
//   }
// };

// /* ================= UPDATE LEAD STATUS ================= */
// export const updateLeadStatusDB = async (
//   phone: string,
//   status: string,
//   taskName?: string | null
// ) => {
//   const database = await openDatabase();
//   const now = new Date().toISOString();
//   const FOLLOW_UP_PREFIX = "Follow Up:";

//   try {
//     // ================= FOLLOW UP =================
//     if (taskName && taskName.startsWith(FOLLOW_UP_PREFIX)) {
//       const dateStr = taskName.replace(FOLLOW_UP_PREFIX, "").trim();
//       const followUpDateISO = parseFollowUpDateStr(dateStr) ?? now;

//       await database.executeSql(
//         `UPDATE leads 
//          SET taskName = ?, 
//              follow_up_date = ?, 
//              status_time = ?
//          WHERE phone = ?;`,
//         [taskName, followUpDateISO, now, phone]
//       );

//       // ✅ sync to backend with DATE only
//       const lead = await getLeadByPhone(phone);
//       const entityId = await getEntityId();
//       if (lead?.id && entityId) {
//         await syncFollowUpToServer(lead.id, followUpDateISO);
//       }

//       return;
//     }

//     // ================= STATUS ONLY =================
//     // "Wrong number", "Interested", "Not Interested", etc.
//     await database.executeSql(
//       `UPDATE leads 
//        SET status = ?, 
//            status_time = ?
//        WHERE phone = ?;`,
//       [status, now, phone]
//     );

//   } catch (error) {
//     console.error("❌ updateLeadStatusDB error:", error);
//   }
// };



// export const getEntityId = async (): Promise<string | null> => {
//   const database = await openDatabase();
//   const result = await database.executeSql("SELECT entity_id FROM users LIMIT 1;");
//   const rows = result[0].rows;
//   if (rows.length > 0) return rows.item(0).entity_id;
//   return null;
// };

// /* ================= CALL HISTORY ================= */
// export const insertHistory = async (
//   lead_id: number | null,
//   phone: string,
//   date?: string | number,
//   duration: number = 0,
//   type: string = "dialed",
//   note: string = ""
// ) => {
//   const database = await openDatabase();

//   const callDate = date ? new Date(date) : new Date();
//   const isoDate = isNaN(callDate.getTime())
//     ? new Date().toISOString()
//     : callDate.toISOString();

//   await database.executeSql(
//     "INSERT OR IGNORE INTO history (lead_id, phone, date, duration, type, note) VALUES (?, ?, ?, ?, ?, ?);",
//     [lead_id, phone, isoDate, duration, type, note]
//   );
// };

// export const getHistory = async (): Promise<CallLog[]> => {
//   const database = await openDatabase();
//   const results = await database.executeSql(
//     "SELECT * FROM history ORDER BY date DESC;"
//   );

//   const rows = results[0].rows;
//   const history: CallLog[] = [];

//   for (let i = 0; i < rows.length; i++) {
//     const item = rows.item(i);

//     history.push({
//       id: item.id,
//       number: item.phone || "Unknown",
//       duration: item.duration || 0,
//       type: item.type,
//       time: item.date,   // 🔥 return ISO string directly
//     });
//   }

//   return history;
// };



// export const getHistoryByLead = async (lead_id: number): Promise<any[]> => {
//   const database = await openDatabase();
//   const results = await database.executeSql(
//     "SELECT * FROM history WHERE lead_id = ? ORDER BY date DESC;",
//     [lead_id]
//   );
//   const rows = results[0].rows;
//   const history: any[] = [];
//   for (let i = 0; i < rows.length; i++) {
//     history.push(rows.item(i));
//   }
//   return history;
// };


// export const getLeadByPhone = async (phone: string): Promise<any | null> => {
//   const database = await openDatabase();
//   const results = await database.executeSql(
//     "SELECT * FROM leads WHERE phone = ?;",
//     [phone]
//   );
//   const rows = results[0].rows;
//   if (rows.length > 0) return rows.item(0);
//   return null;
// };


// export type TimelineLog = {
//   id: string | number;
//   number: string;
//   type:
//     | "incoming"
//     | "outgoing"
//     | "missed"
//     | "whatsapp"
//     | "followup"
//     | "Interested"
//     | "Not Interested";
//   duration: number;
//   time: string;
//   note?: string;
//   status?: string;
// };

// export const getLeadWithHistoryAndStatus = async (phone: string) => {
//   await openDatabase();
//   if (!db) throw new Error("DB not initialized");

//   // 1️⃣ Get lead info
//   const leadResult = await db.executeSql("SELECT * FROM leads WHERE phone = ?;", [phone]);
//   const leadRow = leadResult[0].rows.length > 0 ? leadResult[0].rows.item(0) : null;
//   if (!leadRow) return null;

//   // 2️⃣ Get call history (incoming, outgoing, missed)
//   const historyResult = await db.executeSql(
//     "SELECT * FROM history WHERE phone = ? ORDER BY date DESC;",
//     [phone]
//   );

//   const history: TimelineLog[] = [];
//   for (let i = 0; i < historyResult[0].rows.length; i++) {
//     const row = historyResult[0].rows.item(i);
//     history.push({
//       id: row.id.toString(),
//       number: row.phone,
//       type: row.type as TimelineLog["type"],
//       duration: row.duration || 0,
//       time: row.date,
//       note: row.note || "",
//     });
//   }

//   // 3️⃣ Add lead status as timeline entry if status exists
//   if (leadRow.status && leadRow.status !== "Open") {
//     history.push({
//       id: "lead_status", // dummy ID
//       number: leadRow.phone,
//       type: leadRow.status as TimelineLog["type"],
//       duration: 0,
//       time: leadRow.status_time || new Date().toISOString(),
//       status: leadRow.status,
//     });
//   }

//   // 4️⃣ Sort by time descending
//   history.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

//   return { lead: leadRow, history };
// };


// // ===================== Updated Timeline Function =====================
// export const getAllLeadsWithHistoryAndStatus = async (): Promise<{ lead: any; history: TimelineLog[] }[]> => {
//   await openDatabase();
//   if (!db) throw new Error("DB not initialized");

//   const [leadsResult, historyResult] = await Promise.all([
//     db.executeSql("SELECT * FROM leads ORDER BY id DESC;"),
//     db.executeSql("SELECT * FROM history ORDER BY date DESC;"),
//   ]);

//   const leads = leadsResult[0].rows;
//   const historyRows = historyResult[0].rows;

//   const historyByPhone: Record<string, TimelineLog[]> = {};

//   // 1️⃣ Group call history by phone
//   for (let i = 0; i < historyRows.length; i++) {
//     const row = historyRows.item(i);

//     const log: TimelineLog = {
//       id: row.id.toString(),
//       number: row.phone,
//       type: row.type as TimelineLog["type"],
//       duration: row.duration || 0,
//       time: row.date,
//       note: row.note || "",
//     };

//     if (!historyByPhone[row.phone]) {
//       historyByPhone[row.phone] = [];
//     }

//     historyByPhone[row.phone].push(log);
//   }

//   const finalData: { lead: any; history: TimelineLog[] }[] = [];

//   // 2️⃣ Merge lead status + follow-up
//   for (let i = 0; i < leads.length; i++) {
//     const lead = leads.item(i);
//     let logs = historyByPhone[lead.phone] ? [...historyByPhone[lead.phone]] : [];

//     // ✅ Add STATUS (Interested / Not Interested / Wrong Number)
//     if (lead.status && lead.status !== "Open" && lead.status !== "New") {
//       logs.push({
//         id: `status_${lead.id}`,
//         number: lead.phone,
//         type: lead.status as TimelineLog["type"],
//         duration: 0,
//         time: lead.status_time || new Date().toISOString(),
//         status: lead.status,
//       });
//     }

//     // ✅ Add FOLLOW UP (from taskName) with actual follow up date/time
//     if (lead.taskName && lead.taskName.startsWith("Follow Up:")) {
//       // Extract the date string after "Follow Up:"
//       const followUpDateStr = lead.taskName.replace("Follow Up:", "").trim();

//       // Try to parse it — works for both ISO and locale strings
//       const followUpDate = new Date(followUpDateStr);
//       const validTime =
//         !isNaN(followUpDate.getTime())
//           ? followUpDate.toISOString()
//           : lead.status_time || new Date().toISOString(); // fallback

//       logs.push({
//         id: `followup_${lead.id}`,
//         number: lead.phone,
//         type: "followup",
//         duration: 0,
//         time: validTime,       // ✅ actual scheduled follow up date/time
//         note: lead.taskName,   // ✅ "Follow Up: 2/23/2025, 3:00 PM" for display
//       });
//     }

//     // 3️⃣ Sort by time descending
//     logs.sort(
//       (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
//     );

//     // 4️⃣ Remove duplicates
//     const uniqueLogs: TimelineLog[] = [];
//     logs.forEach((log) => {
//       const last = uniqueLogs[uniqueLogs.length - 1];
//       if (
//         !last ||
//         last.type !== log.type ||
//         last.status !== log.status ||
//         last.note !== log.note ||
//         last.duration !== log.duration
//       ) {
//         uniqueLogs.push(log);
//       }
//     });

//     // Include only leads with activity
//     if (uniqueLogs.length > 0) {
//       finalData.push({
//         lead,
//         history: uniqueLogs,
//       });
//     }
//   }

//   // 5️⃣ Sort leads by latest activity
//   finalData.sort((a, b) => {
//     const aTime = a.history.length ? new Date(a.history[0].time).getTime() : 0;
//     const bTime = b.history.length ? new Date(b.history[0].time).getTime() : 0;
//     return bTime - aTime;
//   });

//   return finalData;
// };




// export const getAllLeadsWithHistoryAndStatus = async (): Promise<{ lead: any; history: TimelineLog[] }[]> => {
//   await openDatabase();
//   if (!db) throw new Error("DB not initialized");

//   const [leadsResult, historyResult] = await Promise.all([
//     db.executeSql("SELECT * FROM leads ORDER BY id DESC;"),
//     db.executeSql("SELECT * FROM history ORDER BY date DESC;"),
//   ]);

//   const leads = leadsResult[0].rows;
//   const historyRows = historyResult[0].rows;

//   const historyByPhone: Record<string, TimelineLog[]> = {};

//   // Group history by phone
//   for (let i = 0; i < historyRows.length; i++) {
//     const row = historyRows.item(i);
//     const log: TimelineLog = {
//       id: row.id.toString(),
//       number: row.phone,
//       type: row.type as TimelineLog["type"],
//       duration: row.duration || 0,
//       time: row.date,
//       note: row.note || "",
//     };
//     if (!historyByPhone[row.phone]) historyByPhone[row.phone] = [];
//     historyByPhone[row.phone].push(log);
//   }

//   const finalData: { lead: any; history: TimelineLog[] }[] = [];

//   for (let i = 0; i < leads.length; i++) {
//     const lead = leads.item(i);
//     let logs = historyByPhone[lead.phone] || [];

//     // Include status change only if status exists and is not "Open"
//     if (lead.status && lead.status !== "Open") {
//       logs.push({
//         id: `status_${lead.id}`,
//         number: lead.phone,
//         type: lead.status as TimelineLog["type"],
//         duration: 0,
//         time: lead.status_time || new Date().toISOString(),
//         status: lead.status,
//       });
//     }

//     // Sort logs by time descending
//     logs.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

//     // Remove consecutive duplicate/unchanged logs
//     const uniqueLogs: TimelineLog[] = [];
//     logs.forEach((log) => {
//       const last = uniqueLogs[uniqueLogs.length - 1];
//       if (
//         !last ||
//         last.type !== log.type ||
//         last.status !== log.status ||
//         last.note !== log.note ||
//         last.duration !== log.duration
//       ) {
//         uniqueLogs.push(log);
//       }
//     });

//     // Only include leads with at least one updated timeline
//     if (uniqueLogs.length > 0) {
//       finalData.push({
//         lead,
//         history: uniqueLogs,
//       });
//     }
//   }

//   // Sort leads by the latest timeline
//   finalData.sort((a, b) => {
//     const aTime = a.history.length ? new Date(a.history[0].time).getTime() : 0;
//     const bTime = b.history.length ? new Date(b.history[0].time).getTime() : 0;
//     return bTime - aTime;
//   });

//   return finalData;
// };






// Timeline Screen Funtion
// export const getAllLeadsWithHistoryAndStatus = async () => {
//   await openDatabase();
//   if (!db) throw new Error("DB not initialized");

//   const [leadsResult, historyResult] = await Promise.all([
//     db.executeSql("SELECT * FROM leads ORDER BY id DESC;"),
//     db.executeSql("SELECT * FROM history ORDER BY date DESC;"),
//   ]);

//   const leads = leadsResult[0].rows;
//   const historyRows = historyResult[0].rows;

//   const historyByPhone: Record<string, TimelineLog[]> = {};

//   for (let i = 0; i < historyRows.length; i++) {
//     const row = historyRows.item(i);
//     const log: TimelineLog = {
//       id: row.id.toString(),
//       number: row.phone,
//       type: row.type,
//       duration: row.duration || 0,
//       time: row.date,
//       note: row.note || "",
//     };
//     if (!historyByPhone[row.phone]) historyByPhone[row.phone] = [];
//     historyByPhone[row.phone].push(log);
//   }

//   const finalData = [];
//   for (let i = 0; i < leads.length; i++) {
//     const lead = leads.item(i);
//     const logs = historyByPhone[lead.phone] || [];

//     if (lead.status && lead.status !== "Open") {
//       logs.push({
//         id: `status_${lead.id}`,
//         number: lead.phone,
//         type: lead.status,
//         duration: 0,
//         time: lead.status_time || new Date().toISOString(),
//         status: lead.status,
//       });
//     }

//     logs.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

//     finalData.push({
//       lead,
//       history: logs,
//     });
//   }

//   return finalData;
// };





// import SQLite from "react-native-sqlite-storage";

// SQLite.DEBUG(true);
// SQLite.enablePromise(true);

// let db: SQLite.SQLiteDatabase | null = null;

// /* ================= OPEN DATABASE ================= */
// export const openDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
//   if (db) return db;
//   try {
//     db = await SQLite.openDatabase({ name: "crm.db", location: "default" });
//     console.log("Database opened!");
//     return db;
//   } catch (err) {
//     console.error("Failed to open DB:", err);
//     throw err;
//   }
// };

// /* ================= INIT TABLES ================= */
// export const initDB = async () => {
//   const database = await openDatabase();


//   // Users table (Login)
// await database.executeSql(`
//   CREATE TABLE IF NOT EXISTS users (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     entity_id TEXT,
//     user_name TEXT,
//     login_time TEXT
//   );
// `);

// // await database.executeSql("DROP TABLE IF EXISTS leads;");

//   // Leads table
//   await database.executeSql(`
//     CREATE TABLE IF NOT EXISTS leads (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       name TEXT NOT NULL,
//       phone TEXT NOT NULL UNIQUE,
//       status TEXT,
//       status_time TEXT,
//       assignee TEXT,
//       source TEXT
//     );
//   `);

//   // Call history table
// // await database.executeSql("DROP TABLE IF EXISTS history;");
// await database.executeSql(`
//   CREATE TABLE IF NOT EXISTS history (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     lead_id INTEGER,
//     phone TEXT NOT NULL,
//     date TEXT NOT NULL,
//     duration INTEGER,
//     type TEXT,
//     note TEXT,
//     FOREIGN KEY(lead_id) REFERENCES leads(id)
//   );
// `);


//   console.log("Tables created!");
// };



// export interface CallLog {
//   id: number;
//   number: string;
//   time: string;   // ISO string
//   duration: number;
//   type: "incoming" | "outgoing" | "missed" | string;
// }




// // ====================== Schemas =====================

// export const saveLoggedInUser = async (
//   entityId: string,
//   userName: string
// ) => {
//   const database = await openDatabase();

//   const now = new Date().toISOString();

//   // Remove previous user (only 1 active login allowed)
//   await database.executeSql("DELETE FROM users;");

//   await database.executeSql(
//     "INSERT INTO users (entity_id, user_name, login_time) VALUES (?, ?, ?);",
//     [entityId, userName, now]
//   );
// };

// export const getLoggedInUser = async () => {
//   const database = await openDatabase();

//   const result = await database.executeSql(
//     "SELECT * FROM users LIMIT 1;"
//   );

//   const rows = result[0].rows;

//   if (rows.length > 0) {
//     return rows.item(0);
//   }

//   return null;
// };


// export const clearLoggedInUser = async () => {
//   const database = await openDatabase();
//   await database.executeSql("DELETE FROM users;");
// };



// /* ================= LEADS ================= */
// export const insertLead = async (
//   lead_id: number,       // use API lead_id
//   name: string,
//   phone: string,
//   status: string = "NEW",
//   assignee: string = "",
//   source: string = "web"
// ): Promise<number> => {
//   const database = await openDatabase();
//   const now = new Date().toISOString();

//   // Use phone as UNIQUE key for INSERT OR REPLACE
//   const result = await database.executeSql(
//     `INSERT OR REPLACE INTO leads 
//       (id, name, phone, status, status_time, assignee, source)
//      VALUES (?, ?, ?, ?, ?, ?, ?)`,
//     [lead_id, name, phone, status, now, assignee, source]
//   );

//   return result[0].insertId;
// };



// export const getLeads = async (): Promise<any[]> => {
//   const database = await openDatabase();
//   const results = await database.executeSql("SELECT * FROM leads ORDER BY id DESC;");
//   const rows = results[0].rows;
//   const leads: any[] = [];
//   for (let i = 0; i < rows.length; i++) {
//     leads.push(rows.item(i));
//   }
//   return leads;
// };

// export const searchLeads = async (query: string): Promise<any[]> => {
//   const database = await openDatabase();
//   const results = await database.executeSql(
//     "SELECT * FROM leads WHERE name LIKE ? OR phone LIKE ? ORDER BY id DESC;",
//     [`%${query}%`, `%${query}%`]
//   );
//   const rows = results[0].rows;
//   const leads: any[] = [];
//   for (let i = 0; i < rows.length; i++) {
//     leads.push(rows.item(i));
//   }
//   return leads;
// };

// export const updateLeadStatusDB = async (phone: string, status: string) => {
//   const database = await openDatabase();
//   const now = new Date().toISOString();
//   await database.executeSql(
//     "UPDATE leads SET status = ?, status_time = ? WHERE phone = ?;",
//     [status, now, phone]
//   );
// };



// /* ================= CALL HISTORY ================= */
// export const insertHistory = async (
//   lead_id: number | null,
//   phone: string,
//   date?: string | number,
//   duration: number = 0,
//   type: string = "dialed",
//   note: string = ""
// ) => {
//   const database = await openDatabase();

//   const callDate = date ? new Date(date) : new Date();
//   const isoDate = isNaN(callDate.getTime())
//     ? new Date().toISOString()
//     : callDate.toISOString();

//   await database.executeSql(
//     "INSERT OR IGNORE INTO history (lead_id, phone, date, duration, type, note) VALUES (?, ?, ?, ?, ?, ?);",
//     [lead_id, phone, isoDate, duration, type, note]
//   );
// };

// export const getHistory = async (): Promise<CallLog[]> => {
//   const database = await openDatabase();
//   const results = await database.executeSql(
//     "SELECT * FROM history ORDER BY date DESC;"
//   );

//   const rows = results[0].rows;
//   const history: CallLog[] = [];

//   for (let i = 0; i < rows.length; i++) {
//     const item = rows.item(i);

//     history.push({
//       id: item.id,
//       number: item.phone || "Unknown",
//       duration: item.duration || 0,
//       type: item.type,
//       time: item.date,   // 🔥 return ISO string directly
//     });
//   }

//   return history;
// };



// export const getHistoryByLead = async (lead_id: number): Promise<any[]> => {
//   const database = await openDatabase();
//   const results = await database.executeSql(
//     "SELECT * FROM history WHERE lead_id = ? ORDER BY date DESC;",
//     [lead_id]
//   );
//   const rows = results[0].rows;
//   const history: any[] = [];
//   for (let i = 0; i < rows.length; i++) {
//     history.push(rows.item(i));
//   }
//   return history;
// };


// export const getLeadByPhone = async (phone: string): Promise<any | null> => {
//   const database = await openDatabase();
//   const results = await database.executeSql(
//     "SELECT * FROM leads WHERE phone = ?;",
//     [phone]
//   );
//   const rows = results[0].rows;
//   if (rows.length > 0) return rows.item(0);
//   return null;
// };


// export type TimelineLog = {
//   id: string | number;
//   number: string;
//   type:
//     | "incoming"
//     | "outgoing"
//     | "missed"
//     | "whatsapp"
//     | "followup"
//     | "Interested"
//     | "Not Interested";
//   duration: number;
//   time: string;
//   note?: string;
//   status?: string;
// };

// export const getLeadWithHistoryAndStatus = async (phone: string) => {
//   await openDatabase();
//   if (!db) throw new Error("DB not initialized");

//   // 1️⃣ Get lead info
//   const leadResult = await db.executeSql("SELECT * FROM leads WHERE phone = ?;", [phone]);
//   const leadRow = leadResult[0].rows.length > 0 ? leadResult[0].rows.item(0) : null;
//   if (!leadRow) return null;

//   // 2️⃣ Get call history (incoming, outgoing, missed)
//   const historyResult = await db.executeSql(
//     "SELECT * FROM history WHERE phone = ? ORDER BY date DESC;",
//     [phone]
//   );

//   const history: TimelineLog[] = [];
//   for (let i = 0; i < historyResult[0].rows.length; i++) {
//     const row = historyResult[0].rows.item(i);
//     history.push({
//       id: row.id.toString(),
//       number: row.phone,
//       type: row.type as TimelineLog["type"],
//       duration: row.duration || 0,
//       time: row.date,
//       note: row.note || "",
//     });
//   }

//   // 3️⃣ Add lead status as timeline entry if status exists
//   if (leadRow.status && leadRow.status !== "NEW") {
//     history.push({
//       id: "lead_status", // dummy ID
//       number: leadRow.phone,
//       type: leadRow.status as TimelineLog["type"],
//       duration: 0,
//       time: leadRow.status_time || new Date().toISOString(),
//       status: leadRow.status,
//     });
//   }

//   // 4️⃣ Sort by time descending
//   history.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

//   return { lead: leadRow, history };
// };



// // Timeline Screen Funtion
// export const getAllLeadsWithHistoryAndStatus = async () => {
//   await openDatabase();
//   if (!db) throw new Error("DB not initialized");

//   const [leadsResult, historyResult] = await Promise.all([
//     db.executeSql("SELECT * FROM leads ORDER BY id DESC;"),
//     db.executeSql("SELECT * FROM history ORDER BY date DESC;"),
//   ]);

//   const leads = leadsResult[0].rows;
//   const historyRows = historyResult[0].rows;

//   const historyByPhone: Record<string, TimelineLog[]> = {};

//   for (let i = 0; i < historyRows.length; i++) {
//     const row = historyRows.item(i);
//     const log: TimelineLog = {
//       id: row.id.toString(),
//       number: row.phone,
//       type: row.type,
//       duration: row.duration || 0,
//       time: row.date,
//       note: row.note || "",
//     };
//     if (!historyByPhone[row.phone]) historyByPhone[row.phone] = [];
//     historyByPhone[row.phone].push(log);
//   }

//   const finalData = [];
//   for (let i = 0; i < leads.length; i++) {
//     const lead = leads.item(i);
//     const logs = historyByPhone[lead.phone] || [];

//     if (lead.status && lead.status !== "NEW") {
//       logs.push({
//         id: `status_${lead.id}`,
//         number: lead.phone,
//         type: lead.status,
//         duration: 0,
//         time: lead.status_time || new Date().toISOString(),
//         status: lead.status,
//       });
//     }

//     logs.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

//     finalData.push({
//       lead,
//       history: logs,
//     });
//   }

//   return finalData;
// };




// export const getAllLeadsWithHistoryAndStatus = async () => {
//   await openDatabase();
//   if (!db) throw new Error("DB not initialized");

//   // 1️⃣ Get all leads
//   const leadsResult = await db.executeSql(
//     "SELECT * FROM leads ORDER BY id DESC;"
//   );

//   const finalData: any[] = [];

//   for (let i = 0; i < leadsResult[0].rows.length; i++) {
//     const lead = leadsResult[0].rows.item(i);

//     // 2️⃣ Get history for this lead
//     const historyResult = await db.executeSql(
//       "SELECT * FROM history WHERE phone = ? ORDER BY date DESC;",
//       [lead.phone]
//     );

//     const history: TimelineLog[] = [];

//     for (let j = 0; j < historyResult[0].rows.length; j++) {
//       const row = historyResult[0].rows.item(j);

//       history.push({
//         id: row.id.toString(),
//         number: row.phone,
//         type: row.type as TimelineLog["type"],
//         duration: row.duration || 0,
//         time: row.date,
//         note: row.note || "",
//       });
//     }

//     // 3️⃣ Add lead status as timeline entry (if not NEW)
//     if (lead.status && lead.status !== "NEW") {
//       history.push({
//         id: `status_${lead.id}`,
//         number: lead.phone,
//         type: lead.status as TimelineLog["type"],
//         duration: 0,
//         time: lead.status_time || new Date().toISOString(),
//         status: lead.status,
//       });
//     }

//     // 4️⃣ Sort timeline by date descending
//     history.sort(
//       (a, b) =>
//         new Date(b.time).getTime() - new Date(a.time).getTime()
//     );

//     finalData.push({
//       lead,
//       history,
//     });
//   }

//   return finalData;
// };
