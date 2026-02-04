import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  Linking,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "react-native-vector-icons/Ionicons";

/* ================= TYPES ================= */

export type ReminderStatus = "Pending" | "Done";

export interface Reminder {
  id: string;
  name: string;
  phone: string;
  note: string;
  remindAt: string;
  status: ReminderStatus;
}

/* ================= SCREEN ================= */

export default function RemindersScreen() {
  const [reminders, setReminders] = useState<Reminder[]>([]);

  /* ================= HELPERS ================= */

  const normalizeReminder = (item: any): Reminder => ({
    id: String(item.id),
    name: String(item.name || ""),
    phone: String(item.phone || ""),
    note: String(item.note || ""),
    remindAt: String(item.remindAt || ""),
    status: item.status === "Done" ? "Done" : "Pending",
  });

  /* ================= LOAD REMINDERS ================= */

  const loadReminders = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem("reminders");
      if (!data) {
        setReminders([]);
        return;
      }

      const parsed = JSON.parse(data) as any[];
      const normalized = parsed.map(normalizeReminder);

      setReminders(normalized);
    } catch (err) {
      console.error("Failed to load reminders", err);
      setReminders([]);
    }
  }, []);

  useEffect(() => {
    loadReminders();
  }, [loadReminders]);

  /* ================= ACTIONS ================= */

 const markAsDone = async (id: string) => {
  const updated: Reminder[] = reminders.map((r) =>
    r.id === id ? { ...r, status: "Done" as ReminderStatus } : r
  );

  setReminders(updated);
  await AsyncStorage.setItem("reminders", JSON.stringify(updated));
};


  const makeCall = (phone: string) => {
    const url = `tel:${phone}`;
    Linking.openURL(url).catch(() =>
      Alert.alert("Error", "Unable to make call")
    );
  };

  /* ================= RENDER ITEM ================= */

  const renderItem = ({ item }: { item: Reminder }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.name}>{item.name || "Unknown"}</Text>
          <Text style={styles.phone}>{item.phone}</Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            item.status === "Done" && styles.statusDone,
          ]}
        >
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>

      <Text style={styles.note}>{item.note}</Text>
      <Text style={styles.time}>⏰ {item.remindAt}</Text>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => makeCall(item.phone)}
        >
          <Ionicons name="call" size={18} color="#1abc9c" />
          <Text style={styles.actionText}>Call</Text>
        </TouchableOpacity>

        {item.status === "Pending" && (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => markAsDone(item.id)}
          >
            <Ionicons name="checkmark-circle" size={18} color="#2ecc71" />
            <Text style={styles.actionText}>Done</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  /* ================= UI ================= */

  return (
    <View style={styles.container}>
      <FlatList
        data={reminders}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No reminders found</Text>
        }
      />
    </View>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#eef5f4",
  },

  listContent: {
    padding: 16,
    paddingBottom: 40,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    elevation: 3,
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  name: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2c3e50",
  },

  phone: {
    fontSize: 13,
    color: "#555",
    marginTop: 2,
  },

  statusBadge: {
    backgroundColor: "#f1c40f",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },

  statusDone: {
    backgroundColor: "#2ecc71",
  },

  statusText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },

  note: {
    marginTop: 10,
    fontSize: 14,
    color: "#333",
  },

  time: {
    marginTop: 6,
    fontSize: 12,
    color: "#888",
  },

  actions: {
    flexDirection: "row",
    marginTop: 12,
    gap: 20,
  },

  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  actionText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2c3e50",
  },

  emptyText: {
    textAlign: "center",
    marginTop: 40,
    fontSize: 15,
    color: "#777",
  },
});
