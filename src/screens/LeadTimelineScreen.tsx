import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  TouchableOpacity,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import Ionicons from "react-native-vector-icons/Ionicons";

type CallLog = {
  id: string;
  number: string;
  type: "incoming" | "outgoing" | "whatsapp" | "followup";
  status?: string;
  time: string;
  note?: string;
};

type Props = {
  route: { params: { phone: string; leadName: string } };
  onBack: () => void;
};

export default function LeadTimelineScreen({ route, onBack }: Props) {
  const { phone, leadName } = route.params;
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Normalizes numbers to last 10 digits for matching
  const normalize = (num: string) => {
    const digits = num.replace(/\D/g, "");
    return digits.length > 10 ? digits.slice(-10) : digits;
  };

  const loadDataFromStorage = useCallback(async () => {
    setLoading(true);
    try {
      const savedLogs = await AsyncStorage.getItem("logs");
      let allLogs: CallLog[] = savedLogs ? JSON.parse(savedLogs) : [];

      // Generate dummy data if storage is completely empty (for initial testing)
      if (allLogs.length === 0) {
        allLogs = [
          { id: "1", number: "03229199459", type: "outgoing", status: "Answered", time: "10:30 AM", note: "Customer interested in premium plan." },
          { id: "2", number: "03229199459", type: "whatsapp", status: "Message Sent", time: "11:00 AM", note: "Sent the catalog." },
          { id: "3", number: "03001234567", type: "incoming", status: "Missed", time: "01:15 PM" },
        ];
        await AsyncStorage.setItem("logs", JSON.stringify(allLogs));
      }

      const targetPhone = normalize(phone);
      const filtered = allLogs.filter(log => normalize(log.number) === targetPhone);

      // Sort: Newest logs at top
      setLogs(filtered.reverse());
    } catch (e) {
      console.error("Timeline Load Error:", e);
    } finally {
      setLoading(false);
    }
  }, [phone]);

  useEffect(() => {
    loadDataFromStorage();
  }, [loadDataFromStorage]);

  const getIcon = (type: CallLog["type"]) => {
    switch (type) {
      case "whatsapp": return <FontAwesome name="whatsapp" size={24} color="#3b5353" />;
      case "followup": return <MaterialIcons name="event-note" size={24} color="#3b5353" />;
      default: return <Ionicons name="call-outline" size={24} color="#3b5353" />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER: Matching your dark teal screenshot */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.menuBtn}>
          <MaterialIcons name="menu" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{leadName || phone}</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#3b5353" style={styles.loader} />
      ) : (
        <ScrollView 
          contentContainerStyle={styles.timelineContainer}
          showsVerticalScrollIndicator={false}
        >
          {logs.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="history" size={80} color="#a0bcbc" />
              <Text style={styles.emptyText}>No interaction history found.</Text>
            </View>
          ) : (
            logs.map((item, index) => (
              <View key={item.id || index} style={styles.timelineRow}>
                {/* Vertical Spine and Icon */}
                <View style={styles.leftColumn}>
                  <View style={styles.iconCircle}>
                    {getIcon(item.type)}
                  </View>
                  {index !== logs.length - 1 && <View style={styles.verticalLine} />}
                </View>

                {/* Information Card */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>
                    {item.status || (item.type === "whatsapp" ? "WhatsApp" : "Call")}
                  </Text>
                  
                  <View style={styles.timeContainer}>
                    <Ionicons name="time-outline" size={14} color="#7f8c8d" />
                    <Text style={styles.timeText}>{item.time}</Text>
                  </View>

                  {item.note && (
                    <View style={styles.noteBox}>
                      <Text style={styles.noteText}>{item.note}</Text>
                    </View>
                  )}
                </View>
              </View>
            ))
          )}
          <View style={styles.footerSpacer} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#d1e7e7" },
  header: {
    backgroundColor: "#3b5353",
    height: 70,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    elevation: 5,
  },
  menuBtn: { padding: 5 },
  headerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
    marginLeft: 15,
  },
  loader: { marginTop: 100 },
  timelineContainer: { paddingHorizontal: 20, paddingTop: 30 },
  timelineRow: { flexDirection: "row", minHeight: 110 },
  leftColumn: { alignItems: "center", width: 60 },
  iconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
    elevation: 4,
  },
  verticalLine: {
    position: "absolute",
    top: 54,
    bottom: 0,
    width: 3,
    backgroundColor: "#3b5353",
    zIndex: 1,
  },
  card: {
    flex: 1,
    backgroundColor: "#fff",
    marginLeft: 15,
    marginBottom: 30,
    borderRadius: 15,
    padding: 18,
    elevation: 3,
  },
  cardTitle: { fontSize: 22, fontWeight: "bold", color: "#333" },
  timeContainer: { flexDirection: "row", alignItems: "center", marginTop: 5 },
  timeText: { fontSize: 13, color: "#7f8c8d", marginLeft: 5 },
  noteBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  noteText: { fontSize: 14, color: "#555", lineHeight: 20 },
  emptyContainer: { alignItems: "center", marginTop: 100 },
  emptyText: { marginTop: 15, color: "#3b5353", fontSize: 16, fontWeight: "500" },
  footerSpacer: { height: 100 },
});