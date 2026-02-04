import React, { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import { CallLog } from "../utils/CallRecorder";

export default function HistoryScreen() {
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const formatDuration = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const loadLogs = async () => {
    try {
      const saved = await AsyncStorage.getItem("logs");
      if (saved) setLogs(JSON.parse(saved));
      else setLogs([]);
    } catch (e) {
      console.error("Failed to load logs", e);
    }
  };

  useEffect(() => {
    loadLogs();

    const interval = setInterval(loadLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadLogs();
    setRefreshing(false);
  }, []);

  const renderCallIcon = (type: CallLog["type"]) => {
    switch (type) {
      case "incoming":
        return <MaterialIcons name="call-received" size={20} color="#1abc9c" />;
      case "outgoing":
        return <MaterialIcons name="call-made" size={20} color="#3498db" />;
      case "missed":
        return <MaterialIcons name="call-missed" size={20} color="#e74c3c" />;
      default:
        return <MaterialIcons name="call" size={20} color="#7f8c8d" />;
    }
  };

  const renderItem = ({ item }: { item: CallLog }) => (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <View style={styles.numberRow}>
          {renderCallIcon(item.type)}
          <Text style={styles.number}>{item.number || "Unknown"}</Text>
        </View>
        <Text style={styles.time}>{item.time}</Text>
      </View>

      {/* <View style={[styles.cardRight, item.type === "missed" && styles.cardRightMissed]}>
        <Text style={[styles.durationText, item.type === "missed" && styles.durationTextMissed]}>
          {item.type === "missed" ? "Missed" : formatDuration(item.duration)}
        </Text>
      </View> */}
      <View style={styles.cardRight}>
      {item.type !== "missed" && item.duration > 0 ? (
        <Text style={styles.durationText}>{formatDuration(item.duration)}</Text>
      ) : null /* show nothing for missed/zero duration */}
    </View>
    </View>
  );

  return (
    <View style={styles.screenContainer}>
      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="history-toggle-off" size={60} color="#dcdde1" />
            <Text style={styles.emptyText}>No call history yet</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: { flex: 1, backgroundColor: "#f8f9fa" },
  list: { padding: 16, paddingBottom: 32 },
  card: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 14,
    marginBottom: 10,
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  cardLeft: { flex: 1 },
  numberRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  number: { fontSize: 16, fontWeight: "600", color: "#2d3436", marginLeft: 8 },
  time: { fontSize: 13, color: "#95a5a6", marginLeft: 28 },
  // cardRight: {
  //   backgroundColor: "#e8f8f5",
  //   paddingHorizontal: 10,
  //   paddingVertical: 4,
  //   borderRadius: 8,
  // },
  cardRight: {
  paddingHorizontal: 10,
  paddingVertical: 4,
  borderRadius: 8,
  minWidth: 50,
  alignItems: "center",
  justifyContent: "center",
},

  cardRightMissed: { backgroundColor: "#f5f6fa" },
  durationText: { fontSize: 13, fontWeight: "700", color: "#16a085" },
  durationTextMissed: { color: "#7f8c8d" },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", marginTop: 100 },
  emptyText: { fontSize: 16, color: "#bdc3c7", marginTop: 10 },
});



// import React, { useEffect, useState, useCallback } from "react";
// import { View, Text, FlatList, StyleSheet, RefreshControl } from "react-native";
// import AsyncStorage from "@react-native-async-storage/async-storage";
// import MaterialIcons from "react-native-vector-icons/MaterialIcons";
// import { CallLog } from "../utils/CallRecorder";

// export default function HistoryScreen() {
//   const [logs, setLogs] = useState<CallLog[]>([]);
//   const [refreshing, setRefreshing] = useState(false);

//   // Helper to format duration from seconds to 00:00
//   const formatDuration = (totalSeconds: number) => {
//     const mins = Math.floor(totalSeconds / 60);
//     const secs = totalSeconds % 60;
//     return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
//   };

//   const loadLogs = async () => {
//     try {
//       const saved = await AsyncStorage.getItem("logs");
//       if (saved) {
//         setLogs(JSON.parse(saved));
//       } else {
//         setLogs([]); 
//       }
//     } catch (e) {
//       console.error("Failed to load logs", e);
//     }
//   };

//   useEffect(() => {
//     loadLogs();
    
//     // Check for new logs every 5 seconds while screen is open
//     const interval = setInterval(loadLogs, 5000);
//     return () => clearInterval(interval);
//   }, []);

//   const onRefresh = useCallback(async () => {
//     setRefreshing(true);
//     await loadLogs();
//     setRefreshing(false);
//   }, []);

//   const renderCallIcon = (type: CallLog["type"]) => {
//     switch (type) {
//       case "incoming":
//         return <MaterialIcons name="call-received" size={20} color="#1abc9c" />;
//       case "outgoing":
//         return <MaterialIcons name="call-made" size={20} color="#3498db" />;
//       case "missed":
//         return <MaterialIcons name="call-missed" size={20} color="#e74c3c" />;
//       default:
//         return <MaterialIcons name="call" size={20} color="#7f8c8d" />;
//     }
//   };

//   const renderItem = ({ item }: { item: CallLog }) => (
//     <View style={styles.card}>
//       <View style={styles.cardLeft}>
//         <View style={styles.numberRow}>
//           {renderCallIcon(item.type)}
//           <Text style={styles.number}>{item.number || "Unknown"}</Text>
//         </View>
//         <Text style={styles.time}>{item.time}</Text>
//       </View>
      
//       {item.type !== "missed" && item.duration > 0 ? (
//         <View style={styles.cardRight}>
//           <Text style={styles.durationText}>{formatDuration(item.duration)}</Text>
//         </View>
//       ) : (
//         <View style={styles.cardRightMissed}>
//           <Text style={styles.durationTextMissed}>
//             {item.type === "missed" ? "Missed" : "0:00"}
//           </Text>
//         </View>
//       )}
//     </View>
//   );

//   return (
//     <View style={styles.screenContainer}>
//       <FlatList
//         data={logs}
//         keyExtractor={(item) => item.id}
//         contentContainerStyle={styles.list}
//         refreshControl={
//           <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
//         }
//         renderItem={renderItem}
//         ListEmptyComponent={
//           <View style={styles.emptyContainer}>
//             <MaterialIcons name="history-toggle-off" size={60} color="#dcdde1" />
//             <Text style={styles.emptyText}>No call history yet</Text>
//           </View>
//         }
//       />
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   screenContainer: {
//     flex: 1,
//     backgroundColor: '#f8f9fa',
//   },
//   list: {
//     padding: 16,
//     paddingBottom: 32,
//   },
//   card: {
//     flexDirection: "row",
//     justifyContent: "space-between",
//     alignItems: "center",
//     backgroundColor: "#fff",
//     padding: 14,
//     marginBottom: 10,
//     borderRadius: 12,
//     elevation: 2,
//     shadowColor: "#000",
//     shadowOffset: { width: 0, height: 1 },
//     shadowOpacity: 0.1,
//     shadowRadius: 3,
//   },
//   cardLeft: {
//     flex: 1,
//   },
//   numberRow: {
//     flexDirection: "row",
//     alignItems: "center",
//     marginBottom: 4,
//   },
//   number: {
//     fontSize: 16,
//     fontWeight: "600",
//     color: "#2d3436",
//     marginLeft: 8,
//   },
//   time: {
//     fontSize: 13,
//     color: "#95a5a6",
//     marginLeft: 28,
//   },
//   cardRight: {
//     backgroundColor: "#e8f8f5",
//     paddingHorizontal: 10,
//     paddingVertical: 4,
//     borderRadius: 8,
//   },
//   cardRightMissed: {
//     backgroundColor: '#f5f6fa',
//     paddingHorizontal: 10,
//     paddingVertical: 4,
//     borderRadius: 8,
//   },
//   durationText: {
//     fontSize: 13,
//     fontWeight: "700",
//     color: "#16a085",
//   },
//   durationTextMissed: {
//     fontSize: 13,
//     fontWeight: "700",
//     color: '#7f8c8d',
//   },
//   emptyContainer: {
//     flex: 1,
//     justifyContent: "center",
//     alignItems: "center",
//     marginTop: 100,
//   },
//   emptyText: {
//     fontSize: 16,
//     color: "#bdc3c7",
//     marginTop: 10,
//   },
// });




// import React, { useEffect, useState } from "react";
// import { View, Text, FlatList, StyleSheet } from "react-native";
// import AsyncStorage from "@react-native-async-storage/async-storage";
// import MaterialIcons from "react-native-vector-icons/MaterialIcons";
// import { CallLog } from "../utils/CallRecorder";

// export default function HistoryScreen() {
//   const [logs, setLogs] = useState<CallLog[]>([]);

//   useEffect(() => {
//     loadLogs();
//   }, []);

//   const loadLogs = async () => {
//     const saved = await AsyncStorage.getItem("logs");
//     if (saved) setLogs(JSON.parse(saved));
//   };

//   const renderCallIcon = (type: CallLog["type"]) => {
//     switch (type) {
//       case "incoming":
//         return <MaterialIcons name="call-received" size={22} color="#1abc9c" />;
//       case "outgoing":
//         return <MaterialIcons name="call-made" size={22} color="#3498db" />;
//       case "missed":
//         return <MaterialIcons name="call-missed" size={22} color="#e74c3c" />;
//       default:
//         return <MaterialIcons name="call" size={22} color="#7f8c8d" />;
//     }
//   };

//   const renderItem = ({ item }: { item: CallLog }) => (
//     <View style={styles.card}>
//       <View style={styles.cardLeft}>
//         <View style={styles.numberRow}>
//           {renderCallIcon(item.type)}
//           <Text style={styles.number}>{item.number ?? "Unknown"}</Text>
//         </View>
//         <Text style={styles.time}>{item.time}</Text>
//       </View>
//       {item.type !== "missed" && ( // only show duration for answered calls
//         <View style={styles.cardRight}>
//           <Text style={styles.duration}>{item.duration}s</Text>
//         </View>
//       )}
//     </View>
//   );

//   return (
//     <FlatList
//       data={logs}
//       keyExtractor={(item) => item.id}
//       contentContainerStyle={styles.list}
//       renderItem={renderItem}
//       ListEmptyComponent={
//         <View style={styles.emptyContainer}>
//           <Text style={styles.emptyText}>No calls recorded yet</Text>
//         </View>
//       }
//     />
//   );
// }

// const styles = StyleSheet.create({
//   list: {
//     padding: 16,
//     paddingBottom: 32,
//   },

//   card: {
//     flexDirection: "row",
//     justifyContent: "space-between",
//     alignItems: "center",
//     backgroundColor: "#fff",
//     padding: 16,
//     marginBottom: 12,
//     borderRadius: 16,
//     shadowColor: "#000",
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.08,
//     shadowRadius: 6,
//     elevation: 3,
//   },

//   cardLeft: {
//     flex: 1,
//   },

//   numberRow: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 8,
//   },

//   cardRight: {
//     backgroundColor: "#1abc9c33",
//     paddingHorizontal: 12,
//     paddingVertical: 6,
//     borderRadius: 12,
//   },

//   number: {
//     fontSize: 16,
//     fontWeight: "700",
//     color: "#2c3e50",
//   },

//   time: {
//     fontSize: 14,
//     color: "#7f8c8d",
//     marginTop: 4,
//   },

//   duration: {
//     fontSize: 14,
//     fontWeight: "600",
//     color: "#1abc9c",
//   },

//   emptyContainer: {
//     flex: 1,
//     justifyContent: "center",
//     alignItems: "center",
//     marginTop: 50,
//   },

//   emptyText: {
//     fontSize: 16,
//     color: "#7f8c8d",
//   },
// });




// import React, { useEffect, useState } from "react";
// import { View, Text, FlatList, StyleSheet } from "react-native";
// import AsyncStorage from "@react-native-async-storage/async-storage";
// import { CallLog } from "../utils/CallRecorder";

// export default function HistoryScreen() {
//   const [logs, setLogs] = useState<CallLog[]>([]);

//   useEffect(() => {
//     loadLogs();
//   }, []);

//   const loadLogs = async () => {
//     const saved = await AsyncStorage.getItem("logs");
//     if (saved) setLogs(JSON.parse(saved));
//   };

//   const renderItem = ({ item }: { item: CallLog }) => (
//     <View style={styles.card}>
//       <View style={styles.cardLeft}>
//         <Text style={styles.number}>📞 {item.number ?? "Unknown"}</Text>
//         <Text style={styles.time}>{item.time}</Text>
//       </View>
//       <View style={styles.cardRight}>
//         <Text style={styles.duration}>{item.duration}s</Text>
//       </View>
//     </View>
//   );

//   return (
//     <FlatList
//       data={logs}
//       keyExtractor={(item) => item.id}
//       contentContainerStyle={styles.list}
//       renderItem={renderItem}
//       ListEmptyComponent={
//         <View style={styles.emptyContainer}>
//           <Text style={styles.emptyText}>No calls recorded yet</Text>
//         </View>
//       }
//     />
//   );
// }

// const styles = StyleSheet.create({
//   list: {
//     padding: 16,
//     paddingBottom: 32,
//   },

//   card: {
//     flexDirection: "row",
//     justifyContent: "space-between",
//     alignItems: "center",
//     backgroundColor: "#fff",
//     padding: 16,
//     marginBottom: 12,
//     borderRadius: 16,
//     shadowColor: "#000",
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.08,
//     shadowRadius: 6,
//     elevation: 3,
//   },

//   cardLeft: {
//     flex: 1,
//   },

//   cardRight: {
//     backgroundColor: "#1abc9c33", // subtle green background
//     paddingHorizontal: 12,
//     paddingVertical: 6,
//     borderRadius: 12,
//   },

//   number: {
//     fontSize: 18,
//     fontWeight: "700",
//     color: "#2c3e50",
//   },

//   time: {
//     fontSize: 14,
//     color: "#7f8c8d",
//     marginTop: 4,
//   },

//   duration: {
//     fontSize: 14,
//     fontWeight: "600",
//     color: "#1abc9c",
//   },

//   emptyContainer: {
//     flex: 1,
//     justifyContent: "center",
//     alignItems: "center",
//     marginTop: 50,
//   },

//   emptyText: {
//     fontSize: 16,
//     color: "#7f8c8d",
//   },
// });
