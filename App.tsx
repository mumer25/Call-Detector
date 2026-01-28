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
      <FlatList
        data={logs}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <Text style={styles.logItem}>⏱ {item.duration}s — {item.time}</Text>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  title: { fontSize: 22, fontWeight: "bold" },
  logItem: { marginTop: 10 },
});
