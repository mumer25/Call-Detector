import React, { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import { CallLog } from "../utils/CallRecorder";

export default function HistoryScreen() {
  const [logs, setLogs] = useState<CallLog[]>([]);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    const saved = await AsyncStorage.getItem("logs");
    if (saved) setLogs(JSON.parse(saved));
  };

  const renderCallIcon = (type: CallLog["type"]) => {
    switch (type) {
      case "incoming":
        return <MaterialIcons name="call-received" size={22} color="#1abc9c" />;
      case "outgoing":
        return <MaterialIcons name="call-made" size={22} color="#3498db" />;
      case "missed":
        return <MaterialIcons name="call-missed" size={22} color="#e74c3c" />;
      default:
        return <MaterialIcons name="call" size={22} color="#7f8c8d" />;
    }
  };

  const renderItem = ({ item }: { item: CallLog }) => (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <View style={styles.numberRow}>
          {renderCallIcon(item.type)}
          <Text style={styles.number}>{item.number ?? "Unknown"}</Text>
        </View>
        <Text style={styles.time}>{item.time}</Text>
      </View>
      {item.type !== "missed" && ( // only show duration for answered calls
        <View style={styles.cardRight}>
          <Text style={styles.duration}>{item.duration}s</Text>
        </View>
      )}
    </View>
  );

  return (
    <FlatList
      data={logs}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      renderItem={renderItem}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No calls recorded yet</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: {
    padding: 16,
    paddingBottom: 32,
  },

  card: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    marginBottom: 12,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },

  cardLeft: {
    flex: 1,
  },

  numberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  cardRight: {
    backgroundColor: "#1abc9c33",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },

  number: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2c3e50",
  },

  time: {
    fontSize: 14,
    color: "#7f8c8d",
    marginTop: 4,
  },

  duration: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1abc9c",
  },

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 50,
  },

  emptyText: {
    fontSize: 16,
    color: "#7f8c8d",
  },
});




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
