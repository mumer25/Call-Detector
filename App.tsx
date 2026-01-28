import React, { useEffect, useState } from "react";
import {
  NativeModules,
  NativeEventEmitter,
  PermissionsAndroid,
  View,
  Text,
  FlatList,
  Platform,
  StyleSheet,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

type CallLog = {
  id: string;
  number?: string;
  duration: number;
  time: string;
};

type CallEvent = {
  state: "Incoming" | "Connected" | "Disconnected";
  number?: string;
  duration?: number;
};

const { CallDetector } = NativeModules;
const emitter = new NativeEventEmitter(CallDetector);

export default function App(): JSX.Element {
  const [logs, setLogs] = useState<CallLog[]>([]);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    requestPermissions().then(() => {
      loadLogs();
      CallDetector.startListening();
    });

    const subscription = emitter.addListener("CallEvent", async (data: CallEvent) => {
      if (data.state === "Disconnected" && data.duration) {
        const log: CallLog = {
          id: Date.now().toString(),
          number: data.number, // store the number
          duration: data.duration,
          time: new Date().toLocaleString(),
        };

        setLogs(prev => {
          const updated = [log, ...prev];
          AsyncStorage.setItem("logs", JSON.stringify(updated));
          return updated;
        });
      }
    });

    return () => {
      subscription.remove();
      CallDetector.stopListening?.();
    };
  }, []);

  const requestPermissions = async () => {
    await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
      PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    ]);
  };

  const loadLogs = async () => {
    const saved = await AsyncStorage.getItem("logs");
    if (saved) setLogs(JSON.parse(saved));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📞 Call History</Text>

      {logs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No calls recorded yet</Text>
        </View>
      ) : (
        <FlatList
  data={logs}
  keyExtractor={item => item.id}
  contentContainerStyle={styles.listContainer}
  renderItem={({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardContent}>
        <View style={styles.cardLeft}>
          <Text style={styles.logItemNumber}>📞 {item.number ?? "Unknown"}</Text>
          <Text style={styles.callTime}>{item.time}</Text>
        </View>
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>{item.duration}s</Text>
        </View>
      </View>
    </View>
  )}
/>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f5f6fa",
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#2f3640",
    marginBottom: 20,
  },
   listContainer: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
cardContent: {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
},
cardLeft: {
  flexDirection: "column",
},
logItemNumber: {
  fontSize: 16,
  fontWeight: "bold",
  color: "#2f3640",
},
callTime: {
  fontSize: 14,
  color: "#718093",
  marginTop: 4,
},
durationBadge: {
  backgroundColor: "#4cd137",
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 12,
},
durationText: {
  color: "#fff",
  fontWeight: "600",
  fontSize: 14,
},
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 50,
  },
  emptyText: {
    fontSize: 18,
    color: "#718093",
  },
});








// import React, { useEffect, useState } from "react";
// import {
//   NativeModules,
//   NativeEventEmitter,
//   PermissionsAndroid,
//   View,
//   Text,
//   FlatList,
//   Platform,
//   StyleSheet,
// } from "react-native";
// import AsyncStorage from "@react-native-async-storage/async-storage";

// type CallLog = {
//   id: string;
//   duration: number;
//   time: string;
// };

// type CallEvent = {
//   state: "Incoming" | "Connected" | "Disconnected";
//   number?: string;
//   duration?: number;
// };

// const { CallDetector } = NativeModules;
// const emitter = new NativeEventEmitter(CallDetector);

// export default function App(): JSX.Element {
//   const [logs, setLogs] = useState<CallLog[]>([]);

//   useEffect(() => {
//     if (Platform.OS !== "android") return;

//     requestPermissions().then(() => {
//       loadLogs();
//       CallDetector.startListening();
//     });

//     const subscription = emitter.addListener("CallEvent", async (data: CallEvent) => {
//       if (data.state === "Disconnected" && data.duration) {
//         const log: CallLog = {
//           id: Date.now().toString(),
//           duration: data.duration,
//           time: new Date().toLocaleString(),
//         };

//         setLogs(prev => {
//           const updated = [log, ...prev];
//           AsyncStorage.setItem("logs", JSON.stringify(updated));
//           return updated;
//         });
//       }
//     });

//     return () => {
//       subscription.remove();
//       CallDetector.stopListening?.();
//     };
//   }, []);

//   const requestPermissions = async () => {
//     await PermissionsAndroid.requestMultiple([
//       PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
//       PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
//       PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
//     ]);
//   };

//   const loadLogs = async () => {
//     const saved = await AsyncStorage.getItem("logs");
//     if (saved) setLogs(JSON.parse(saved));
//   };

//   return (
//     <View style={styles.container}>
//       <Text style={styles.title}>📞 Call History</Text>
//       <FlatList
//         data={logs}
//         keyExtractor={item => item.id}
//         renderItem={({ item }) => (
//           <Text style={styles.logItem}>⏱ {item.duration}s — {item.time}</Text>
//         )}
//       />
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: { padding: 20 },
//   title: { fontSize: 22, fontWeight: "bold" },
//   logItem: { marginTop: 10 },
// });
