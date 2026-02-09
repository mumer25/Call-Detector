import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";

import { getLeadWithHistoryAndStatus } from "../db/database";
import { SafeAreaView } from "react-native-safe-area-context";

type TimelineLog = {
  id: string | number;
  number: string;
  type:
    | "incoming"
    | "outgoing"
    | "missed"
    | "whatsapp"
    | "followup"
    | "Call"
    | "Interested"
    | "Not Interested";
  duration: number;
  time: string;
};

type Props = {
  route: { params: { phone: string; leadName?: string } };
  onBack: () => void;
};

export default function TimelineScreen({ route, onBack }: Props) {
  const { phone } = route.params;
  const [leadName, setLeadName] = useState<string>(phone);
  const [logs, setLogs] = useState<TimelineLog[]>([]);
  const [loading, setLoading] = useState(true);

  /* ================= LOAD TIMELINE ================= */
  const loadTimeline = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getLeadWithHistoryAndStatus(phone);
      if (data) {
        setLeadName(data.lead.name || phone);

        const mappedLogs = data.history.map((log: any) => ({
          id: log.id,
          number: log.number,
          type: log.type,
          duration: log.duration || 0,
          time: log.time,
        }));

        setLogs(
          mappedLogs.sort(
            (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
          )
        );
      }
    } catch (e) {
      console.error("Failed to load timeline:", e);
    } finally {
      setLoading(false);
    }
  }, [phone]);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  /* ================= HELPERS ================= */
/* ================= HELPERS (REVISED) ================= */

const normalize = (type: any) => String(type || "").trim().toLowerCase();

const getIcon = (type: any) => {
  const t = normalize(type);

  switch (t) {
    case "1":
    case "incoming":
      return <Ionicons name="call" size={24} color="#2ecc71" />;
    case "2":
    case "outgoing":
    case "call":
    case "dialed": // Added to match your DB default
      return <Ionicons name="call-outline" size={24} color="#7f8c8d" />;
    case "3":
    case "missed":
      return <Ionicons name="call-outline" size={24} color="#e74c3c" />;
    case "whatsapp":
      return <Ionicons name="logo-whatsapp" size={24} color="#25D366" />;
    case "followup":
    case "follow-up":
      return <Ionicons name="calendar" size={24} color="#3498db" />;
    case "interested":
      return <Ionicons name="checkmark-circle" size={24} color="#2ecc71" />;
    case "not interested":
    case "not_interested":
      return <Ionicons name="close-circle" size={24} color="#e74c3c" />;
    default:
      return <Ionicons name="calendar-outline" size={24} color="#bdc3c7" />;
  }
};

const getBadgeColor = (type: any) => {
  const t = normalize(type); // CRITICAL: Added normalization here

  switch (t) {
    case "1":
    case "incoming":
    case "interested":
    case "whatsapp": 
      return "#2ecc71";
    case "3":
    case "missed":
    case "not interested":
    case "not_interested": 
      return "#e74c3c";
    case "followup":
    case "follow-up": 
      return "#3498db";
    default: 
      return "#7f8c8d";
  }
};

const getBadgeText = (type: any) => {
  const t = normalize(type);
  if (!t) return "Unknown";
  
  // Custom mapping for clean display text
  const mapping: Record<string, string> = {
    "1": "Incoming",
    "incoming": "Incoming",
    "2": "Call",
    "outgoing": "Call",
    "call": "Call",
    "dialed": "Call",
    "3": "Missed",
    "missed": "Missed",
    "whatsapp": "WhatsApp",
    "followup": "Follow-up",
    "follow-up": "Follow-up",
    "interested": "Interested",
    "not interested": "Not Interested",
    "not_interested": "Not Interested"
  };

  return mapping[t] || (t.charAt(0).toUpperCase() + t.slice(1));
};


  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatTime = (time: string) => {
    const d = new Date(time);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (time: string) => {
    const d = new Date(time);
    return d.toLocaleDateString();
  };

  /* ================= RENDER ================= */
  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <MaterialIcons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{leadName}</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#3b5353" style={styles.loader} />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* TIMELINE */}
          <View style={styles.timelineContainer}>
            {logs.length === 0 ? (
              <Text style={styles.emptyText}>No interaction history found.</Text>
            ) : (
              logs.map((log, index) => (
                <View key={log.id} style={styles.timelineRow}>
                  <View style={styles.leftColumn}>
                    <View style={styles.iconCircle}>{getIcon(log.type)}</View>
                    {index !== logs.length - 1 && <View style={styles.verticalLine} />}
                  </View>
                  <View style={styles.card}>
                    <View
                      style={[styles.statusBadge, { backgroundColor: getBadgeColor(log.type) }]}
                    >
                      <Text style={styles.statusBadgeText}>{getBadgeText(log.type)}</Text>
                    </View>
                    <Text style={styles.timeText}>
                      {formatTime(log.time)} | {formatDate(log.time)}
                    </Text>
                    {log.duration > 0 && (
                      <Text style={styles.noteText}>Duration: {formatDuration(log.duration)}</Text>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#d1e7e7" },
  header: {
    backgroundColor: "#1abc9c",
    paddingVertical: 15,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#fff",textAlign: "center", flex: 1 },

  scrollContent: { paddingBottom: 30 },
  loader: { marginTop: 50 },

  timelineContainer: { padding: 20, paddingTop: 20 },
  timelineRow: { flexDirection: "row", marginBottom: 30, minHeight: 80 },
  leftColumn: { width: 60, alignItems: "center" },
  verticalLine: {
    position: "absolute",
    top: 50,
    bottom: -30,
    width: 3,
    backgroundColor: "#3b5353",
    zIndex: 1,
  },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    zIndex: 2,
  },
  card: {
    flex: 1,
    backgroundColor: "#fff",
    marginLeft: 10,
    borderRadius: 15,
    paddingHorizontal: 18,
    paddingVertical: 15,
    elevation: 3,
  },
  statusBadge: {
    marginTop: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  statusBadgeText: { fontSize: 11, fontWeight: "600", color: "#fff" },
  timeText: { fontSize: 12, color: "#7f8c8d", marginTop: 4 },
  noteText: { marginTop: 6, color: "#555", fontSize: 14 },
  emptyText: { textAlign: "center", marginTop: 50, color: "#3b5353", fontSize: 16 },
});
