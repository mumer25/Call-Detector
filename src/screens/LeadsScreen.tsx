import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
} from "react-native";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import {
  initDB,
  getLeads,
  searchLeads,
  insertLead,
  getLoggedInUser,
} from "../db/database";

// ---------------- TYPES ----------------
export type Lead = {
  id: number;
  name: string;
  phone: string;
  status: string;
  assignee: string;
  source: string;
  city?: string;
};

type Props = {
  onSelectLead: (phone: string) => void;
  onOpenReport?: () => void;
  onOpenHistory?: () => void;
};

// ---------------- COMPONENT ----------------
export default function LeadsScreen({ onSelectLead }: Props) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [hasLocalLeads, setHasLocalLeads] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // ---------------- MAP SOURCE ----------------
  const mapLeadSource = useCallback((source: string): "fb" | "jd" | "web" => {
    if (!source) return "web";
    source = source.toLowerCase();
    if (source.includes("facebook")) return "fb";
    if (source.includes("dealer") || source.includes("jd")) return "jd";
    return "web";
  }, []);

  // ---------------- FETCH API & STORE ----------------
  const fetchAndUpdateLeads = useCallback(async () => {
    try {
      setSyncing(true);
      const user = await getLoggedInUser();
      if (!user?.entity_id) return;

      let offset = 0;
      const limit = 25;
      let hasMore = true;

      while (hasMore) {
        const url = `https://server103.multi-techno.com:8383/ords/ard_holdings/crm_app/get_leads_data?entity_id=${user.entity_id}&offset=${offset}&limit=${limit}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch leads");

        const data = await response.json();
        const items = data.items || [];

        for (const lead of items) {
          await insertLead(
            lead.lead_id,
            lead.name || "Unknown",
            lead.phone?.trim() || "N/A",
            lead.last_task_name || "-",
            lead.assignee || "-",
            mapLeadSource(lead.lead_source)
          );
        }

        hasMore = data.hasMore || false;
        offset += limit;
      }

      // Reload from DB and update state
      const updatedLeads = await getLeads();
      setLeads(updatedLeads);
      setHasLocalLeads(updatedLeads.length > 0);
    } catch (err) {
      console.error("Error syncing leads:", err);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, [mapLeadSource]);

  // ---------------- LOAD FROM DB ----------------
  const loadLeadsFromDB = useCallback(async () => {
    try {
      const savedLeads = await getLeads();
      setLeads(savedLeads);
      setHasLocalLeads(savedLeads.length > 0);
    } catch (err) {
      console.error("Error loading leads from DB:", err);
    }
  }, []);

  // ---------------- REFRESH FUNCTION ----------------
  const refreshLeads = useCallback(async () => {
    setRefreshing(true);
    await loadLeadsFromDB(); // load latest from DB
    setRefreshing(false);
  }, [loadLeadsFromDB]);

  // ---------------- INITIAL LOAD ----------------
  useEffect(() => {
    (async () => {
      await initDB();

      // Load DB leads first
      await loadLeadsFromDB();

      // Show loader only if no local leads
      if (!hasLocalLeads) setLoading(true);

      // Fetch latest leads in background
      await fetchAndUpdateLeads();
    })();
  }, [loadLeadsFromDB, fetchAndUpdateLeads, hasLocalLeads]);

  // ---------------- AUTO REFRESH ON SCREEN OPEN ----------------
  useEffect(() => {
    refreshLeads();
  }, [refreshLeads]);

  // ---------------- INTERVAL REFRESH ----------------
  useEffect(() => {
  const timeout = setTimeout(() => {
    refreshLeads(); // runs once after 10 sec
  }, 5000); // 10000ms = 10 seconds

  // Cleanup in case the screen unmounts before 10 sec
  return () => clearTimeout(timeout);
}, [refreshLeads]);

  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     refreshLeads();
  //   }, 20000); // refresh every 30 seconds

  //   return () => clearInterval(interval);
  // }, [refreshLeads]);

  // ---------------- SEARCH HANDLER ----------------
  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (text.trim() === "") {
      await loadLeadsFromDB();
    } else {
      const results = await searchLeads(text);
      setLeads(results);
    }
  };

  // ---------------- RENDER ICONS & BADGES ----------------
  const renderSourceIcon = (source: Lead["source"]) => {
    switch (source) {
      case "fb":
        return <FontAwesome name="facebook" size={14} color="#1877F2" />;
      case "jd":
        return <MaterialIcons name="work" size={14} color="#2C3E50" />;
      case "web":
        return <MaterialIcons name="public" size={14} color="#27AE60" />;
      default:
        return <MaterialIcons name="help-outline" size={14} color="#7f8c8d" />;
    }
  };

  const renderStatusBadge = (status: Lead["status"]) => {
    let bgColor = "#ecf0f1";
    let textColor = "#7f8c8d";

    switch (status) {
      case "New Lead":
        bgColor = "#1abc9c33";
        textColor = "#1abc9c";
        break;
       case "OLD Lead":
        bgColor = "#e74c3c33";
        textColor = "#e74c3c";
        break;
      case "Not Interested":
        bgColor = "#e74c3c33";
        textColor = "#e74c3c";
        break;
      case "Interested":
        bgColor = "#2ecc7133";
        textColor = "#2ecc71";
        break;
      case "Follow Up":
        bgColor = "#f1c40f33";
        textColor = "#f1c40f";
        break;
      default:
        bgColor = "#1abc9c33";
        textColor = "#1abc9c";
    }

    return (
      <View style={[styles.statusBadge, { backgroundColor: bgColor }]}>
        <Text style={[styles.statusText, { color: textColor }]} numberOfLines={1} ellipsizeMode="tail">
          {status}
        </Text>
      </View>
    );
  };

  // ---------------- RENDER ----------------
  return (
    <View style={styles.container}>
      {/* SEARCH BAR */}
   <View style={styles.searchWrapper}>
  <TextInput
    placeholder="Search by name or phone..."
    placeholderTextColor="#7f8c8d"
    style={styles.searchBar}
    value={searchQuery}
    onChangeText={handleSearch}
  />

  {/* ICONS */}
  {searchQuery.trim().length === 0 ? (
    // Show search icon only when search is empty
    <MaterialIcons name="search" size={22} color="#7f8c8d" style={styles.searchIcon} />
  ) : (
    // Show cross icon only when there is text
    <TouchableOpacity
      style={styles.clearIcon}
      onPress={() => handleSearch("")} // reset search
    >
      <MaterialIcons name="close" size={20} color="#7f8c8d" />
    </TouchableOpacity>
  )}
</View>


      {loading && !hasLocalLeads ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1abc9c" />
          <Text style={styles.syncingText}>Loading leads...</Text>
        </View>
      ) : (
        <>
          {syncing && (
            <View style={styles.syncingOverlay}>
              {/* optional syncing indicator */}
            </View>
          )}
          <FlatList
            data={leads}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.card} onPress={() => onSelectLead(item.phone)}>
                <View style={styles.left}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">{item.name}</Text>
                    <View style={styles.separatorLine} />
                    {renderSourceIcon(item.source)}
                  </View>
                  <Text style={styles.phone}>{item.phone || "N/A"}</Text>
                  {item.city ? <Text style={styles.city}>{item.city}</Text> : null}
                </View>
                <View style={styles.center}>{renderStatusBadge(item.status)}</View>
                <View style={styles.right}>
                  <View style={styles.avatar}>
                    <MaterialIcons name="person" size={24} color="#fff" />
                  </View>
                  <Text style={styles.assignee}>{item.assignee || "-"}</Text>
                </View>
              </TouchableOpacity>
            )}
            refreshing={refreshing}
            onRefresh={refreshLeads}
          />
        </>
      )}
    </View>
  );
}

// ---------------- STYLES ----------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#eef5f4" },
  searchWrapper: { position: "relative", marginHorizontal: 12, marginVertical: 10 },
  searchBar: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: "#2c3e50",
    paddingRight: 40,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: { position: "absolute", right: 18, top: 10 },
  clearIcon: {
  position: "absolute",
  right: 18, // adjust so it doesn't overlap search icon
  top: 10,
},
  list: { paddingHorizontal: 12, paddingBottom: 32 },
  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    alignItems: "center",
  },
  left: { flex: 3 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "nowrap" },
  separatorLine: { width: 1, height: 18, backgroundColor: "#7f8c8d", alignSelf: "center" },
  name: { fontSize: 16, fontWeight: "700", color: "#2c3e50", width: 96 },
  phone: { fontSize: 14, color: "#7f8c8d", marginTop: 4 },
  center: { flex: 1, alignItems: "center" },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16, alignSelf: "center", minWidth: 80, maxWidth: 120, marginRight: 26, alignItems: "center", justifyContent: "center" },
  statusText: { fontSize: 12, fontWeight: "700", textAlign: "center", flexShrink: 1 },
  right: { flex: 1, alignItems: "center" },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#1abc9c", justifyContent: "center", alignItems: "center", marginBottom: 4 },
  assignee: { fontSize: 12, color: "#34495e" },
  city: { fontSize: 12, color: "#7f8c8d", marginTop: 2 },
  syncingOverlay: { position: "absolute", top: 60, left: 0, right: 0, alignItems: "center", zIndex: 10 },
  syncingText: { color: "#1abc9c", marginTop: 10, fontSize: 12, fontWeight: "500" },
});



// import React, { useEffect, useState, useCallback } from "react";
// import {
//   View,
//   Text,
//   FlatList,
//   TouchableOpacity,
//   StyleSheet,
//   TextInput,
//   ActivityIndicator,
// } from "react-native";
// import MaterialIcons from "react-native-vector-icons/MaterialIcons";
// import FontAwesome from "react-native-vector-icons/FontAwesome";
// import {
//   initDB,
//   getLeads,
//   searchLeads,
//   insertLead,
//   getLoggedInUser,
// } from "../db/database";

// // ---------------- TYPES ----------------
// export type Lead = {
//   id: number;
//   name: string;
//   phone: string;
//   status: string;
//   assignee: string;
//   source: string;
//   city?: string;
// };

// type Props = {
//   onSelectLead: (phone: string) => void;
//   onOpenReport?: () => void;
//   onOpenHistory?: () => void;
// };

// // ---------------- COMPONENT ----------------
// export default function LeadsScreen({ onSelectLead }: Props) {
//   const [leads, setLeads] = useState<Lead[]>([]);
//   const [searchQuery, setSearchQuery] = useState<string>("");
//   const [loading, setLoading] = useState<boolean>(true);
//   const [syncing, setSyncing] = useState<boolean>(false);
//   const [hasLocalLeads, setHasLocalLeads] = useState<boolean>(false);
//   const [refreshing, setRefreshing] = useState<boolean>(false);


//   // ---------------- MAP SOURCE ----------------
//   const mapLeadSource = useCallback((source: string): "fb" | "jd" | "web" => {
//     if (!source) return "web";
//     source = source.toLowerCase();
//     if (source.includes("facebook")) return "fb";
//     if (source.includes("dealer") || source.includes("jd")) return "jd";
//     return "web";
//   }, []);

//   // ---------------- FETCH API & STORE ----------------
// const fetchAndUpdateLeads = useCallback(async () => {
//   try {
//     setSyncing(true);
//     const user = await getLoggedInUser();
//     if (!user?.entity_id) return;

//     let offset = 0;
//     const limit = 25;
//     let hasMore = true;

//     while (hasMore) {
//       const url = `https://server103.multi-techno.com:8383/ords/ard_holdings/crm_app/get_leads_data?entity_id=${user.entity_id}&offset=${offset}&limit=${limit}`;
//       const response = await fetch(url);
//       if (!response.ok) throw new Error("Failed to fetch leads");

//       const data = await response.json();
//       const items = data.items || [];

//       for (const lead of items) {
//         await insertLead(
//           lead.lead_id,
//           lead.name || "Unknown",
//           lead.phone?.trim() || "N/A",
//           lead.last_task_name || "-",
//           lead.assignee || "-",
//           mapLeadSource(lead.lead_source)
//         );
//       }

//       hasMore = data.hasMore || false;
//       offset += limit;
//     }

//     // Reload from DB and update state
//     const updatedLeads = await getLeads();
//     setLeads(updatedLeads);
//     setHasLocalLeads(updatedLeads.length > 0); // DB now has leads
//   } catch (err) {
//     console.error("Error syncing leads:", err);
//   } finally {
//     setLoading(false); // stop initial loader
//     setSyncing(false);
//   }
// }, [mapLeadSource]);


//   // ---------------- LOAD FROM DB ----------------
// const loadLeadsFromDB = useCallback(async () => {
//   try {
//     const savedLeads = await getLeads();
//     setLeads(savedLeads);
//     setHasLocalLeads(savedLeads.length > 0); // true if DB has leads
//   } catch (err) {
//     console.error("Error loading leads from DB:", err);
//   }
// }, []);


// const refreshLeads = useCallback(async () => {
//   setRefreshing(true);
//   await loadLeadsFromDB(); // load latest from DB
//   setRefreshing(false);
// }, [loadLeadsFromDB]);


// useEffect(() => {
//   const interval = setInterval(() => {
//     refreshLeads();
//   }, 30000); // refresh every 30 seconds

//   return () => clearInterval(interval); // cleanup
// }, [refreshLeads]);


//   // ---------------- INITIAL LOAD ----------------
//   useEffect(() => {
//   (async () => {
//     await initDB();

//     // Load from DB first
//     await loadLeadsFromDB();

//     // Show loader only if no local leads
//     if (!hasLocalLeads) setLoading(true);

//     // Fetch new leads in background
//     await fetchAndUpdateLeads();
//   })();
// }, [loadLeadsFromDB, fetchAndUpdateLeads, hasLocalLeads]);


//   // ---------------- SEARCH HANDLER ----------------
//   const handleSearch = async (text: string) => {
//     setSearchQuery(text);
//     if (text.trim() === "") {
//       await loadLeadsFromDB();
//     } else {
//       const results = await searchLeads(text);
//       setLeads(results);
//     }
//   };

//   // ---------------- RENDER ICONS & BADGES ----------------
//   const renderSourceIcon = (source: Lead["source"]) => {
//     switch (source) {
//       case "fb":
//         return <FontAwesome name="facebook" size={14} color="#1877F2" />;
//       case "jd":
//         return <MaterialIcons name="work" size={14} color="#2C3E50" />;
//       case "web":
//         return <MaterialIcons name="public" size={14} color="#27AE60" />;
//       default:
//         return <MaterialIcons name="help-outline" size={14} color="#7f8c8d" />;
//     }
//   };

//   const renderStatusBadge = (status: Lead["status"]) => {
//     let bgColor = "#ecf0f1";
//     let textColor = "#7f8c8d";

//     switch (status) {
//       case "New Lead":
//         bgColor = "#1abc9c33";
//         textColor = "#1abc9c";
//         break;
//       case "OLD Lead":
//         bgColor = "#e74c3c33";
//         textColor = "#e74c3c";
//         break;
//       case "Not Interested":
//         bgColor = "#e74c3c33";
//         textColor = "#e74c3c";
//         break;
//       case "Interested":
//         bgColor = "#2ecc7133";
//         textColor = "#2ecc71";
//         break;
//       case "Follow Up":
//         bgColor = "#f1c40f33";
//         textColor = "#f1c40f";
//         break;
//       default:
//         bgColor = "#1abc9c33";
//         textColor = "#1abc9c";
//     }

//     return (
//       <View style={[styles.statusBadge, { backgroundColor: bgColor }]}>
//         <Text style={[styles.statusText, { color: textColor }]} numberOfLines={1} ellipsizeMode="tail">
//           {status}
//         </Text>
//       </View>
//     );
//   };

//   // ---------------- RENDER ----------------
//   return (
//     <View style={styles.container}>
//       {/* SEARCH BAR */}
//       <View style={styles.searchWrapper}>
//         <TextInput
//           placeholder="Search by name or phone..."
//           placeholderTextColor="#7f8c8d"
//           style={styles.searchBar}
//           value={searchQuery}
//           onChangeText={handleSearch}
//         />
//         <MaterialIcons name="search" size={22} color="#7f8c8d" style={styles.searchIcon} />
//       </View>

//       {loading && !hasLocalLeads ? (
//         <View style={styles.loadingContainer}>
//           <ActivityIndicator size="large" color="#1abc9c" />
//           <Text style={styles.syncingText}>Loading leads...</Text>
//         </View>
//       ) : (
//         <>
//           {syncing && (
//             <View style={styles.syncingOverlay}>
//               {/* <ActivityIndicator size="small" color="#1abc9c" />
//               <Text style={styles.syncingText}>Loading leads...</Text> */}
//             </View>
//           )}
//           <FlatList
//             data={leads}
//             keyExtractor={(item) => item.id.toString()}
//             contentContainerStyle={styles.list}
//             renderItem={({ item }) => (
//               <TouchableOpacity style={styles.card} onPress={() => onSelectLead(item.phone)}>
//                 <View style={styles.left}>
//                   <View style={styles.nameRow}>
//                     <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">{item.name}</Text>
//                     <View style={styles.separatorLine} />
//                     {renderSourceIcon(item.source)}
//                   </View>
//                   <Text style={styles.phone}>{item.phone || "N/A"}</Text>
//                   {item.city ? <Text style={styles.city}>{item.city}</Text> : null}
//                 </View>
//                 <View style={styles.center}>{renderStatusBadge(item.status)}</View>
//                 <View style={styles.right}>
//                   <View style={styles.avatar}>
//                     <MaterialIcons name="person" size={24} color="#fff" />
//                   </View>
//                   <Text style={styles.assignee}>{item.assignee || "-"}</Text>
//                 </View>
//               </TouchableOpacity>
//             )}
//              refreshing={refreshing}
//              onRefresh={refreshLeads} 
//           />
//         </>
//       )}
//     </View>
//   );
// }

// // ---------------- STYLES ----------------
// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: "#eef5f4" },
//   searchWrapper: { position: "relative", marginHorizontal: 12, marginVertical: 10 },
//   searchBar: {
//     backgroundColor: "#fff",
//     borderRadius: 12,
//     paddingHorizontal: 16,
//     paddingVertical: 10,
//     fontSize: 14,
//     color: "#2c3e50",
//     paddingRight: 40,
//     shadowColor: "#000",
//     shadowOpacity: 0.05,
//     shadowOffset: { width: 0, height: 2 },
//     shadowRadius: 4,
//     elevation: 2,
//   },
//   searchIcon: { position: "absolute", right: 18, top: 10 },
//   list: { paddingHorizontal: 12, paddingBottom: 32 },
//   card: {
//     flexDirection: "row",
//     backgroundColor: "#fff",
//     paddingHorizontal: 16,
//     paddingVertical: 6,
//     borderRadius: 16,
//     marginBottom: 8,
//     shadowColor: "#000",
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.08,
//     shadowRadius: 6,
//     elevation: 3,
//     alignItems: "center",
//   },
//   left: { flex: 3 },
//   loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
//   nameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "nowrap" },
//   separatorLine: { width: 1, height: 18, backgroundColor: "#7f8c8d", alignSelf: "center" },
//   name: { fontSize: 16, fontWeight: "700", color: "#2c3e50", width: 96 },
//   phone: { fontSize: 14, color: "#7f8c8d", marginTop: 4 },
//   center: { flex: 1, alignItems: "center" },
//   statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16, alignSelf: "center", minWidth: 80, maxWidth: 120, marginRight: 26, alignItems: "center", justifyContent: "center" },
//   statusText: { fontSize: 12, fontWeight: "700", textAlign: "center", flexShrink: 1 },
//   right: { flex: 1, alignItems: "center" },
//   avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#1abc9c", justifyContent: "center", alignItems: "center", marginBottom: 4 },
//   assignee: { fontSize: 12, color: "#34495e" },
//   city: { fontSize: 12, color: "#7f8c8d", marginTop: 2 },
//   syncingOverlay: {
//     position: "absolute",
//     top: 60,
//     left: 0,
//     right: 0,
//     alignItems: "center",
//     zIndex: 10,
//   },
//   syncingText: {
//   color: "#1abc9c",
//   marginTop: 10,
//   fontSize: 12,
//   fontWeight: "500",
// },

// });




// import React, { useEffect, useState, useCallback } from "react";
// import {
//   View,
//   Text,
//   FlatList,
//   TouchableOpacity,
//   StyleSheet,
//   TextInput,
//   ActivityIndicator,
// } from "react-native";
// import MaterialIcons from "react-native-vector-icons/MaterialIcons";
// import FontAwesome from "react-native-vector-icons/FontAwesome";
// import {
//   initDB,
//   getLeads,
//   searchLeads,
//   insertLead,
//   getLoggedInUser,
// } from "../db/database";

// // ---------------- TYPES ----------------
// export type Lead = {
//   id: number;
//   name: string;
//   phone: string;
//   status: string;
//   assignee: string;
//   source: string;
//   city?: string;
// };

// type Props = {
//   onSelectLead: (phone: string) => void;
//   onOpenReport?: () => void;
//   onOpenHistory?: () => void;
// };

// // ---------------- COMPONENT ----------------
// export default function LeadsScreen({ onSelectLead }: Props) {
//   const [leads, setLeads] = useState<Lead[]>([]);
//   const [searchQuery, setSearchQuery] = useState<string>("");
//   const [loading, setLoading] = useState<boolean>(true);

//   // ---------------- MAP SOURCE ----------------
//   const mapLeadSource = useCallback((source: string): "fb" | "jd" | "web" => {
//     if (!source) return "web";
//     source = source.toLowerCase();
//     if (source.includes("facebook")) return "fb";
//     if (source.includes("dealer") || source.includes("jd")) return "jd";
//     return "web";
//   }, []);

//   // ---------------- FETCH API & STORE ----------------
//   const fetchAndStoreLeads = useCallback(async () => {
//     try {
//       const user = await getLoggedInUser();
//       if (!user?.entity_id) return;

//       let offset = 0;
//       const limit = 25;
//       let hasMore = true;

//       while (hasMore) {
//         const url = `https://server103.multi-techno.com:8383/ords/ard_holdings/crm_app/get_leads_data?entity_id=${user.entity_id}&offset=${offset}&limit=${limit}`;
//         const response = await fetch(url);
//         if (!response.ok) throw new Error("Failed to fetch leads");

//         const data = await response.json();
//         const items = data.items || [];

//         for (const lead of items) {
//           await insertLead(
//             lead.lead_id,               // API lead_id
//             lead.name || "Unknown",
//             lead.phone?.trim() || "N/A",
//             lead.status || "NEW",
//             lead.last_task_name || "-",
//             mapLeadSource(lead.lead_source)
//           );
//         }

//         hasMore = data.hasMore || false;
//         offset += limit;
//       }
//     } catch (err) {
//       console.error("Error fetching API leads:", err);
//     }
//   }, [mapLeadSource]);

//   // ---------------- LOAD LEADS ----------------
//   const loadLeads = useCallback(async () => {
//     setLoading(true);
//     try {
//       await fetchAndStoreLeads();
//       const savedLeads = await getLeads();
//       setLeads(savedLeads);
//     } catch (error) {
//       console.error("Error loading leads:", error);
//     } finally {
//       setLoading(false);
//     }
//   }, [fetchAndStoreLeads]);

//   useEffect(() => {
//     (async () => {
//       await initDB();
//       await loadLeads();
//     })();
//   }, [loadLeads]);

//   // ---------------- SEARCH HANDLER ----------------
//   const handleSearch = async (text: string) => {
//     setSearchQuery(text);
//     if (text.trim() === "") {
//       await loadLeads();
//     } else {
//       const results = await searchLeads(text);
//       setLeads(results);
//     }
//   };

//   // ---------------- RENDER ICONS & BADGES ----------------
//   const renderSourceIcon = (source: Lead["source"]) => {
//     switch (source) {
//       case "fb":
//         return <FontAwesome name="facebook" size={14} color="#1877F2" />;
//       case "jd":
//         return <MaterialIcons name="work" size={14} color="#2C3E50" />;
//       case "web":
//         return <MaterialIcons name="public" size={14} color="#27AE60" />;
//       default:
//         return <MaterialIcons name="help-outline" size={14} color="#7f8c8d" />;
//     }
//   };

//   const renderStatusBadge = (status: Lead["status"]) => {
//     let bgColor = "#ecf0f1";
//     let textColor = "#7f8c8d";

//     switch (status) {
//       case "NEW": bgColor = "#1abc9c33"; textColor = "#1abc9c"; break;
//       case "OLD": bgColor = "#e74c3c33"; textColor = "#e74c3c"; break;
//       case "Not Interested": bgColor = "#e74c3c33"; textColor = "#e74c3c"; break;
//       case "Interested": bgColor = "#2ecc7133"; textColor = "#2ecc71"; break;
//       case "Follow Up": bgColor = "#f1c40f33"; textColor = "#f1c40f"; break;
//       default: bgColor = "#bdc3c733"; textColor = "#7f8c8d";
//     }

//     return (
//       <View style={[styles.statusBadge, { backgroundColor: bgColor }]}>
//         <Text style={[styles.statusText, { color: textColor }]} numberOfLines={1} ellipsizeMode="tail">
//           {status}
//         </Text>
//       </View>
//     );
//   };

//   // ---------------- RENDER ----------------
//   return (
//     <View style={styles.container}>
//       {/* SEARCH BAR */}
//       <View style={styles.searchWrapper}>
//         <TextInput
//           placeholder="Search by name or phone..."
//           placeholderTextColor="#7f8c8d"
//           style={styles.searchBar}
//           value={searchQuery}
//           onChangeText={handleSearch}
//         />
//         <MaterialIcons name="search" size={22} color="#7f8c8d" style={styles.searchIcon} />
//       </View>

//       {loading ? (
//         <View style={styles.loadingContainer}>
//           <ActivityIndicator size="large" color="#1abc9c" />
//         </View>
//       ) : (
//         <FlatList
//           data={leads}
//           keyExtractor={(item) => item.id.toString()}
//           contentContainerStyle={styles.list}
//           renderItem={({ item }) => (
//             <TouchableOpacity style={styles.card} onPress={() => onSelectLead(item.phone)}>
//               <View style={styles.left}>
//                 <View style={styles.nameRow}>
//                   <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">{item.name}</Text>
//                   <View style={styles.separatorLine} />
//                   {renderSourceIcon(item.source)}
//                 </View>
//                 <Text style={styles.phone}>{item.phone || "N/A"}</Text>
//                 {item.city ? <Text style={styles.city}>{item.city}</Text> : null}
//               </View>
//               <View style={styles.center}>{renderStatusBadge(item.status)}</View>
//               <View style={styles.right}>
//                 <View style={styles.avatar}>
//                   <MaterialIcons name="person" size={24} color="#fff" />
//                 </View>
//                 <Text style={styles.assignee}>{item.assignee || "-"}</Text>
//               </View>
//             </TouchableOpacity>
//           )}
//         />
//       )}
//     </View>
//   );
// }

// // ---------------- STYLES ----------------
// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: "#eef5f4" },
//   searchWrapper: { position: "relative", marginHorizontal: 12, marginVertical: 10 },
//   searchBar: {
//     backgroundColor: "#fff",
//     borderRadius: 12,
//     paddingHorizontal: 16,
//     paddingVertical: 10,
//     fontSize: 14,
//     color: "#2c3e50",
//     paddingRight: 40,
//     shadowColor: "#000",
//     shadowOpacity: 0.05,
//     shadowOffset: { width: 0, height: 2 },
//     shadowRadius: 4,
//     elevation: 2,
//   },
//   searchIcon: { position: "absolute", right: 18, top: 10 },
//   list: { paddingHorizontal: 12, paddingBottom: 32 },
//   card: {
//     flexDirection: "row",
//     backgroundColor: "#fff",
//     paddingHorizontal: 16,
//     paddingVertical: 6,
//     borderRadius: 16,
//     marginBottom: 8,
//     shadowColor: "#000",
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.08,
//     shadowRadius: 6,
//     elevation: 3,
//     alignItems: "center",
//   },
//   left: { flex: 3 },
//   loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
//   nameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "nowrap" },
//   separatorLine: { width: 1, height: 18, backgroundColor: "#7f8c8d", alignSelf: "center" },
//   name: { fontSize: 16, fontWeight: "700", color: "#2c3e50", width: 96 },
//   phone: { fontSize: 14, color: "#7f8c8d", marginTop: 4 },
//   center: { flex: 1, alignItems: "center" },
//   statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16, alignSelf: "center", minWidth: 80, maxWidth: 120, marginRight: 26, alignItems: "center", justifyContent: "center" },
//   statusText: { fontSize: 12, fontWeight: "700", textAlign: "center", flexShrink: 1 },
//   right: { flex: 1, alignItems: "center" },
//   avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#1abc9c", justifyContent: "center", alignItems: "center", marginBottom: 4 },
//   assignee: { fontSize: 12, color: "#34495e" },
//   city: { fontSize: 12, color: "#7f8c8d", marginTop: 2 },
// });




// import React, { useEffect, useState } from "react";
// import {
//   View,
//   Text,
//   FlatList,
//   TouchableOpacity,
//   StyleSheet,
//   TextInput,
// } from "react-native";
// import MaterialIcons from "react-native-vector-icons/MaterialIcons";
// import FontAwesome from "react-native-vector-icons/FontAwesome";
// import { initDB, getLeads, insertLead, searchLeads } from "../db/database"; // SQLite helper functions

// export type Lead = {
//   id: number;
//   name: string;
//   phone: string;
//   status: "NEW" | "OLD" | "Interested" | "Not Interested" | "Follow Up";
//   assignee: string;
//   source: "fb" | "jd" | "web";
// };

// type Props = {
//   onSelectLead: (phone: string) => void;
//   onOpenReport?: () => void;   // optional if you want
//   onOpenHistory?: () => void;  // optional if you want
// };


// export default function LeadsScreen({ onSelectLead }: Props) {
//   const [leads, setLeads] = useState<Lead[]>([]);
//   const [searchQuery, setSearchQuery] = useState<string>("");

//   useEffect(() => {
//     (async () => {
//       await initDB();
//       await loadLeads();
//     })();
//   }, []);

//   const loadLeads = async () => {
//     try {
//       let savedLeads = await getLeads();
//       if (savedLeads.length === 0) {
//         // Insert dummy leads if DB is empty
//         const dummy: Lead[] = [
//           { id: 0, name: "Ali", phone: "03001234567", status: "NEW", assignee: "Umer", source: "fb" },
//           { id: 0, name: "Umer", phone: "03229199459", status: "NEW", assignee: "Umer", source: "web" },
//           { id: 0, name: "Noman", phone: "03003334444", status: "NEW", assignee: "Ali", source: "fb" },
//           { id: 0, name: "Ahmad", phone: "03005556666", status: "OLD", assignee: "Ali", source: "fb" },
//         ];
//         for (const lead of dummy) {
//           await insertLead(lead.name, lead.phone, lead.status, lead.assignee, lead.source);
//         }
//         savedLeads = await getLeads();
//       }
//       setLeads(savedLeads);
//     } catch (error) {
//       console.error("Error loading leads from DB:", error);
//     }
//   };

//   const handleSearch = async (text: string) => {
//     setSearchQuery(text);
//     if (text.trim() === "") {
//       await loadLeads();
//     } else {
//       const results = await searchLeads(text);
//       setLeads(results);
//     }
//   };

//   const renderSourceIcon = (source: Lead["source"]) => {
//     switch (source) {
//       case "fb":
//         return <FontAwesome name="facebook" size={14} color="#1877F2" />;
//       case "jd":
//         return <MaterialIcons name="work" size={14} color="#2C3E50" />;
//       case "web":
//         return <MaterialIcons name="public" size={14} color="#27AE60" />;
//       default:
//         return <MaterialIcons name="help-outline" size={14} color="#7f8c8d" />;
//     }
//   };

//   const renderStatusBadge = (status: Lead["status"]) => {
//     let bgColor = "#ecf0f1";
//     let textColor = "#7f8c8d";

//     switch (status) {
//       case "NEW": bgColor = "#1abc9c33"; textColor = "#1abc9c"; break;
//       case "OLD": bgColor = "#e74c3c33"; textColor = "#e74c3c"; break;
//       case "Not Interested": bgColor = "#e74c3c33"; textColor = "#e74c3c"; break;
//       case "Interested": bgColor = "#2ecc7133"; textColor = "#2ecc71"; break;
//       case "Follow Up": bgColor = "#f1c40f33"; textColor = "#f1c40f"; break;
//       default: bgColor = "#bdc3c733"; textColor = "#7f8c8d";
//     }

//     return (
//       <View style={[styles.statusBadge, { backgroundColor: bgColor }]}>
//         <Text style={[styles.statusText, { color: textColor }]} numberOfLines={1} ellipsizeMode="tail">
//           {status}
//         </Text>
//       </View>
//     );
//   };

//   return (
//     <View style={styles.container}>
//       {/* SEARCH BAR */}
//       <View style={styles.searchWrapper}>
//         <TextInput
//           placeholder="Search by name or phone..."
//           placeholderTextColor="#7f8c8d"
//           style={styles.searchBar}
//           value={searchQuery}
//           onChangeText={handleSearch}
//         />
//         <MaterialIcons name="search" size={22} color="#7f8c8d" style={styles.searchIcon} />
//       </View>

//       {/* LIST */}
//       <FlatList
//         data={leads}
//         keyExtractor={(item) => item.id.toString()}
//         contentContainerStyle={styles.list}
//         renderItem={({ item }) => (
//           <TouchableOpacity
//             style={styles.card}
//             onPress={() => onSelectLead(item.phone)}
//           >
//             <View style={styles.left}>
//               <View style={styles.nameRow}>
//                 <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">{item.name}</Text>
//                 {/* <Text style={styles.separator}>|</Text> */}
//                  <View style={styles.separatorLine} />
//                 <Text style={styles.source}>{renderSourceIcon(item.source)}</Text>
//               </View>
//               <Text style={styles.phone}>{item.phone}</Text>
//             </View>
//             <View style={styles.center}>{renderStatusBadge(item.status)}</View>
//             <View style={styles.right}>
//               <View style={styles.avatar}>
//                 <MaterialIcons name="person" size={24} color="#fff" />
//               </View>
//               <Text style={styles.assignee}>{item.assignee}</Text>
//             </View>
//           </TouchableOpacity>
//         )}
//       />
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: "#eef5f4" },
//   searchWrapper: {
//     position: "relative",
//     marginHorizontal: 12,
//     marginVertical: 10,
//   },
//   searchBar: {
//     backgroundColor: "#fff",
//     borderRadius: 12,
//     paddingHorizontal: 16,
//     paddingVertical: 10,
//     fontSize: 14,
//     color: "#2c3e50",
//     paddingRight: 40,
//     shadowColor: "#000",
//     shadowOpacity: 0.05,
//     shadowOffset: { width: 0, height: 2 },
//     shadowRadius: 4,
//     elevation: 2,
//   },
//   searchIcon: {
//     position: "absolute",
//     right: 18,
//     top: 10,
//   },
//   list: { paddingHorizontal: 12, paddingBottom: 32 },
//   card: {
//     flexDirection: "row",
//     backgroundColor: "#fff",
//     paddingHorizontal: 16,
//     paddingVertical: 6,
//     borderRadius: 16,
//     marginBottom: 8,
//     shadowColor: "#000",
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.08,
//     shadowRadius: 6,
//     elevation: 3,
//     alignItems: "center",
//   },
//   left: { flex: 3 },
//   nameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "nowrap" },
//   separator: { fontSize: 14, color: "#7f8c8d", marginHorizontal: 4 },
//   separatorLine: {
//   width: 1,             // thin vertical line
//   height: 18,           // match text height
//   backgroundColor: "#7f8c8d",
//   alignSelf: "center",  // vertical align center
// },
//   name: { fontSize: 16, fontWeight: "700", color: "#2c3e50", width: 96, },
//   source: { fontSize: 14 },
//   phone: { fontSize: 14, color: "#7f8c8d", marginTop: 4 },
//   center: { flex: 1, alignItems: "center" },
//   statusBadge: {
//     paddingHorizontal: 12,
//     paddingVertical: 4,
//     borderRadius: 16,
//     alignSelf: "center",
//     minWidth: 80,
//     maxWidth: 120,
//     marginRight: 26,
//     alignItems: "center",
//     justifyContent: "center",
//   },
//   statusText: {
//     fontSize: 12,
//     fontWeight: "700",
//     textAlign: "center",
//     flexShrink: 1,
//   },
//   right: { flex: 1, alignItems: "center" },
//   avatar: {
//     width: 40,
//     height: 40,
//     borderRadius: 20,
//     backgroundColor: "#1abc9c",
//     justifyContent: "center",
//     alignItems: "center",
//     marginBottom: 4,
//   },
//   assignee: { fontSize: 12, color: "#34495e" },
// });



// 
// import React, { useEffect, useState } from "react";
// import {
//   View,
//   Text,
//   FlatList,
//   TouchableOpacity,
//   StyleSheet,
//   TextInput,
// } from "react-native";
// import AsyncStorage from "@react-native-async-storage/async-storage";
// import MaterialIcons from "react-native-vector-icons/MaterialIcons"; 
// import FontAwesome from "react-native-vector-icons/FontAwesome";

// export type Lead = {
//   id: string;
//   name: string;
//   phone: string;
//   status: "NEW" | "OLD" | "Interested" | "Not Interested" | "Follow Up";
//   assignee: string;
//   source: "fb" | "jd" | "web";
// };

// type Props = {
//   onSelectLead: (phone: string) => void;
//   onOpenHistory: () => void;
//   onOpenReport: () => void;
// };

// export default function LeadsScreen({ onSelectLead}: Props) {
//   const [leads, setLeads] = useState<Lead[]>([]);
//   const [searchQuery, setSearchQuery] = useState<string>("");

//   useEffect(() => {
//     loadLeads();
//   }, []);

//   const loadLeads = async () => {
//     const saved = await AsyncStorage.getItem("leads");
//     if (saved) {
//       setLeads(JSON.parse(saved));
//       return;
//     }

//     const dummy: Lead[] = [
//       { id: "1", name: "Ali", phone: "03001234567", status: "NEW", assignee: "Umer", source: "fb" },
//       { id: "2", name: "Umer", phone: "03229199459", status: "NEW", assignee: "Umer", source: "web" },
//       { id: "3", name: "Noman", phone: "03003334444", status: "NEW", assignee: "Ali", source: "fb" },
//       { id: "4", name: "Ahmad", phone: "03005556666", status: "OLD", assignee: "Ali", source: "fb" },
//       { id: "5", name: "Sara", phone: "03008889999", status: "NEW", assignee: "Umer", source: "web" },
//       { id: "6", name: "Hassan", phone: "03112223344", status: "OLD", assignee: "Ali", source: "jd" },
//       { id: "7", name: "Adeel", phone: "03221112233", status: "NEW", assignee: "Umer", source: "fb" },
//       { id: "8", name: "Bilal", phone: "03009998877", status: "OLD", assignee: "Ali", source: "web" },
//     ];

//     setLeads(dummy);
//     await AsyncStorage.setItem("leads", JSON.stringify(dummy));
//   };

//   const renderSourceIcon = (source: Lead["source"]) => {
//     switch (source) {
//       case "fb":
//         return <FontAwesome name="facebook" size={20} color="#1877F2" />;
//       case "jd":
//         return <MaterialIcons name="work" size={20} color="#2C3E50" />;
//       case "web":
//         return <MaterialIcons name="public" size={20} color="#27AE60" />;
//       default:
//         return <MaterialIcons name="help-outline" size={20} color="#7f8c8d" />;
//     }
//   };

//   const renderStatusBadge = (status: Lead["status"]) => {
//     let bgColor = "#ecf0f1";
//     let textColor = "#7f8c8d";

//     switch (status) {
//       case "NEW": bgColor = "#1abc9c33"; textColor = "#1abc9c"; break;
//       case "OLD": bgColor = "#e74c3c33"; textColor = "#e74c3c"; break;
//       case "Not Interested": bgColor = "#e74c3c33"; textColor = "#e74c3c"; break;
//       case "Interested": bgColor = "#2ecc7133"; textColor = "#2ecc71"; break;
//       case "Follow Up": bgColor = "#f1c40f33"; textColor = "#f1c40f"; break;
//       default: bgColor = "#bdc3c733"; textColor = "#7f8c8d";
//     }

//     return (
//       <View style={[styles.statusBadge, { backgroundColor: bgColor }]}>
//         <Text style={[styles.statusText, { color: textColor }]} numberOfLines={1} ellipsizeMode="tail">
//           {status}
//         </Text>
//       </View>
//     );
//   };

//   const filteredLeads = leads.filter(
//     (lead) =>
//       lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
//       lead.phone.includes(searchQuery)
//   );

//   return (
//     <View style={styles.container}>
//       {/* SEARCH BAR */}
//       <View style={styles.searchWrapper}>
//         <TextInput
//           placeholder="Search by name or phone..."
//           placeholderTextColor="#7f8c8d"
//           style={styles.searchBar}
//           value={searchQuery}
//           onChangeText={setSearchQuery}
//         />
//         <MaterialIcons name="search" size={22} color="#7f8c8d" style={styles.searchIcon} />
//       </View>

//       {/* LIST */}
//       <FlatList
//         data={filteredLeads}
//         keyExtractor={(item) => item.id}
//         contentContainerStyle={styles.list}
//         renderItem={({ item }) => (
//           <TouchableOpacity
//             style={styles.card}
//             onPress={() => onSelectLead(item.phone)}
//           >
//             <View style={styles.left}>
//               <View style={styles.nameRow}>
//                 <Text style={styles.name}>{item.name}</Text>
//                 <Text style={styles.separator}>|</Text>
//                 <Text style={styles.source}>{renderSourceIcon(item.source)}</Text>
//               </View>
//               <Text style={styles.phone}>{item.phone}</Text>
//             </View>
//             <View style={styles.center}>{renderStatusBadge(item.status)}</View>
//             <View style={styles.right}>
//               <View style={styles.avatar}>
//                 <MaterialIcons name="person" size={24} color="#fff" />
//               </View>
//               <Text style={styles.assignee}>{item.assignee}</Text>
//             </View>
//           </TouchableOpacity>
//         )}
//       />
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: "#eef5f4" },

//   header: {
//   backgroundColor: "#fff",
//   paddingHorizontal: 16,
//   paddingVertical: 10,
//   flexDirection: "row",
//   justifyContent: "space-between", // left-right spacing
//   alignItems: "center",
//   borderBottomWidth: 1,
//   borderColor: "#e6e6e6",
// },
// headerTitle: {
//   fontSize: 18,
//   fontWeight: "700",
//   color: "#2c3e50",
// },
// iconBtn: {
//   flexDirection: "row",
//   alignItems: "center",
//   gap: 10,
//   backgroundColor: "#e0f7f4",
//   paddingHorizontal: 12,
//   paddingVertical: 6,
//   borderRadius: 8,
//   width:"46%",
// },
// iconText: {
//   fontSize: 14,
//   fontWeight: "600",
//   color: "#1abc9c",
// },

//   searchWrapper: {
//     position: "relative",
//     marginHorizontal: 12,
//     marginVertical: 10,
//   },
//   searchBar: {
//     backgroundColor: "#fff",
//     borderRadius: 12,
//     paddingHorizontal: 16,
//     paddingVertical: 10,
//     fontSize: 14,
//     color: "#2c3e50",
//     paddingRight: 40,
//     shadowColor: "#000",
//     shadowOpacity: 0.05,
//     shadowOffset: { width: 0, height: 2 },
//     shadowRadius: 4,
//     elevation: 2,
//   },
//   searchIcon: {
//     position: "absolute",
//     right: 18,
//     top: 10,
//   },

//   list: { paddingHorizontal: 12, paddingBottom: 32 },

//   card: {
//     flexDirection: "row",
//     backgroundColor: "#fff",
//     paddingHorizontal: 16,
//     paddingVertical: 6,
//     borderRadius: 16,
//     marginBottom: 8,
//     shadowColor: "#000",
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.08,
//     shadowRadius: 6,
//     elevation: 3,
//     alignItems: "center",
//   },
//   left: { flex: 3 },
//   nameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "nowrap" },
//   separator: { fontSize: 14, color: "#7f8c8d", marginHorizontal: 4 },
//   name: { fontSize: 16, fontWeight: "700", color: "#2c3e50" },
//   source: { fontSize: 14 },
//   phone: { fontSize: 14, color: "#7f8c8d", marginTop: 4 },

//   center: { flex: 1, alignItems: "center" },
//   statusBadge: {
//     paddingHorizontal: 12,
//     paddingVertical: 4,
//     borderRadius: 16,
//     alignSelf: "center",
//     minWidth: 80,
//     maxWidth: 120,
//     marginRight: 26,
//     alignItems: "center",
//     justifyContent: "center",
//   },
//   statusText: {
//     fontSize: 12,
//     fontWeight: "700",
//     textAlign: "center",
//     flexShrink: 1,
//   },

//   right: { flex: 1, alignItems: "center" },
//   avatar: {
//     width: 40,
//     height: 40,
//     borderRadius: 20,
//     backgroundColor: "#1abc9c",
//     justifyContent: "center",
//     alignItems: "center",
//     marginBottom: 4,
//   },
//   assignee: { fontSize: 12, color: "#34495e" },
// });




// import React, { useEffect, useState } from "react";
// import {
//   View,
//   Text,
//   FlatList,
//   TouchableOpacity,
//   StyleSheet,
//   TextInput,
// } from "react-native";
// import MaterialIcons from "react-native-vector-icons/MaterialIcons"; 
// import FontAwesome from "react-native-vector-icons/FontAwesome";

// // Import your DB methods
// import { initDB, getLeads, insertLead } from "../db/database";

// export type Lead = {
//   id: string;
//   name: string;
//   phone: string;
//   status: "NEW" | "OLD" | "Interested" | "Not Interested" | "Follow Up";
//   assignee: string;
//   source: "fb" | "jd" | "web";
// };

// type Props = {
//   onSelectLead: (phone: string) => void;
//   onOpenHistory: () => void;
//   onOpenReport: () => void;
// };

// export default function LeadsScreen({ onSelectLead }: Props) {
//   const [leads, setLeads] = useState<Lead[]>([]);
//   const [searchQuery, setSearchQuery] = useState<string>("");

//   useEffect(() => {
//     const prepareDB = async () => {
//       try {
//         await initDB();          // Initialize tables
//         await loadLeads();       // Load leads from DB
//       } catch (err) {
//         console.error("DB init failed:", err);
//       }
//     };
//     prepareDB();
//   }, []);

//   // Load leads from SQLite
//   const loadLeads = async () => {
//     try {
//       const dbLeads = await getLeads();
//       if (dbLeads.length === 0) {
//         // Insert dummy leads if DB is empty
//         const dummy: Omit<Lead, "id">[] = [
//           { name: "Ali", phone: "03001234567", status: "NEW", assignee: "Umer", source: "fb" },
//           { name: "Umer", phone: "03229199459", status: "NEW", assignee: "Umer", source: "web" },
//           { name: "Noman", phone: "03003334444", status: "NEW", assignee: "Ali", source: "fb" },
//           { name: "Ahmad", phone: "03005556666", status: "OLD", assignee: "Ali", source: "fb" },
//           { name: "Sara", phone: "03008889999", status: "NEW", assignee: "Umer", source: "web" },
//           { name: "Hassan", phone: "03112223344", status: "OLD", assignee: "Ali", source: "jd" },
//           { name: "Adeel", phone: "03221112233", status: "NEW", assignee: "Umer", source: "fb" },
//           { name: "Bilal", phone: "03009998877", status: "OLD", assignee: "Ali", source: "web" },
//         ];

//         // Insert into DB
//         for (const lead of dummy) {
//           await insertLead(lead.name, lead.phone, lead.status, lead.assignee, lead.source);
//         }

//         const newLeads = await getLeads();
//         setLeads(newLeads);
//       } else {
//         setLeads(dbLeads);
//       }
//     } catch (err) {
//       console.error("Failed to load leads:", err);
//     }
//   };

//   const renderSourceIcon = (source: Lead["source"]) => {
//     switch (source) {
//       case "fb":
//         return <FontAwesome name="facebook" size={20} color="#1877F2" />;
//       case "jd":
//         return <MaterialIcons name="work" size={20} color="#2C3E50" />;
//       case "web":
//         return <MaterialIcons name="public" size={20} color="#27AE60" />;
//       default:
//         return <MaterialIcons name="help-outline" size={20} color="#7f8c8d" />;
//     }
//   };

//   const renderStatusBadge = (status: Lead["status"]) => {
//     let bgColor = "#ecf0f1";
//     let textColor = "#7f8c8d";

//     switch (status) {
//       case "NEW": bgColor = "#1abc9c33"; textColor = "#1abc9c"; break;
//       case "OLD": bgColor = "#e74c3c33"; textColor = "#e74c3c"; break;
//       case "Not Interested": bgColor = "#e74c3c33"; textColor = "#e74c3c"; break;
//       case "Interested": bgColor = "#2ecc7133"; textColor = "#2ecc71"; break;
//       case "Follow Up": bgColor = "#f1c40f33"; textColor = "#f1c40f"; break;
//       default: bgColor = "#bdc3c733"; textColor = "#7f8c8d";
//     }

//     return (
//       <View style={[styles.statusBadge, { backgroundColor: bgColor }]}>
//         <Text style={[styles.statusText, { color: textColor }]} numberOfLines={1} ellipsizeMode="tail">
//           {status}
//         </Text>
//       </View>
//     );
//   };

//   const filteredLeads = leads.filter(
//     (lead) =>
//       lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
//       lead.phone.includes(searchQuery)
//   );

//   return (
//     <View style={styles.container}>
//       <View style={styles.searchWrapper}>
//         <TextInput
//           placeholder="Search by name or phone..."
//           placeholderTextColor="#7f8c8d"
//           style={styles.searchBar}
//           value={searchQuery}
//           onChangeText={setSearchQuery}
//         />
//         <MaterialIcons name="search" size={22} color="#7f8c8d" style={styles.searchIcon} />
//       </View>

//       <FlatList
//         data={filteredLeads}
//         keyExtractor={(item) => item.id.toString()}
//         contentContainerStyle={styles.list}
//         renderItem={({ item }) => (
//           <TouchableOpacity style={styles.card} onPress={() => onSelectLead(item.phone)}>
//             <View style={styles.left}>
//               <View style={styles.nameRow}>
//                 <Text style={styles.name}>{item.name}</Text>
//                 <Text style={styles.separator}>|</Text>
//                 <Text style={styles.source}>{renderSourceIcon(item.source)}</Text>
//               </View>
//               <Text style={styles.phone}>{item.phone}</Text>
//             </View>
//             <View style={styles.center}>{renderStatusBadge(item.status)}</View>
//             <View style={styles.right}>
//               <View style={styles.avatar}>
//                 <MaterialIcons name="person" size={24} color="#fff" />
//               </View>
//               <Text style={styles.assignee}>{item.assignee}</Text>
//             </View>
//           </TouchableOpacity>
//         )}
//       />
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: "#eef5f4" },
//   searchWrapper: { position: "relative", marginHorizontal: 12, marginVertical: 10 },
//   searchBar: {
//     backgroundColor: "#fff",
//     borderRadius: 12,
//     paddingHorizontal: 16,
//     paddingVertical: 10,
//     fontSize: 14,
//     color: "#2c3e50",
//     paddingRight: 40,
//     shadowColor: "#000",
//     shadowOpacity: 0.05,
//     shadowOffset: { width: 0, height: 2 },
//     shadowRadius: 4,
//     elevation: 2,
//   },
//   searchIcon: { position: "absolute", right: 18, top: 10 },
//   list: { paddingHorizontal: 12, paddingBottom: 32 },
//   card: {
//     flexDirection: "row",
//     backgroundColor: "#fff",
//     paddingHorizontal: 16,
//     paddingVertical: 6,
//     borderRadius: 16,
//     marginBottom: 8,
//     shadowColor: "#000",
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.08,
//     shadowRadius: 6,
//     elevation: 3,
//     alignItems: "center",
//   },
//   left: { flex: 3 },
//   nameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "nowrap" },
//   separator: { fontSize: 14, color: "#7f8c8d", marginHorizontal: 4 },
//   name: { fontSize: 16, fontWeight: "700", color: "#2c3e50" },
//   source: { fontSize: 14 },
//   phone: { fontSize: 14, color: "#7f8c8d", marginTop: 4 },
//   center: { flex: 1, alignItems: "center" },
//   statusBadge: {
//     paddingHorizontal: 12,
//     paddingVertical: 4,
//     borderRadius: 16,
//     alignSelf: "center",
//     minWidth: 80,
//     maxWidth: 120,
//     marginRight: 26,
//     alignItems: "center",
//     justifyContent: "center",
//   },
//   statusText: { fontSize: 12, fontWeight: "700", textAlign: "center", flexShrink: 1 },
//   right: { flex: 1, alignItems: "center" },
//   avatar: {
//     width: 40,
//     height: 40,
//     borderRadius: 20,
//     backgroundColor: "#1abc9c",
//     justifyContent: "center",
//     alignItems: "center",
//     marginBottom: 4,
//   },
//   assignee: { fontSize: 12, color: "#34495e" },
// });





// import React, { useEffect, useState } from "react";
// import {
//   View,
//   Text,
//   FlatList,
//   TouchableOpacity,
//   StyleSheet,
//   TextInput,
// } from "react-native";
// import AsyncStorage from "@react-native-async-storage/async-storage";
// import MaterialIcons from "react-native-vector-icons/MaterialIcons"; 
// import FontAwesome from "react-native-vector-icons/FontAwesome";

// export type Lead = {
//   id: string;
//   name: string;
//   phone: string;
//   status: "NEW" | "OLD" | "Interested" | "Not Interested" | "Follow Up";
//   assignee: string;
//   source: "fb" | "jd" | "web";
// };

// type Props = {
//   onSelectLead: (phone: string) => void;
//   onOpenHistory: () => void;
//   onOpenReport: () => void;
// };

// export default function LeadsScreen({ onSelectLead}: Props) {
//   const [leads, setLeads] = useState<Lead[]>([]);
//   const [searchQuery, setSearchQuery] = useState<string>("");

//   useEffect(() => {
//     loadLeads();
//   }, []);

//   const loadLeads = async () => {
//     const saved = await AsyncStorage.getItem("leads");
//     if (saved) {
//       setLeads(JSON.parse(saved));
//       return;
//     }

//     const dummy: Lead[] = [
//       { id: "1", name: "Ali", phone: "03001234567", status: "NEW", assignee: "Umer", source: "fb" },
//       { id: "2", name: "Umer", phone: "03229199459", status: "NEW", assignee: "Umer", source: "web" },
//       { id: "3", name: "Noman", phone: "03003334444", status: "NEW", assignee: "Ali", source: "fb" },
//       { id: "4", name: "Ahmad", phone: "03005556666", status: "OLD", assignee: "Ali", source: "fb" },
//       { id: "5", name: "Sara", phone: "03008889999", status: "NEW", assignee: "Umer", source: "web" },
//       { id: "6", name: "Hassan", phone: "03112223344", status: "OLD", assignee: "Ali", source: "jd" },
//       { id: "7", name: "Adeel", phone: "03221112233", status: "NEW", assignee: "Umer", source: "fb" },
//       { id: "8", name: "Bilal", phone: "03009998877", status: "OLD", assignee: "Ali", source: "web" },
//     ];

//     setLeads(dummy);
//     await AsyncStorage.setItem("leads", JSON.stringify(dummy));
//   };

//   const renderSourceIcon = (source: Lead["source"]) => {
//     switch (source) {
//       case "fb":
//         return <FontAwesome name="facebook" size={20} color="#1877F2" />;
//       case "jd":
//         return <MaterialIcons name="work" size={20} color="#2C3E50" />;
//       case "web":
//         return <MaterialIcons name="public" size={20} color="#27AE60" />;
//       default:
//         return <MaterialIcons name="help-outline" size={20} color="#7f8c8d" />;
//     }
//   };

//   const renderStatusBadge = (status: Lead["status"]) => {
//     let bgColor = "#ecf0f1";
//     let textColor = "#7f8c8d";

//     switch (status) {
//       case "NEW": bgColor = "#1abc9c33"; textColor = "#1abc9c"; break;
//       case "OLD": bgColor = "#e74c3c33"; textColor = "#e74c3c"; break;
//       case "Not Interested": bgColor = "#e74c3c33"; textColor = "#e74c3c"; break;
//       case "Interested": bgColor = "#2ecc7133"; textColor = "#2ecc71"; break;
//       case "Follow Up": bgColor = "#f1c40f33"; textColor = "#f1c40f"; break;
//       default: bgColor = "#bdc3c733"; textColor = "#7f8c8d";
//     }

//     return (
//       <View style={[styles.statusBadge, { backgroundColor: bgColor }]}>
//         <Text style={[styles.statusText, { color: textColor }]} numberOfLines={1} ellipsizeMode="tail">
//           {status}
//         </Text>
//       </View>
//     );
//   };

//   const filteredLeads = leads.filter(
//     (lead) =>
//       lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
//       lead.phone.includes(searchQuery)
//   );

//   return (
//     <View style={styles.container}>
//       {/* SEARCH BAR */}
//       <View style={styles.searchWrapper}>
//         <TextInput
//           placeholder="Search by name or phone..."
//           placeholderTextColor="#7f8c8d"
//           style={styles.searchBar}
//           value={searchQuery}
//           onChangeText={setSearchQuery}
//         />
//         <MaterialIcons name="search" size={22} color="#7f8c8d" style={styles.searchIcon} />
//       </View>

//       {/* LIST */}
//       <FlatList
//         data={filteredLeads}
//         keyExtractor={(item) => item.id}
//         contentContainerStyle={styles.list}
//         renderItem={({ item }) => (
//           <TouchableOpacity
//             style={styles.card}
//             onPress={() => onSelectLead(item.phone)}
//           >
//             <View style={styles.left}>
//               <View style={styles.nameRow}>
//                 <Text style={styles.name}>{item.name}</Text>
//                 <Text style={styles.separator}>|</Text>
//                 <Text style={styles.source}>{renderSourceIcon(item.source)}</Text>
//               </View>
//               <Text style={styles.phone}>{item.phone}</Text>
//             </View>
//             <View style={styles.center}>{renderStatusBadge(item.status)}</View>
//             <View style={styles.right}>
//               <View style={styles.avatar}>
//                 <MaterialIcons name="person" size={24} color="#fff" />
//               </View>
//               <Text style={styles.assignee}>{item.assignee}</Text>
//             </View>
//           </TouchableOpacity>
//         )}
//       />
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: "#eef5f4" },

//   header: {
//   backgroundColor: "#fff",
//   paddingHorizontal: 16,
//   paddingVertical: 10,
//   flexDirection: "row",
//   justifyContent: "space-between", // left-right spacing
//   alignItems: "center",
//   borderBottomWidth: 1,
//   borderColor: "#e6e6e6",
// },
// headerTitle: {
//   fontSize: 18,
//   fontWeight: "700",
//   color: "#2c3e50",
// },
// iconBtn: {
//   flexDirection: "row",
//   alignItems: "center",
//   gap: 10,
//   backgroundColor: "#e0f7f4",
//   paddingHorizontal: 12,
//   paddingVertical: 6,
//   borderRadius: 8,
//   width:"46%",
// },
// iconText: {
//   fontSize: 14,
//   fontWeight: "600",
//   color: "#1abc9c",
// },

//   searchWrapper: {
//     position: "relative",
//     marginHorizontal: 12,
//     marginVertical: 10,
//   },
//   searchBar: {
//     backgroundColor: "#fff",
//     borderRadius: 12,
//     paddingHorizontal: 16,
//     paddingVertical: 10,
//     fontSize: 14,
//     color: "#2c3e50",
//     paddingRight: 40,
//     shadowColor: "#000",
//     shadowOpacity: 0.05,
//     shadowOffset: { width: 0, height: 2 },
//     shadowRadius: 4,
//     elevation: 2,
//   },
//   searchIcon: {
//     position: "absolute",
//     right: 18,
//     top: 10,
//   },

//   list: { paddingHorizontal: 12, paddingBottom: 32 },

//   card: {
//     flexDirection: "row",
//     backgroundColor: "#fff",
//     paddingHorizontal: 16,
//     paddingVertical: 6,
//     borderRadius: 16,
//     marginBottom: 8,
//     shadowColor: "#000",
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.08,
//     shadowRadius: 6,
//     elevation: 3,
//     alignItems: "center",
//   },
//   left: { flex: 3 },
//   nameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "nowrap" },
//   separator: { fontSize: 14, color: "#7f8c8d", marginHorizontal: 4 },
//   name: { fontSize: 16, fontWeight: "700", color: "#2c3e50" },
//   source: { fontSize: 14 },
//   phone: { fontSize: 14, color: "#7f8c8d", marginTop: 4 },

//   center: { flex: 1, alignItems: "center" },
//   statusBadge: {
//     paddingHorizontal: 12,
//     paddingVertical: 4,
//     borderRadius: 16,
//     alignSelf: "center",
//     minWidth: 80,
//     maxWidth: 120,
//     marginRight: 26,
//     alignItems: "center",
//     justifyContent: "center",
//   },
//   statusText: {
//     fontSize: 12,
//     fontWeight: "700",
//     textAlign: "center",
//     flexShrink: 1,
//   },

//   right: { flex: 1, alignItems: "center" },
//   avatar: {
//     width: 40,
//     height: 40,
//     borderRadius: 20,
//     backgroundColor: "#1abc9c",
//     justifyContent: "center",
//     alignItems: "center",
//     marginBottom: 4,
//   },
//   assignee: { fontSize: 12, color: "#34495e" },
// });




// import React, { useEffect, useState } from "react";
// import {
//   View,
//   Text,
//   FlatList,
//   TouchableOpacity,
//   StyleSheet,
//   TextInput,
// } from "react-native";
// import AsyncStorage from "@react-native-async-storage/async-storage";
// import MaterialIcons from "react-native-vector-icons/MaterialIcons"; 
// import FontAwesome from "react-native-vector-icons/FontAwesome";

// export type Lead = {
//   id: string;
//   name: string;
//   phone: string;
//   status: "NEW" | "OLD" | "Interested" | "Not Interested" | "Follow Up";
//   assignee: string;
//   source: "fb" | "jd" | "web";
// };

// type Props = {
//   onSelectLead: (phone: string) => void;
//   onOpenHistory: () => void;
//   onOpenReport: () => void;
// };

// export default function LeadsScreen({ onSelectLead, onOpenHistory, onOpenReport}: Props) {
//   const [leads, setLeads] = useState<Lead[]>([]);
//   const [searchQuery, setSearchQuery] = useState<string>("");

//   useEffect(() => {
//     loadLeads();
//   }, []);

//   const loadLeads = async () => {
//     const saved = await AsyncStorage.getItem("leads");
//     if (saved) {
//       setLeads(JSON.parse(saved));
//       return;
//     }

//     const dummy: Lead[] = [
//       { id: "1", name: "Ali", phone: "03001234567", status: "NEW", assignee: "Umer", source: "fb" },
//       { id: "2", name: "Umer", phone: "03229199459", status: "NEW", assignee: "Umer", source: "web" },
//       { id: "3", name: "Noman", phone: "03003334444", status: "NEW", assignee: "Ali", source: "fb" },
//       { id: "4", name: "Ahmad", phone: "03005556666", status: "OLD", assignee: "Ali", source: "fb" },
//       { id: "5", name: "Sara", phone: "03008889999", status: "NEW", assignee: "Umer", source: "web" },
//       { id: "6", name: "Hassan", phone: "03112223344", status: "OLD", assignee: "Ali", source: "jd" },
//       { id: "7", name: "Adeel", phone: "03221112233", status: "NEW", assignee: "Umer", source: "fb" },
//       { id: "8", name: "Bilal", phone: "03009998877", status: "OLD", assignee: "Ali", source: "web" },
//     ];

//     setLeads(dummy);
//     await AsyncStorage.setItem("leads", JSON.stringify(dummy));
//   };

//   const renderSourceIcon = (source: Lead["source"]) => {
//     switch (source) {
//       case "fb":
//         return <FontAwesome name="facebook" size={20} color="#1877F2" />;
//       case "jd":
//         return <MaterialIcons name="work" size={20} color="#2C3E50" />;
//       case "web":
//         return <MaterialIcons name="public" size={20} color="#27AE60" />;
//       default:
//         return <MaterialIcons name="help-outline" size={20} color="#7f8c8d" />;
//     }
//   };

//   const renderStatusBadge = (status: Lead["status"]) => {
//     let bgColor = "#ecf0f1";
//     let textColor = "#7f8c8d";

//     switch (status) {
//       case "NEW": bgColor = "#1abc9c33"; textColor = "#1abc9c"; break;
//       case "OLD": bgColor = "#e74c3c33"; textColor = "#e74c3c"; break;
//       case "Not Interested": bgColor = "#e74c3c33"; textColor = "#e74c3c"; break;
//       case "Interested": bgColor = "#2ecc7133"; textColor = "#2ecc71"; break;
//       case "Follow Up": bgColor = "#f1c40f33"; textColor = "#f1c40f"; break;
//       default: bgColor = "#bdc3c733"; textColor = "#7f8c8d";
//     }

//     return (
//       <View style={[styles.statusBadge, { backgroundColor: bgColor }]}>
//         <Text style={[styles.statusText, { color: textColor }]} numberOfLines={1} ellipsizeMode="tail">
//           {status}
//         </Text>
//       </View>
//     );
//   };

//   const filteredLeads = leads.filter(
//     (lead) =>
//       lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
//       lead.phone.includes(searchQuery)
//   );

//   return (
//     <View style={styles.container}>
//       {/* HEADER: Professional icon-based History */}
//      <View style={styles.header}>
//   {/* LEFT: Heading */}
//   {/* <Text style={styles.headerTitle}>Leads Management</Text> */}
//    <TouchableOpacity style={styles.iconBtn} onPress={onOpenReport}>
//     <MaterialIcons name="bar-chart" size={24} color="#1abc9c" />
//     <Text style={styles.iconText}>Reports</Text>
//   </TouchableOpacity>

//   {/* RIGHT: History Button */}
//   <TouchableOpacity style={styles.iconBtn} onPress={onOpenHistory}>
//     <MaterialIcons name="history" size={24} color="#1abc9c" />
//     <Text style={styles.iconText}>History</Text>
//   </TouchableOpacity>
// </View>

//       {/* SEARCH BAR */}
//       <View style={styles.searchWrapper}>
//         <TextInput
//           placeholder="Search by name or phone..."
//           placeholderTextColor="#7f8c8d"
//           style={styles.searchBar}
//           value={searchQuery}
//           onChangeText={setSearchQuery}
//         />
//         <MaterialIcons name="search" size={22} color="#7f8c8d" style={styles.searchIcon} />
//       </View>

//       {/* LIST */}
//       <FlatList
//         data={filteredLeads}
//         keyExtractor={(item) => item.id}
//         contentContainerStyle={styles.list}
//         renderItem={({ item }) => (
//           <TouchableOpacity
//             style={styles.card}
//             onPress={() => onSelectLead(item.phone)}
//           >
//             <View style={styles.left}>
//               <View style={styles.nameRow}>
//                 <Text style={styles.name}>{item.name}</Text>
//                 <Text style={styles.separator}>|</Text>
//                 <Text style={styles.source}>{renderSourceIcon(item.source)}</Text>
//               </View>
//               <Text style={styles.phone}>{item.phone}</Text>
//             </View>
//             <View style={styles.center}>{renderStatusBadge(item.status)}</View>
//             <View style={styles.right}>
//               <View style={styles.avatar}>
//                 <MaterialIcons name="person" size={24} color="#fff" />
//               </View>
//               <Text style={styles.assignee}>{item.assignee}</Text>
//             </View>
//           </TouchableOpacity>
//         )}
//       />
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: "#eef5f4" },

//   header: {
//   backgroundColor: "#fff",
//   paddingHorizontal: 16,
//   paddingVertical: 10,
//   flexDirection: "row",
//   justifyContent: "space-between", // left-right spacing
//   alignItems: "center",
//   borderBottomWidth: 1,
//   borderColor: "#e6e6e6",
// },
// headerTitle: {
//   fontSize: 18,
//   fontWeight: "700",
//   color: "#2c3e50",
// },
// iconBtn: {
//   flexDirection: "row",
//   alignItems: "center",
//   gap: 10,
//   backgroundColor: "#e0f7f4",
//   paddingHorizontal: 12,
//   paddingVertical: 6,
//   borderRadius: 8,
//   width:"46%",
// },
// iconText: {
//   fontSize: 14,
//   fontWeight: "600",
//   color: "#1abc9c",
// },

//   searchWrapper: {
//     position: "relative",
//     marginHorizontal: 12,
//     marginVertical: 10,
//   },
//   searchBar: {
//     backgroundColor: "#fff",
//     borderRadius: 12,
//     paddingHorizontal: 16,
//     paddingVertical: 10,
//     fontSize: 14,
//     color: "#2c3e50",
//     paddingRight: 40,
//     shadowColor: "#000",
//     shadowOpacity: 0.05,
//     shadowOffset: { width: 0, height: 2 },
//     shadowRadius: 4,
//     elevation: 2,
//   },
//   searchIcon: {
//     position: "absolute",
//     right: 18,
//     top: 10,
//   },

//   list: { paddingHorizontal: 12, paddingBottom: 32 },

//   card: {
//     flexDirection: "row",
//     backgroundColor: "#fff",
//     paddingHorizontal: 16,
//     paddingVertical: 6,
//     borderRadius: 16,
//     marginBottom: 8,
//     shadowColor: "#000",
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.08,
//     shadowRadius: 6,
//     elevation: 3,
//     alignItems: "center",
//   },
//   left: { flex: 3 },
//   nameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "nowrap" },
//   separator: { fontSize: 14, color: "#7f8c8d", marginHorizontal: 4 },
//   name: { fontSize: 16, fontWeight: "700", color: "#2c3e50" },
//   source: { fontSize: 14 },
//   phone: { fontSize: 14, color: "#7f8c8d", marginTop: 4 },

//   center: { flex: 1, alignItems: "center" },
//   statusBadge: {
//     paddingHorizontal: 12,
//     paddingVertical: 4,
//     borderRadius: 16,
//     alignSelf: "center",
//     minWidth: 80,
//     maxWidth: 120,
//     marginRight: 26,
//     alignItems: "center",
//     justifyContent: "center",
//   },
//   statusText: {
//     fontSize: 12,
//     fontWeight: "700",
//     textAlign: "center",
//     flexShrink: 1,
//   },

//   right: { flex: 1, alignItems: "center" },
//   avatar: {
//     width: 40,
//     height: 40,
//     borderRadius: 20,
//     backgroundColor: "#1abc9c",
//     justifyContent: "center",
//     alignItems: "center",
//     marginBottom: 4,
//   },
//   assignee: { fontSize: 12, color: "#34495e" },
// });




// import React, { useEffect, useState } from "react";
// import {
//   View,
//   Text,
//   FlatList,
//   TouchableOpacity,
//   StyleSheet,
//   TextInput,
// } from "react-native";
// import AsyncStorage from "@react-native-async-storage/async-storage";
// import MaterialIcons from "react-native-vector-icons/MaterialIcons"; // <- add this
// import FontAwesome from "react-native-vector-icons/FontAwesome";


// export type Lead = {
//   id: string;
//   name: string;
//   phone: string;
//   status: "NEW" | "OLD" | "Interested" | "Not Interested" | "Follow Up";
//   assignee: string;
//   source: "fb" | "jd" | "web";
// };

// type Props = {
//   onSelectLead: (phone: string) => void;
//   onOpenDialer: () => void;
//   onOpenHistory: () => void;
// };

// export default function LeadsScreen({ onSelectLead, onOpenDialer, onOpenHistory }: Props) {
//   const [leads, setLeads] = useState<Lead[]>([]);
//   const [searchQuery, setSearchQuery] = useState<string>("");

//   useEffect(() => {
//     loadLeads();
//   }, []);

//   const loadLeads = async () => {
//     const saved = await AsyncStorage.getItem("leads");
//     if (saved) {
//       setLeads(JSON.parse(saved));
//       return;
//     }

//     const dummy: Lead[] = [
//       { id: "1", name: "Ali", phone: "03001234567", status: "NEW", assignee: "Umer", source: "fb" },
//       { id: "2", name: "Umer", phone: "03229199459", status: "NEW", assignee: "Umer", source: "web" },
//       { id: "3", name: "Noman", phone: "03003334444", status: "NEW", assignee: "Ali", source: "fb" },
//       { id: "4", name: "Ahmad", phone: "03005556666", status: "OLD", assignee: "Ali", source: "fb" },
//       { id: "5", name: "Sara", phone: "03008889999", status: "NEW", assignee: "Umer", source: "web" },
//       { id: "6", name: "Hassan", phone: "03112223344", status: "OLD", assignee: "Ali", source: "jd" },
//       { id: "7", name: "Adeel", phone: "03221112233", status: "NEW", assignee: "Umer", source: "fb" },
//       { id: "8", name: "Bilal", phone: "03009998877", status: "OLD", assignee: "Ali", source: "web" },
//     ];

//     setLeads(dummy);
//     await AsyncStorage.setItem("leads", JSON.stringify(dummy));
//   };

//  const renderSourceIcon = (source: Lead["source"]) => {
//   switch (source) {
//     case "fb":
//       return <FontAwesome name="facebook" size={20} color="#1877F2" />;
//     case "jd":
//       return <MaterialIcons name="work" size={20} color="#2C3E50" />;
//     case "web":
//       return <MaterialIcons name="public" size={20} color="#27AE60" />;
//     default:
//       return <MaterialIcons name="help-outline" size={20} color="#7f8c8d" />;
//   }
// };


// const renderStatusBadge = (status: Lead["status"]) => {
//   // Dynamic colors for different statuses
//   let bgColor = "#ecf0f1"; // default light grey
//   let textColor = "#7f8c8d"; // default grey

//   switch (status) {
//     case "NEW":
//       bgColor = "#1abc9c33";
//       textColor = "#1abc9c";
//       break;
//     case "OLD":
//       bgColor = "#e74c3c33";
//       textColor = "#e74c3c";
//       break;
//     case "Not Interested":
//       bgColor = "#e74c3c33";
//       textColor = "#e74c3c";
//       break;
//     case "Interested":
//       bgColor = "#2ecc7133";
//       textColor = "#2ecc71";
//       break;
//     case "Follow Up":
//       bgColor = "#f1c40f33";
//       textColor = "#f1c40f";
//       break;
//     default:
//       bgColor = "#bdc3c733";
//       textColor = "#7f8c8d";
//   }

//   return (
//     <View style={[styles.statusBadge, { backgroundColor: bgColor }]}>
//       <Text style={[styles.statusText, { color: textColor }]} numberOfLines={1} ellipsizeMode="tail">
//         {status}
//       </Text>
//     </View>
//   );
// };


//   const filteredLeads = leads.filter(
//     (lead) =>
//       lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
//       lead.phone.includes(searchQuery)
//   );

//   return (
//     <View style={styles.container}>
//       {/* HEADER: Only buttons */}
//       <View style={styles.header}>
//         <TouchableOpacity style={styles.headerBtn} onPress={onOpenDialer}>
//           <Text style={styles.headerBtnText}>Dialer</Text>
//         </TouchableOpacity>
//         <TouchableOpacity style={styles.headerBtn} onPress={onOpenHistory}>
//           <Text style={styles.headerBtnText}>History</Text>
//         </TouchableOpacity>
//       </View>

//       {/* SEARCH BAR */}
//       <View style={styles.searchWrapper}>
//         <TextInput
//           placeholder="Search by name or phone..."
//           placeholderTextColor="#7f8c8d"
//           style={styles.searchBar}
//           value={searchQuery}
//           onChangeText={setSearchQuery}
//         />
//         <MaterialIcons name="search" size={22} color="#7f8c8d" style={styles.searchIcon} />
//       </View>

//       {/* LIST */}
//       <FlatList
//         data={filteredLeads}
//         keyExtractor={(item) => item.id}
//         contentContainerStyle={styles.list}
//         renderItem={({ item }) => (
//           <TouchableOpacity
//             style={styles.card}
//             onPress={() => onSelectLead(item.phone)}
//           >
//             {/* LEFT: Name, Phone, Source */}
//             <View style={styles.left}>
//               <View style={styles.nameRow}>
//                 <Text style={styles.name}>{item.name}</Text>
//                 <Text style={styles.separator}>|</Text>
//                 <Text style={styles.source}>{renderSourceIcon(item.source)}</Text>
//               </View>
//               <Text style={styles.phone}>{item.phone}</Text>
//             </View>

//             {/* CENTER: Status */}
//             <View style={styles.center}>{renderStatusBadge(item.status)}</View>

//             {/* RIGHT: Avatar & Assignee */}
//             <View style={styles.right}>
//               <View style={styles.avatar}>
//                 <MaterialIcons name="person" size={24} color="#fff" />
//               </View>
//               <Text style={styles.assignee}>{item.assignee}</Text>
//             </View>
//           </TouchableOpacity>
//         )}
//       />
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: "#eef5f4" },

//   header: {
//     backgroundColor: "#ffffff",
//     paddingHorizontal: 16,
//     paddingVertical: 10,
//     flexDirection: "row",
//     justifyContent: "space-around",
//     gap: 10,
//     borderBottomWidth: 1,
//     borderColor: "#e6e6e6",
//   },
//   headerBtn: {
//     backgroundColor: "#1abc9c",
//     width: 100,
//     height: 32,
//     paddingHorizontal: 14,
//     paddingVertical: 6,
//     justifyContent: "center",
//     borderRadius: 6,
//   },
//   headerBtnText: { color: "#fff", textAlign: "center", fontWeight: "600", fontSize: 15 },

//   searchWrapper: {
//     position: "relative",
//     marginHorizontal: 12,
//     marginVertical: 10,
//   },
//   searchBar: {
//     backgroundColor: "#fff",
//     borderRadius: 12,
//     paddingHorizontal: 16,
//     paddingVertical: 10,
//     fontSize: 14,
//     color: "#2c3e50",
//     paddingRight: 40, // space for icon
//     shadowColor: "#000",
//     shadowOpacity: 0.05,
//     shadowOffset: { width: 0, height: 2 },
//     shadowRadius: 4,
//     elevation: 2,
//   },
//   searchIcon: {
//     position: "absolute",
//     right: 18,
//     top: 10,
//   },

//   list: { paddingHorizontal: 12, paddingBottom: 32 },

//   card: {
//     flexDirection: "row",
//     backgroundColor: "#fff",
//     paddingHorizontal: 16,
//     paddingVertical: 6,
//     borderRadius: 16,
//     marginBottom: 8,
//     shadowColor: "#000",
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.08,
//     shadowRadius: 6,
//     elevation: 3,
//     alignItems: "center",
//   },

//   left: { flex: 3 },
// nameRow: { 
//   flexDirection: "row", 
//   alignItems: "center", 
//   gap: 6,
//   flexWrap: "nowrap",
// },
// separator: {
//   fontSize: 14,
//   color: "#7f8c8d",
//   marginHorizontal: 4,
// },
//   name: { fontSize: 16, fontWeight: "700", color: "#2c3e50" },
//   source: { fontSize: 14 },
//   phone: { fontSize: 14, color: "#7f8c8d", marginTop: 4 },

//   center: { flex: 1, alignItems: "center" },
//  statusBadge: {
//   paddingHorizontal: 12,      // enough padding for text
//   paddingVertical: 4,
//   borderRadius: 16,
//   alignSelf: "center",         // centers the badge horizontally in its container
//   minWidth: 80,                // ensures very short text looks good
//   maxWidth: 120,  
//   marginRight:26,           // prevents badge from overflowing on small screens
//   alignItems: "center",
//   justifyContent: "center",
// },
// statusText: {
//   fontSize: 12,
//   fontWeight: "700",
//   textAlign: "center",
//   flexShrink: 1,               // text shrinks slightly if needed
// },


//   right: { flex: 1, alignItems: "center" },
//   avatar: {
//     width: 40,
//     height: 40,
//     borderRadius: 20,
//     backgroundColor: "#1abc9c",
//     justifyContent: "center",
//     alignItems: "center",
//     marginBottom: 4,
//   },
//   assignee: { fontSize: 12, color: "#34495e" },
// });



// import React, { useEffect, useState } from "react";
// import {
//   View,
//   Text,
//   FlatList,
//   TouchableOpacity,
//   StyleSheet,
// } from "react-native";
// import AsyncStorage from "@react-native-async-storage/async-storage";

// export type Lead = {
//   id: string;
//   name: string;
//   phone: string;
//   status: "NEW" | "OLD";
//   assignee: string;
//   source: "fb" | "jd" | "web";
// };

// type Props = {
//   onSelectLead: (phone: string) => void;
// };

// export default function LeadsScreen({ onSelectLead }: Props) {
//   const [leads, setLeads] = useState<Lead[]>([]);

//   useEffect(() => {
//     loadLeads();
//   }, []);

//   const loadLeads = async () => {
//     const saved = await AsyncStorage.getItem("leads");
//     if (saved) {
//       setLeads(JSON.parse(saved));
//       return;
//     }

//     const dummy: Lead[] = [
//       { id: "1", name: "Kishan Jain", phone: "03001234567", status: "NEW", assignee: "Rajat", source: "jd" },
//       { id: "2", name: "Mohit Singh", phone: "03001112222", status: "NEW", assignee: "Amit", source: "web" },
//       { id: "3", name: "Nitin Agarwal", phone: "03003334444", status: "NEW", assignee: "Rajat", source: "fb" },
//       { id: "4", name: "Praksh Rao", phone: "03005556666", status: "NEW", assignee: "Amit", source: "jd" },
//       { id: "5", name: "Priya Kumari", phone: "03007778888", status: "NEW", assignee: "Amit", source: "jd" },
//     ];

//     setLeads(dummy);
//     await AsyncStorage.setItem("leads", JSON.stringify(dummy));
//   };

//   const renderSource = (source: Lead["source"]) => {
//     if (source === "fb") return "f";
//     if (source === "jd") return "Jd";
//     return "🌐";
//   };

//   const renderAvatar = (name: string) => {
//     const initial = name.charAt(0).toUpperCase();
//     return <Text style={styles.avatarText}>{initial}</Text>;
//   };

//   return (
//     <FlatList
//       data={leads}
//       keyExtractor={(item) => item.id}
//       contentContainerStyle={styles.list}
//       renderItem={({ item }) => (
//         <TouchableOpacity
//           style={styles.row}
//           onPress={() => onSelectLead(item.phone)}
//         >
//           {/* LEFT */}
//           <View style={styles.left}>
//             <View style={styles.nameRow}>
//               <Text style={styles.name}>{item.name}</Text>
//               <Text style={styles.source}>{renderSource(item.source)}</Text>
//             </View>

//             <View style={styles.statusRow}>
//               <Text style={styles.statusLabel}>Status :</Text>
//               <Text style={styles.status}> {item.status}</Text>
//             </View>
//           </View>

//           {/* RIGHT */}
//           <View style={styles.right}>
//             <View style={styles.avatar}>
//               {renderAvatar(item.assignee)}
//             </View>
//             <Text style={styles.assignee}>{item.assignee}</Text>
//             <Text style={styles.arrow}>›</Text>
//           </View>
//         </TouchableOpacity>
//       )}
//     />
//   );
// }

// const styles = StyleSheet.create({
//   list: {
//     backgroundColor: "#eef5f4",
//   },

//   row: {
//     flexDirection: "row",
//     backgroundColor: "#fff",
//     paddingVertical: 10,
//     paddingHorizontal: 12,
//     borderBottomWidth: 1,
//     borderColor: "#e6e6e6",
//     alignItems: "center",
//   },

//   left: {
//     flex: 1,
//   },

//   nameRow: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 6,
//   },

//   name: {
//     fontSize: 16,
//     fontWeight: "600",
//     color: "#2c3e50",
//   },

//   source: {
//     fontSize: 13,
//     color: "#f39c12",
//     fontWeight: "700",
//   },

//   statusRow: {
//     flexDirection: "row",
//     marginTop: 4,
//   },

//   statusLabel: {
//     fontSize: 12,
//     color: "#7f8c8d",
//   },

//   status: {
//     fontSize: 12,
//     color: "#e74c3c",
//     fontWeight: "700",
//   },

//   right: {
//     alignItems: "center",
//     width: 80,
//   },

//   avatar: {
//     width: 36,
//     height: 36,
//     borderRadius: 18,
//     backgroundColor: "#1abc9c",
//     justifyContent: "center",
//     alignItems: "center",
//   },

//   avatarText: {
//     color: "#fff",
//     fontWeight: "700",
//   },

//   assignee: {
//     fontSize: 11,
//     marginTop: 4,
//     color: "#34495e",
//   },

//   arrow: {
//     position: "absolute",
//     right: -4,
//     fontSize: 22,
//     color: "#95a5a6",
//   },
// });




// import React, { useEffect, useState } from "react";
// import {
//   View,
//   Text,
//   FlatList,
//   TouchableOpacity,
//   StyleSheet,
//   Alert,
// } from "react-native";
// import AsyncStorage from "@react-native-async-storage/async-storage";

// export type Lead = {
//   id: string;
//   name: string;
//   phone: string;
//   status: "New" | "Old" | "Contacted" | "Pending";
//   assignee: string;
// };

// type Props = {
//   onSelectLead: (phone: string) => void;
// };

// export default function LeadsScreen({ onSelectLead }: Props) {
//   const [leads, setLeads] = useState<Lead[]>([]);

//   useEffect(() => {
//     loadLeads();
//   }, []);

//   const loadLeads = async () => {
//     const saved = await AsyncStorage.getItem("leads");
//     if (saved) {
//       setLeads(JSON.parse(saved));
//     } else {
//       // Dummy leads for first-time load
//       const dummyLeads: Lead[] = [
//         { id: "1", name: "Ali Khan", phone: "03001234567", status: "New", assignee: "Umer" },
//         { id: "2", name: "Sara Ahmed", phone: "03007654321", status: "Old", assignee: "Ayesha" },
//         { id: "3", name: "Hassan Raza", phone: "03009871234", status: "Contacted", assignee: "Ali" },
//         { id: "4", name: "Fatima Noor", phone: "03005551234", status: "Pending", assignee: "Zara" },
//         { id: "5", name: "Ahmed Shah", phone: "03002223344", status: "New", assignee: "Umer" },
//       ];
//       setLeads(dummyLeads);
//       await AsyncStorage.setItem("leads", JSON.stringify(dummyLeads));
//     }
//   };

//   const getStatusColor = (status: Lead["status"]) => {
//     switch (status) {
//       case "New":
//         return "#3498db"; // Blue
//       case "Old":
//         return "#95a5a6"; // Gray
//       case "Contacted":
//         return "#2ecc71"; // Green
//       case "Pending":
//         return "#e67e22"; // Orange
//       default:
//         return "#bdc3c7"; // Light gray
//     }
//   };

//   const handlePress = (phone: string) => {
//     Alert.alert("Call Lead", `Call ${phone}?`, [
//       { text: "Cancel", style: "cancel" },
//       { text: "Call", onPress: () => onSelectLead(phone) },
//     ]);
//   };

//   return (
//     <FlatList
//       data={leads}
//       keyExtractor={(item) => item.id}
//       contentContainerStyle={styles.listContainer}
//       renderItem={({ item }) => (
//         <TouchableOpacity
//           style={styles.leadCard}
//           onPress={() => handlePress(item.phone)}
//         >
//           <View style={styles.cardHeader}>
//             <Text style={styles.leadName}>{item.name}</Text>
//             <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
//               <Text style={styles.statusText}>{item.status}</Text>
//             </View>
//           </View>
//           <Text style={styles.leadPhone}>📞 {item.phone}</Text>
//           <Text style={styles.leadAssignee}>Assignee: {item.assignee}</Text>
//         </TouchableOpacity>
//       )}
//     />
//   );
// }

// const styles = StyleSheet.create({
//   listContainer: {
//     padding: 16,
//     paddingBottom: 32,
//   },
//   leadCard: {
//     backgroundColor: "#fff",
//     padding: 16,
//     borderRadius: 12,
//     marginBottom: 12,
//     shadowColor: "#000",
//     shadowOpacity: 0.05,
//     shadowOffset: { width: 0, height: 2 },
//     elevation: 3,
//   },
//   cardHeader: {
//     flexDirection: "row",
//     justifyContent: "space-between",
//     alignItems: "center",
//   },
//   leadName: {
//     fontSize: 18,
//     fontWeight: "700",
//     color: "#2c3e50",
//   },
//   statusBadge: {
//     paddingHorizontal: 8,
//     paddingVertical: 2,
//     borderRadius: 8,
//   },
//   statusText: {
//     color: "#fff",
//     fontSize: 12,
//     fontWeight: "600",
//   },
//   leadPhone: {
//     fontSize: 16,
//     marginTop: 8,
//     color: "#34495e",
//   },
//   leadAssignee: {
//     fontSize: 14,
//     marginTop: 4,
//     color: "#7f8c8d",
//   },
// });




// import React, { useEffect, useState } from "react";
// import { Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
// import { loadLeads, saveLeads } from "../db/storage";

// export type Lead = {
//   id: number;
//   name: string;
//   phone: string;
//   status: "New" | "Old";
//   assignee: string;
// };

// type Props = {
//   onSelectLead: (phone: string) => void;
// };

// export default function LeadsScreen({ onSelectLead }: Props) {
//   const [leads, setLeads] = useState<Lead[]>([]);

//   useEffect(() => {
//     const init = async () => {
//       let storedLeads = await loadLeads();
//       if (storedLeads.length === 0) {
//         // create dummy leads if nothing is stored
//         storedLeads = [
//           { id: 1, name: "Ali Khan", phone: "03001234567", status: "New", assignee: "Umer" },
//           { id: 2, name: "Sara Ahmed", phone: "03007654321", status: "Old", assignee: "Ayesha" },
//         ];
//         await saveLeads(storedLeads);
//       }
//       setLeads(storedLeads);
//     };
//     init();
//   }, []);

//   return (
//     <FlatList
//       data={leads}
//       keyExtractor={(item) => item.id.toString()}
//       contentContainerStyle={styles.listContainer}
//       renderItem={({ item }) => (
//         <TouchableOpacity
//           style={styles.leadCard}
//           onPress={() => onSelectLead(item.phone)}
//         >
//           <Text style={styles.leadName}>{item.name}</Text>
//           <Text style={styles.leadPhone}>{item.phone}</Text>
//           <Text style={styles.leadStatus}>Status: {item.status}</Text>
//           <Text style={styles.leadAssignee}>Assignee: {item.assignee}</Text>
//         </TouchableOpacity>
//       )}
//     />
//   );
// }

// const styles = StyleSheet.create({
//   listContainer: { padding: 16 },
//   leadCard: {
//     padding: 16,
//     marginBottom: 12,
//     borderRadius: 12,
//     backgroundColor: "#fff",
//     shadowColor: "#000",
//     shadowOpacity: 0.05,
//     shadowOffset: { width: 0, height: 2 },
//     elevation: 3,
//   },
//   leadName: { fontSize: 18, fontWeight: "700", color: "#2f3640" },
//   leadPhone: { fontSize: 16, marginTop: 4, color: "#718093" },
//   leadStatus: { marginTop: 4, fontWeight: "600", color: "#44bd32" },
//   leadAssignee: { marginTop: 2, color: "#718093" },
// });
