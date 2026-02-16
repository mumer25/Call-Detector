import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import DateTimePicker from "@react-native-community/datetimepicker";

import { getLeads, getHistory, CallLog } from "../db/database";
import { Lead } from "../screens/LeadsScreen";

export default function ReportsScreen() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [logs, setLogs] = useState<CallLog[]>([]);

  // Date range selection
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState<"start" | "end" | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const dbLeads = await getLeads();
        const dbLogs = await getHistory();

        setLeads(dbLeads);
        setLogs(dbLogs);
      } catch (err) {
        console.error("Failed to load reports data:", err);
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
      if (startDate && logTime < startDate) return false;
      if (endDate && logTime > endDate) return false;

      return log.type === "incoming" || log.type === "outgoing" || log.type === "missed";
    });

    const totalCalls = leadLogs.length;
    const totalDuration = leadLogs.reduce((sum, log) => sum + (log.duration || 0), 0);

    return { totalCalls, totalDuration };
  };

  const leadsWithCalls = leads.filter(
    (lead) => getLeadCalls(lead.phone).totalCalls > 0
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.heading}>Lead Reports</Text>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowPicker("start")}
        >
          <MaterialIcons name="calendar-today" size={20} color="#fff" />
          <Text style={styles.filterText}>
            {startDate ? startDate.toLocaleDateString() : "Start Date"} -{" "}
            {endDate ? endDate.toLocaleDateString() : "End Date"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* DateTimePicker */}
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
            if (showPicker === "start") {
              setStartDate(date);
              setShowPicker("end"); // open end date picker next
            } else if (showPicker === "end") {
              setEndDate(date);
              setShowPicker(null); // done selecting range
            }
          }}
        />
      )}

      {/* Reports */}
      {leadsWithCalls.length === 0 ? (
        <View style={styles.noReportContainer}>
          <MaterialIcons name="info-outline" size={40} color="#c0c6c6" />
          <Text style={styles.noReportText}>
            No reports available for selected date range.
          </Text>
        </View>
      ) : (
        leadsWithCalls.map((lead) => {
          const { totalCalls, totalDuration } = getLeadCalls(lead.phone);

          return (
            <View key={lead.id} style={styles.card}>
              {/* Left: Profile icon + name */}
              <View style={styles.left}>
                <View style={styles.avatar}>
                  <MaterialIcons name="person" size={28} color="#fff" />
                </View>
                <Text style={styles.name}>{lead.name}</Text>
              </View>

              {/* Middle: Total Calls */}
              <View style={styles.middle}>
                <FontAwesome name="phone" size={24} color="#1abc9c" />
                <Text style={styles.statValue}>{totalCalls}</Text>
                <Text style={styles.statLabel}>Total Calls</Text>
              </View>

              {/* Right: Total Duration */}
              <View style={styles.right}>
                <MaterialIcons name="timer" size={24} color="#3498db" />
                <Text style={styles.statValue}>{formatDuration(totalDuration)}</Text>
                <Text style={styles.statLabel}>Total Duration</Text>
              </View>
            </View>
          );
        })
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
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    color: "#2c3e50",
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1abc9c",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    elevation: 3,
  },
  filterText: {
    color: "#fff",
    marginLeft: 6,
    fontWeight: "600",
    fontSize:10,
  },
  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    alignItems: "center",
    justifyContent: "space-between",
  },
  left: {
    flex: 1,
    alignItems: "center",
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 28,
    backgroundColor: "#1abc9c",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  name: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2c3e50",
    textAlign: "center",
    width: 70,
    flexWrap: "wrap",
  },
  middle: {
    flex: 1,
    alignItems: "center",
  },
  right: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2c3e50",
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#7f8c8d",
    marginTop: 2,
    textAlign: "center",
  },
  noReportContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 60,
  },
  noReportText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "400",
    color: "#7f8c8d",
    textAlign: "center",
  },
});





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