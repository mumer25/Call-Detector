import { getLoggedInUser, openDatabase } from '../db/database';

type LeadAPI = {
  lead_id: number;
  name: string;
  phone?: string;
  status?: string;
  assignee?: string;
  lead_source?: string;
};

export const mapLeadSource = (source?: string): 'fb' | 'jd' | 'web' => {
  if (!source) return 'web';
  source = source.toLowerCase();
  if (source.includes('facebook')) return 'fb';
  if (source.includes('dealer') || source.includes('jd')) return 'jd';
  return 'web';
};

export const fetchAndStoreLeads = async (): Promise<void> => {
  try {
    const user = await getLoggedInUser();
    if (!user?.entity_id) return;

    const db = await openDatabase();

    let offset = 0;
    const limit = 5000;
    let hasMore = true;

    while (hasMore) {
      const url = `https://server103.multi-techno.com:8383/ords/ard_holdings/crm_app/get_leads_data?entity_id=${user.entity_id}&offset=${offset}&limit=${limit}`;
      const response = await fetch(url);

      if (!response.ok) throw new Error('Failed to fetch leads');

      const data = await response.json();
      const items: LeadAPI[] = data.items || [];

      if (items.length === 0) {
        hasMore = false;
        break;
      }

      await db.transaction((txn) => {
        for (const lead of items) {
          const phone = lead.phone?.trim() || 'N/A';
          const now = new Date().toISOString();
          const apiName = lead.name || 'Unknown';
          const apiAssignee = lead.assignee || '-';
          const apiSource = mapLeadSource(lead.lead_source);
          const apiStatus = lead.status || '-';

          // 1️⃣ Insert new lead only if it doesn't exist
          // Preserves local status, taskName, status_time for existing leads
          txn.executeSql(
            `INSERT OR IGNORE INTO leads 
              (id, name, phone, status, status_time, assignee, source, taskName)
             VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
            [lead.lead_id, apiName, phone, apiStatus, now, apiAssignee, apiSource]
          );

          // 2️⃣ For existing leads — only update API-controlled fields
          // Never touch status, taskName, status_time (those are local user data)
          txn.executeSql(
            `UPDATE leads SET
               name     = ?,
               phone    = ?,
               assignee = ?,
               source   = ?
             WHERE id = ?`,
            [apiName, phone, apiAssignee, apiSource, lead.lead_id]
          );
        }
      });

      hasMore = data.hasMore ?? false;
      offset += limit;
    }

    console.log('✅ Leads synced successfully!');
  } catch (err) {
    console.error('❌ Error in fetchAndStoreLeads:', err);
  }
};


// import { getLoggedInUser, openDatabase } from '../db/database';


// type LeadAPI = {
//   lead_id: number;
//   name: string;
//   phone?: string;
//   status?: string;
//   assignee?: string;
//   lead_source?: string;
// };

// export const mapLeadSource = (source?: string): 'fb' | 'jd' | 'web' => {
//   if (!source) return 'web';
//   source = source.toLowerCase();
//   if (source.includes('facebook')) return 'fb';
//   if (source.includes('dealer') || source.includes('jd')) return 'jd';
//   return 'web';
// };

// export const fetchAndStoreLeads = async (): Promise<void> => {
//   try {
//     const user = await getLoggedInUser();
//     if (!user?.entity_id) return;

//     const db = await openDatabase();

//     let offset = 0;
//     let limit = 5000; // fetch more per API call if server allows
//     let hasMore = true;

//     while (hasMore) {
//       const url = `https://server103.multi-techno.com:8383/ords/ard_holdings/crm_app/get_leads_data?entity_id=${user.entity_id}&offset=${offset}&limit=${limit}`;
//       const response = await fetch(url);

//       if (!response.ok) throw new Error('Failed to fetch leads');

//       const data = await response.json();
//       const items: LeadAPI[] = data.items || [];

//       // Start a single transaction for all leads
//       await db.transaction((txn) => {
//         for (const lead of items) {
//           const phone = lead.phone?.trim() || 'N/A';
//           const now = new Date().toISOString();

//           txn.executeSql(
//             `INSERT OR REPLACE INTO leads 
//               (id, name, phone, status, status_time, assignee, source)
//              VALUES (?, ?, ?, ?, ?, ?, ?)`,
//             [
//               lead.lead_id,
//               lead.name || 'Unknown',
//               phone,
//               lead.status || '-',
//               now,
//               lead.assignee || '-',
//               mapLeadSource(lead.lead_source),
//             ]
//           );
//         }
//       });

//       hasMore = data.hasMore || false;
//       offset += limit;
//     }

//     console.log('Leads synced successfully!');
//   } catch (err) {
//     console.error('Error in fetchAndStoreLeads:', err);
//   }
// };


// import { getLoggedInUser } from '../db/database';
// import { insertLead } from '../db/database';

// type LeadAPI = {
//   lead_id: number;
//   name: string;
//   phone?: string;
//   status?: string;
//   assignee?: string;
//   lead_source?: string;
// };

// // Map API source to local code
// const mapLeadSource = (source?: string): 'fb' | 'jd' | 'web' => {
//   if (!source) return 'web';
//   source = source.toLowerCase();
//   if (source.includes('facebook')) return 'fb';
//   if (source.includes('dealer') || source.includes('jd')) return 'jd';
//   return 'web';
// };

// /**
//  * Fetch leads from API and save to local DB
//  */
// export const fetchAndStoreLeads = async (): Promise<void> => {
//   try {
//     const user = await getLoggedInUser();
//     if (!user?.entity_id) return;

//     let offset = 0;
//     const limit = 500;
//     let hasMore = true;

//     while (hasMore) {
//       const url = `https://server103.multi-techno.com:8383/ords/ard_holdings/crm_app/get_leads_data?entity_id=${user.entity_id}&offset=${offset}&limit=${limit}`;
//       const response = await fetch(url);

//       if (!response.ok) throw new Error('Failed to fetch leads');

//       const data = await response.json();
//       const items: LeadAPI[] = data.items || [];

//       for (const lead of items) {
//         await insertLead(
//           lead.lead_id,
//           lead.name || 'Unknown',
//           lead.phone?.trim() || 'N/A',
//           lead.status || '-',
//           lead.assignee || '-',
//           mapLeadSource(lead.lead_source)
//         );
//       }

//       hasMore = data.hasMore || false;
//       offset += limit;
//     }
//   } catch (err) {
//     console.error('Error in fetchAndStoreLeads:', err);
//   }
// };