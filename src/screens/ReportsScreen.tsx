import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { Lead } from "../screens/LeadsScreen";
import { CallLog } from "../utils/CallRecorder";

export default function ReportsScreen() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [logs, setLogs] = useState<CallLog[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const leadsData = await AsyncStorage.getItem("leads");
      const logsData = await AsyncStorage.getItem("logs");
      if (leadsData) setLeads(JSON.parse(leadsData));
      if (logsData) setLogs(JSON.parse(logsData));
    };
    loadData();
  }, []);

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

//   const getLeadCalls = (phone: string) => {
//     const leadLogs = logs.filter((log) => log.number === phone);
//     const totalCalls = leadLogs.length;
//     const totalDuration = leadLogs.reduce((sum, log) => sum + (log.duration || 0), 0);
//     return { totalCalls, totalDuration };
//   };

const getLeadCalls = (phone: string) => {
  const leadLogs = logs.filter(
    (log) =>
      log.number === phone &&
      (log.type === "incoming" || log.type === "outgoing" || log.type === "missed")
  );

  const totalCalls = leadLogs.length;

  const totalDuration = leadLogs.reduce((sum, log) => sum + (log.duration || 0), 0);

  return { totalCalls, totalDuration };
};


  // Only leads with at least one call
  const leadsWithCalls = leads.filter((lead) => getLeadCalls(lead.phone).totalCalls > 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.heading}>Lead Reports</Text>

      {leadsWithCalls.map((lead) => {
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
      })}
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
  heading: {
    fontSize: 22,
    fontWeight: "700",
    color: "#2c3e50",
    marginBottom: 16,
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
});
