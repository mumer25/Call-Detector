import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  TextInput,
  ActivityIndicator,
} from "react-native";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import DateTimePicker from "@react-native-community/datetimepicker";

import { getLeads, getHistory, CallLog } from "../db/database";
import { Lead } from "../screens/LeadsScreen";

export default function ReportsScreen() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [logs, setLogs] = useState<CallLog[]>([]);

  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState<"start" | "end" | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>("");

  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [showMonthSelector, setShowMonthSelector] = useState(false);

  const [loading, setLoading] = useState<boolean>(true);


  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const dbLeads = await getLeads();
        const dbLogs = await getHistory();
        setLeads(dbLeads);
        setLogs(dbLogs);
      } catch (err) {
        console.error("Failed to load reports data:", err);
      }
      finally {
      setLoading(false); // stop loader
    }
    };

    loadData();
  }, []);

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const getLeadCalls = (phone: string) => {
    const leadLogs = logs.filter((log) => {
      if (log.number !== phone) return false;

      const logTime = new Date(log.time);

      // Month filter
      if (selectedMonth !== null) {
        if (logTime.getMonth() !== selectedMonth) return false;
      }

      // Start Date filter
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (logTime < start) return false;
      }

      // End Date filter
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (logTime > end) return false;
      }

      return log.type === "incoming" || log.type === "outgoing" || log.type === "missed";
    });

    const totalCalls = leadLogs.length;
    const totalDuration = leadLogs.reduce((sum, log) => sum + (log.duration || 0), 0);

    return { totalCalls, totalDuration };
  };

  const leadsWithCalls = leads
    .filter((lead) => getLeadCalls(lead.phone).totalCalls > 0)
    .filter(
      (lead) =>
        lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.phone.includes(searchQuery)
    );

  const monthNames = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Top Filters */}
      <View style={styles.header}>
        {/* Start & End Date Buttons */}
        <View style={styles.dateFilterContainer}>
          <TouchableOpacity
            style={[styles.filterButton, styles.dateButton]}
            onPress={() => setShowPicker("start")}
          >
            <MaterialIcons name="date-range" size={18} color="#fff" />
            <Text style={styles.filterText}>
              {startDate ? startDate.toLocaleDateString() : "Start Date"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterButton, styles.dateButton, styles.dateButtonRight]}
            onPress={() => setShowPicker("end")}
          >
            <MaterialIcons name="date-range" size={18} color="#fff" />
            <Text style={styles.filterText}>
              {endDate ? endDate.toLocaleDateString() : "End Date"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Month Filter */}
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowMonthSelector(!showMonthSelector)}
        >
          <MaterialIcons name="calendar-view-month" size={18} color="#fff" />
          <Text style={styles.filterText}>
            {selectedMonth !== null ? monthNames[selectedMonth] : "Select Month"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Month Dropdown */}
      {showMonthSelector && (
        <View style={styles.dropdown}>
          <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
            {monthNames.map((month, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.dropdownItem, selectedMonth === index && styles.selectedItem]}
                onPress={() => {
                  setSelectedMonth(index);
                  setShowMonthSelector(false);
                }}
              >
                <Text style={[styles.dropdownText, selectedMonth === index && styles.selectedText]}>
                  {month}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[styles.dropdownItem, styles.clearButton]}
            onPress={() => {
              setSelectedMonth(null);
              setShowMonthSelector(false);
            }}
          >
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Search */}
   {/* Search */}
<View style={styles.searchContainer}>
  <TextInput
    style={styles.searchInput}
    placeholder="Search leads..."
    value={searchQuery}
    onChangeText={setSearchQuery}
  />

  {searchQuery.length === 0 ? (
    // Show search icon when input is empty
    <MaterialIcons name="search" size={20} color="#7f8c8d" />
  ) : (
    // Show close icon when text is entered
    <TouchableOpacity onPress={() => setSearchQuery("")}>
      <MaterialIcons name="close" size={20} color="#7f8c8d" />
    </TouchableOpacity>
  )}
</View>


      {/* Date Picker */}
      {showPicker && (
        <DateTimePicker
          value={showPicker === "start" ? startDate ?? new Date() : endDate ?? new Date()}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, date) => {
            if (!date) {
              setShowPicker(null);
              return;
            }
            if (showPicker === "start") setStartDate(date);
            else setEndDate(date);
            setShowPicker(null);
          }}
        />
      )}

    {loading ? (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#1abc9c" />
    <Text style={styles.loadingText}>Loading reports...</Text>
  </View>
) : (
  leadsWithCalls.length === 0 ? (
    <View style={styles.noReportContainer}>
      <MaterialIcons name="info-outline" size={40} color="#c0c6c6" />
      <Text style={styles.noReportText}>No reports available for selected filters.</Text>
    </View>
  ) : (
    leadsWithCalls.map((lead) => {
      const { totalCalls, totalDuration } = getLeadCalls(lead.phone);
      return (
        <View key={lead.id} style={styles.card}>
          <View style={styles.left}>
            <View style={styles.avatar}>
              <MaterialIcons name="person" size={24} color="#fff" />
            </View>
            <Text style={styles.name}>{lead.name}</Text>
          </View>

          <View style={styles.middle}>
            <FontAwesome name="phone" size={22} color="#1abc9c" />
            <Text style={styles.statValue}>{totalCalls}</Text>
            <Text style={styles.statLabel}>Total Calls</Text>
          </View>

          <View style={styles.right}>
            <MaterialIcons name="timer" size={22} color="#3498db" />
            <Text style={styles.statValue}>{formatDuration(totalDuration)}</Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>
        </View>
      );
    })
  )
)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f4f7",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  loadingContainer: {
  flex: 1,
  justifyContent: "center",
  alignItems: "center",
  marginTop: 60,
},
loadingText: {
  marginTop: 10,
  color: "#1abc9c",
  fontSize: 14,
  fontWeight: "500",
},

  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  dateFilterContainer: {
    flexDirection: "row",
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
    marginRight: 8,
  },
  dateButton: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  dateButtonRight: {
  flex: 1,
  justifyContent: "center",
  alignItems: "center",
  marginLeft: 8,
},
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1abc9c",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  filterText: {
    color: "#fff",
    marginLeft: 6,
    fontWeight: "600",
    fontSize: 12,
  },
  dropdown: {
    position: "absolute",
    top: 46,
    right: 16,
    width: 160,
    backgroundColor: "#fff",
    borderRadius: 12,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    zIndex: 1000,
    maxHeight: 220,
    overflow: "hidden",
  },
  dropdownScroll: {
    maxHeight: 180,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#ecf0f1",
  },
  dropdownText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2c3e50",
  },
  selectedItem: {
    backgroundColor: "#1abc9c20",
  },
  selectedText: {
    color: "#1abc9c",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#2c3e50",
  },
  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    alignItems: "center",
    justifyContent: "space-between",
  },
  left: { flex: 1, alignItems: "center" },
  middle: { flex: 1, alignItems: "center" },
  right: { flex: 1, alignItems: "center" },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1abc9c",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  name: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    color: "#7f8c8d",
  },
  noReportContainer: {
    alignItems: "center",
    marginTop: 60,
  },
  noReportText: {
    marginTop: 10,
    color: "#7f8c8d",
  },
  clearButton: {
    backgroundColor: "#ffffff",
    borderBottomWidth: 0,
  },
  clearButtonText: {
    color: "#1411e1",
    fontWeight: "600",
    textAlign: "center",
  },
});




// import React, { useEffect, useState } from "react";
// import {
//   View,
//   Text,
//   ScrollView,
//   StyleSheet,
//   TouchableOpacity,
//   Platform,
//   TextInput,
// } from "react-native";
// import MaterialIcons from "react-native-vector-icons/MaterialIcons";
// import FontAwesome from "react-native-vector-icons/FontAwesome";
// import DateTimePicker from "@react-native-community/datetimepicker";

// import { getLeads, getHistory, CallLog } from "../db/database";
// import { Lead } from "../screens/LeadsScreen";

// export default function ReportsScreen() {
//   const [leads, setLeads] = useState<Lead[]>([]);
//   const [logs, setLogs] = useState<CallLog[]>([]);

//   // Date range selection
//   const [startDate, setStartDate] = useState<Date | null>(null);
//   const [endDate, setEndDate] = useState<Date | null>(null);
//   const [showPicker, setShowPicker] = useState<"start" | "end" | null>(null);

//   // Search filter
//   const [searchQuery, setSearchQuery] = useState<string>("");

//   useEffect(() => {
//     const loadData = async () => {
//       try {
//         const dbLeads = await getLeads();
//         const dbLogs = await getHistory();

//         setLeads(dbLeads);
//         setLogs(dbLogs);
//       } catch (err) {
//         console.error("Failed to load reports data:", err);
//       }
//     };

//     loadData();
//   }, []);

//   const formatDuration = (seconds: number) => {
//     if (!seconds || seconds <= 0) return "0:00";
//     const mins = Math.floor(seconds / 60);
//     const secs = seconds % 60;
//     return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
//   };

// const getLeadCalls = (phone: string) => {
//   const leadLogs = logs.filter((log) => {
//     if (log.number !== phone) return false;

//     const logTime = new Date(log.time);

//     if (startDate) {
//       const start = new Date(startDate);
//       start.setHours(0, 0, 0, 0); // start of the day
//       if (logTime < start) return false;
//     }

//     if (endDate) {
//       const end = new Date(endDate);
//       end.setHours(23, 59, 59, 999); // end of the day
//       if (logTime > end) return false;
//     }

//     return log.type === "incoming" || log.type === "outgoing" || log.type === "missed";
//   });

//   const totalCalls = leadLogs.length;
//   const totalDuration = leadLogs.reduce((sum, log) => sum + (log.duration || 0), 0);

//   return { totalCalls, totalDuration };
// };


//   // Filter leads by calls, date range, and search query
//   const leadsWithCalls = leads
//     .filter((lead) => getLeadCalls(lead.phone).totalCalls > 0)
//     .filter(
//       (lead) =>
//         lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
//         lead.phone.includes(searchQuery)
//     );

//   return (
//     <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
//       {/* Header + Filter */}
//       <View style={styles.header}>
//         <Text style={styles.heading}>Lead Reports</Text>
//         <TouchableOpacity
//           style={styles.filterButton}
//           onPress={() => setShowPicker("start")}
//         >
//           <MaterialIcons name="calendar-today" size={20} color="#fff" />
//           <Text style={styles.filterText}>
//             {startDate ? startDate.toLocaleDateString() : "Start Date"} -{" "}
//             {endDate ? endDate.toLocaleDateString() : "End Date"}
//           </Text>
//         </TouchableOpacity>
//       </View>

//       {/* Search Bar */}
//       <View style={styles.searchContainer}>
//         <TextInput
//           style={styles.searchInput}
//           placeholder="Search leads..."
//           value={searchQuery}
//           onChangeText={setSearchQuery}
//         />
//         <MaterialIcons name="search" size={20} color="#7f8c8d" style={styles.searchIcon} />
//       </View>

//       {/* DateTimePicker */}
//       {showPicker && (
//         <DateTimePicker
//           value={showPicker === "start" ? startDate ?? new Date() : endDate ?? new Date()}
//           mode="date"
//           display={Platform.OS === "ios" ? "spinner" : "default"}
//           onChange={(event, date) => {
//             if (!date) {
//               setShowPicker(null);
//               return;
//             }
//             if (showPicker === "start") {
//               setStartDate(date);
//               setShowPicker("end"); 
//             } else if (showPicker === "end") {
//               setEndDate(date);
//               setShowPicker(null); 
//             }
//           }}
//         />
//       )}

//       {/* Reports */}
//       {leadsWithCalls.length === 0 ? (
//         <View style={styles.noReportContainer}>
//           <MaterialIcons name="info-outline" size={40} color="#c0c6c6" />
//           <Text style={styles.noReportText}>
//             No reports available for selected date range.
//           </Text>
//         </View>
//       ) : (
//         leadsWithCalls.map((lead) => {
//           const { totalCalls, totalDuration } = getLeadCalls(lead.phone);

//           return (
//             <View key={lead.id} style={styles.card}>
//               <View style={styles.left}>
//                 <View style={styles.avatar}>
//                   <MaterialIcons name="person" size={28} color="#fff" />
//                 </View>
//                 <Text style={styles.name}>{lead.name}</Text>
//               </View>

//               <View style={styles.middle}>
//                 <FontAwesome name="phone" size={24} color="#1abc9c" />
//                 <Text style={styles.statValue}>{totalCalls}</Text>
//                 <Text style={styles.statLabel}>Total Calls</Text>
//               </View>

//               <View style={styles.right}>
//                 <MaterialIcons name="timer" size={24} color="#3498db" />
//                 <Text style={styles.statValue}>{formatDuration(totalDuration)}</Text>
//                 <Text style={styles.statLabel}>Total Duration</Text>
//               </View>
//             </View>
//           );
//         })
//       )}
//     </ScrollView>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: "#f0f4f7",
//     paddingHorizontal: 16,
//     paddingTop: 16,
//   },
//   scrollContent: {
//     paddingBottom: 40,
//   },
//   header: {
//     flexDirection: "row",
//     justifyContent: "space-between",
//     alignItems: "center",
//     marginBottom: 12,
//   },
//   heading: {
//     fontSize: 22,
//     fontWeight: "700",
//     color: "#2c3e50",
//   },
//   filterButton: {
//     flexDirection: "row",
//     alignItems: "center",
//     backgroundColor: "#1abc9c",
//     paddingVertical: 8,
//     paddingHorizontal: 12,
//     borderRadius: 12,
//     elevation: 3,
//   },
//   filterText: {
//     color: "#fff",
//     marginLeft: 6,
//     fontWeight: "600",
//     fontSize: 10,
//   },
//   searchContainer: {
//     flexDirection: "row",
//     alignItems: "center",
//     backgroundColor: "#fff",
//     borderRadius: 12,
//     paddingHorizontal: 12,
//     paddingVertical: 6,
//     elevation: 2,
//     marginBottom: 16,
//   },
//   searchInput: {
//     flex: 1,
//     fontSize: 14,
//     paddingVertical: 4,
//     color: "#2c3e50",
//   },
//   searchIcon: {
//     marginLeft: 8,
//   },
//   card: {
//     flexDirection: "row",
//     backgroundColor: "#fff",
//     borderRadius: 16,
//     paddingVertical: 12,
//     paddingHorizontal: 12,
//     marginBottom: 12,
//     elevation: 3,
//     shadowColor: "#000",
//     shadowOpacity: 0.05,
//     shadowOffset: { width: 0, height: 2 },
//     shadowRadius: 4,
//     alignItems: "center",
//     justifyContent: "space-between",
//   },
//   left: {
//     flex: 1,
//     alignItems: "center",
//   },
//   avatar: {
//     width: 42,
//     height: 42,
//     borderRadius: 28,
//     backgroundColor: "#1abc9c",
//     justifyContent: "center",
//     alignItems: "center",
//     marginBottom: 6,
//   },
//   name: {
//     fontSize: 14,
//     fontWeight: "600",
//     color: "#2c3e50",
//     textAlign: "center",
//     width: 70,
//     flexWrap: "wrap",
//   },
//   middle: {
//     flex: 1,
//     alignItems: "center",
//   },
//   right: {
//     flex: 1,
//     alignItems: "center",
//   },
//   statValue: {
//     fontSize: 16,
//     fontWeight: "700",
//     color: "#2c3e50",
//     marginTop: 4,
//   },
//   statLabel: {
//     fontSize: 12,
//     color: "#7f8c8d",
//     marginTop: 2,
//     textAlign: "center",
//   },
//   noReportContainer: {
//     flex: 1,
//     alignItems: "center",
//     justifyContent: "center",
//     marginTop: 60,
//   },
//   noReportText: {
//     marginTop: 12,
//     fontSize: 16,
//     fontWeight: "400",
//     color: "#7f8c8d",
//     textAlign: "center",
//   },
// });





// import React, { useEffect, useState } from "react";
// import { View, Text, ScrollView, StyleSheet } from "react-native";
// import MaterialIcons from "react-native-vector-icons/MaterialIcons";
// import FontAwesome from "react-native-vector-icons/FontAwesome";
// import { getLeads, getHistory, CallLog } from "../db/database";
// import { Lead } from "../screens/LeadsScreen";
// // import { CallLog } from "../utils/CallRecorder";

// export default function ReportsScreen() {
//   const [leads, setLeads] = useState<Lead[]>([]);
//   const [logs, setLogs] = useState<CallLog[]>([]);

//  useEffect(() => {
//   const loadData = async () => {
//     try {
//       const dbLeads = await getLeads();
//       const dbLogs = await getHistory();

//       setLeads(dbLeads);
//       setLogs(dbLogs);
//     } catch (err) {
//       console.error("Failed to load reports data:", err);
//     }
//   };

//   loadData();
// }, []);


//   const formatDuration = (seconds: number) => {
//     if (!seconds || seconds <= 0) return "0:00";
//     const mins = Math.floor(seconds / 60);
//     const secs = seconds % 60;
//     return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
//   };

// //   const getLeadCalls = (phone: string) => {
// //     const leadLogs = logs.filter((log) => log.number === phone);
// //     const totalCalls = leadLogs.length;
// //     const totalDuration = leadLogs.reduce((sum, log) => sum + (log.duration || 0), 0);
// //     return { totalCalls, totalDuration };
// //   };

// const getLeadCalls = (phone: string) => {
//   const leadLogs = logs.filter(
//     (log) =>
//       log.number === phone &&
//       (log.type === "incoming" || log.type === "outgoing" || log.type === "missed")
//   );

//   const totalCalls = leadLogs.length;

//   const totalDuration = leadLogs.reduce((sum, log) => sum + (log.duration || 0), 0);

//   return { totalCalls, totalDuration };
// };


//   // Only leads with at least one call
//   const leadsWithCalls = leads.filter((lead) => getLeadCalls(lead.phone).totalCalls > 0);

//  return (
//   <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
//     <Text style={styles.heading}>Lead Reports</Text>

//     {leadsWithCalls.length === 0 ? (
//       <View style={styles.noReportContainer}>
//         <MaterialIcons name="info-outline" size={40} color="#c0c6c6" />
//         <Text style={styles.noReportText}>No reports available yet.</Text>
//       </View>
//     ) : (
//       leadsWithCalls.map((lead) => {
//         const { totalCalls, totalDuration } = getLeadCalls(lead.phone);

//         return (
//           <View key={lead.id} style={styles.card}>
//             {/* Left: Profile icon + name */}
//             <View style={styles.left}>
//               <View style={styles.avatar}>
//                 <MaterialIcons name="person" size={28} color="#fff" />
//               </View>
//               <Text style={styles.name}>{lead.name}</Text>
//             </View>

//             {/* Middle: Total Calls */}
//             <View style={styles.middle}>
//               <FontAwesome name="phone" size={24} color="#1abc9c" />
//               <Text style={styles.statValue}>{totalCalls}</Text>
//               <Text style={styles.statLabel}>Total Calls</Text>
//             </View>

//             {/* Right: Total Duration */}
//             <View style={styles.right}>
//               <MaterialIcons name="timer" size={24} color="#3498db" />
//               <Text style={styles.statValue}>{formatDuration(totalDuration)}</Text>
//               <Text style={styles.statLabel}>Total Duration</Text>
//             </View>
//           </View>
//         );
//       })
//     )}
//   </ScrollView>
// );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: "#f0f4f7",
//     paddingHorizontal: 16,
//     paddingTop: 16,
//   },
//   scrollContent: {
//     paddingBottom: 40,
//   },
//   heading: {
//     fontSize: 22,
//     fontWeight: "700",
//     color: "#2c3e50",
//     marginBottom: 16,
//   },
//   card: {
//     flexDirection: "row",
//     backgroundColor: "#fff",
//     borderRadius: 16,
//     paddingVertical: 12,
//     paddingHorizontal: 12,
//     marginBottom: 12,
//     elevation: 3,
//     shadowColor: "#000",
//     shadowOpacity: 0.05,
//     shadowOffset: { width: 0, height: 2 },
//     shadowRadius: 4,
//     alignItems: "center",
//     justifyContent: "space-between",
//   },
//   left: {
//     flex: 1,
//     alignItems: "center",
//   },
//   avatar: {
//     width: 42,
//     height: 42,
//     borderRadius: 28,
//     backgroundColor: "#1abc9c",
//     justifyContent: "center",
//     alignItems: "center",
//     marginBottom: 6,
//   },
//   name: {
//     fontSize: 14,
//     fontWeight: "600",
//     color: "#2c3e50",
//     textAlign: "center",
//     width: 70,
//     flexWrap: "wrap",
//   },
//   middle: {
//     flex: 1,
//     alignItems: "center",
//   },
//   right: {
//     flex: 1,
//     alignItems: "center",
//   },
//   statValue: {
//     fontSize: 16,
//     fontWeight: "700",
//     color: "#2c3e50",
//     marginTop: 4,
//   },
//   statLabel: {
//     fontSize: 12,
//     color: "#7f8c8d",
//     marginTop: 2,
//     textAlign: "center",
//   },
//   noReportContainer: {
//   flex: 1,
//   alignItems: "center",
//   justifyContent: "center",
//   marginTop: 60,
// },
// noReportText: {
//   marginTop: 12,
//   fontSize: 16,
//   fontWeight: "400",
//   color: "#7f8c8d",
//   textAlign: "center",
// },

// });



// ================ Updated DB Storage Storing Data in DB ================= *
// import React, { useEffect, useState } from "react";
// import { View, Text, ScrollView, StyleSheet } from "react-native";
// import AsyncStorage from "@react-native-async-storage/async-storage";
// import MaterialIcons from "react-native-vector-icons/MaterialIcons";
// import FontAwesome from "react-native-vector-icons/FontAwesome";
// import { Lead } from "../screens/LeadsScreen";
// import { CallLog } from "../utils/CallRecorder";

// export default function ReportsScreen() {
//   const [leads, setLeads] = useState<Lead[]>([]);
//   const [logs, setLogs] = useState<CallLog[]>([]);

//   useEffect(() => {
//     const loadData = async () => {
//       const leadsData = await AsyncStorage.getItem("leads");
//       const logsData = await AsyncStorage.getItem("logs");
//       if (leadsData) setLeads(JSON.parse(leadsData));
//       if (logsData) setLogs(JSON.parse(logsData));
//     };
//     loadData();
//   }, []);

//   const formatDuration = (seconds: number) => {
//     if (!seconds || seconds <= 0) return "0:00";
//     const mins = Math.floor(seconds / 60);
//     const secs = seconds % 60;
//     return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
//   };

// //   const getLeadCalls = (phone: string) => {
// //     const leadLogs = logs.filter((log) => log.number === phone);
// //     const totalCalls = leadLogs.length;
// //     const totalDuration = leadLogs.reduce((sum, log) => sum + (log.duration || 0), 0);
// //     return { totalCalls, totalDuration };
// //   };

// const getLeadCalls = (phone: string) => {
//   const leadLogs = logs.filter(
//     (log) =>
//       log.number === phone &&
//       (log.type === "incoming" || log.type === "outgoing" || log.type === "missed")
//   );

//   const totalCalls = leadLogs.length;

//   const totalDuration = leadLogs.reduce((sum, log) => sum + (log.duration || 0), 0);

//   return { totalCalls, totalDuration };
// };


//   // Only leads with at least one call
//   const leadsWithCalls = leads.filter((lead) => getLeadCalls(lead.phone).totalCalls > 0);

//  return (
//   <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
//     <Text style={styles.heading}>Lead Reports</Text>

//     {leadsWithCalls.length === 0 ? (
//       <View style={styles.noReportContainer}>
//         <MaterialIcons name="info-outline" size={40} color="#c0c6c6" />
//         <Text style={styles.noReportText}>No reports available yet.</Text>
//       </View>
//     ) : (
//       leadsWithCalls.map((lead) => {
//         const { totalCalls, totalDuration } = getLeadCalls(lead.phone);

//         return (
//           <View key={lead.id} style={styles.card}>
//             {/* Left: Profile icon + name */}
//             <View style={styles.left}>
//               <View style={styles.avatar}>
//                 <MaterialIcons name="person" size={28} color="#fff" />
//               </View>
//               <Text style={styles.name}>{lead.name}</Text>
//             </View>

//             {/* Middle: Total Calls */}
//             <View style={styles.middle}>
//               <FontAwesome name="phone" size={24} color="#1abc9c" />
//               <Text style={styles.statValue}>{totalCalls}</Text>
//               <Text style={styles.statLabel}>Total Calls</Text>
//             </View>

//             {/* Right: Total Duration */}
//             <View style={styles.right}>
//               <MaterialIcons name="timer" size={24} color="#3498db" />
//               <Text style={styles.statValue}>{formatDuration(totalDuration)}</Text>
//               <Text style={styles.statLabel}>Total Duration</Text>
//             </View>
//           </View>
//         );
//       })
//     )}
//   </ScrollView>
// );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: "#f0f4f7",
//     paddingHorizontal: 16,
//     paddingTop: 16,
//   },
//   scrollContent: {
//     paddingBottom: 40,
//   },
//   heading: {
//     fontSize: 22,
//     fontWeight: "700",
//     color: "#2c3e50",
//     marginBottom: 16,
//   },
//   card: {
//     flexDirection: "row",
//     backgroundColor: "#fff",
//     borderRadius: 16,
//     paddingVertical: 12,
//     paddingHorizontal: 12,
//     marginBottom: 12,
//     elevation: 3,
//     shadowColor: "#000",
//     shadowOpacity: 0.05,
//     shadowOffset: { width: 0, height: 2 },
//     shadowRadius: 4,
//     alignItems: "center",
//     justifyContent: "space-between",
//   },
//   left: {
//     flex: 1,
//     alignItems: "center",
//   },
//   avatar: {
//     width: 42,
//     height: 42,
//     borderRadius: 28,
//     backgroundColor: "#1abc9c",
//     justifyContent: "center",
//     alignItems: "center",
//     marginBottom: 6,
//   },
//   name: {
//     fontSize: 14,
//     fontWeight: "600",
//     color: "#2c3e50",
//     textAlign: "center",
//     width: 70,
//     flexWrap: "wrap",
//   },
//   middle: {
//     flex: 1,
//     alignItems: "center",
//   },
//   right: {
//     flex: 1,
//     alignItems: "center",
//   },
//   statValue: {
//     fontSize: 16,
//     fontWeight: "700",
//     color: "#2c3e50",
//     marginTop: 4,
//   },
//   statLabel: {
//     fontSize: 12,
//     color: "#7f8c8d",
//     marginTop: 2,
//     textAlign: "center",
//   },
//   noReportContainer: {
//   flex: 1,
//   alignItems: "center",
//   justifyContent: "center",
//   marginTop: 60,
// },
// noReportText: {
//   marginTop: 12,
//   fontSize: 16,
//   fontWeight: "400",
//   color: "#7f8c8d",
//   textAlign: "center",
// },

// });