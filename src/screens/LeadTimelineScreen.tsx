import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from "react-native";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import { getLeads } from "../db/database";
import { SafeAreaView } from "react-native-safe-area-context";

type Lead = {
  id: number;
  name: string;
  phone: string;
};

type Props = {
  onOpenTimeline: (phone: string, name: string) => void;
};

export default function LeadsTimelineScreen({ onOpenTimeline }: Props) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const loadLeads = async () => {
      try {
        const data = await getLeads();
        setLeads(data);
        setFilteredLeads(data);
      } catch (e) {
        console.error("Failed to load leads:", e);
      } finally {
        setLoading(false);
      }
    };

    loadLeads();
  }, []);

  // Filter leads based on search
  useEffect(() => {
    const query = searchQuery.toLowerCase();
    const filtered = leads.filter(
      (lead) =>
        lead.name.toLowerCase().includes(query) ||
        lead.phone.includes(query)
    );
    setFilteredLeads(filtered);
  }, [searchQuery, leads]);

  return (
    <SafeAreaView style={styles.container}>
      {/* <Text style={styles.heading}>Leads Timeline</Text> */}

      {/* SEARCH BAR WITH ICON */}
      <View style={styles.searchContainer}>
        <TextInput
          placeholder="Search leads by name or phone..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
          clearButtonMode="while-editing"
        />
        <MaterialIcons
          name="search"
          size={24}
          color="#7f8c8d"
          style={styles.searchIcon}
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#3b5353" />
      ) : (
        <ScrollView>
          {filteredLeads.map((lead) => (
            <TouchableOpacity
              key={lead.id}
              style={styles.leadCard}
              onPress={() => onOpenTimeline(lead.phone, lead.name)}
            >
              <View style={styles.avatar}>
                <MaterialIcons name="person" size={26} color="#fff" />
              </View>

              <View style={styles.info}>
                <Text style={styles.name}>{lead.name}</Text>
                <Text style={styles.phone}>{lead.phone}</Text>
              </View>

              <MaterialIcons
                name="chevron-right"
                size={26}
                color="#7f8c8d"
              />
            </TouchableOpacity>
          ))}

          {filteredLeads.length === 0 && (
            <Text style={styles.emptyText}>No leads found</Text>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#d1e7e7", padding: 16 },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 10,
    color: "#2c3e50",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 12,
    paddingHorizontal: 12,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 8,
  },
  searchIcon: {
    marginLeft: 8,
  },
  leadCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    elevation: 3,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#1abc9c",
    justifyContent: "center",
    alignItems: "center",
  },
  info: { flex: 1, marginLeft: 12 },
  name: { fontSize: 16, fontWeight: "600", color: "#333" },
  phone: { fontSize: 13, color: "#7f8c8d", marginTop: 2 },
  emptyText: {
    textAlign: "center",
    marginTop: 50,
    color: "#7f8c8d",
  },
});
