import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Modal,
  Platform,
} from "react-native";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  getLeads,
  searchLeads,
} from "../db/database";

// ---------------- TYPES ----------------
export type Lead = {
  id: number;
  name: string;
  phone: string;
  status: string;
  assignee: string;
  source: string;
  city?: string;
  follow_up_date?: string;
};

type Props = {
  onSelectLead: (phone: string) => void;
  onOpenReport?: () => void;
  onOpenHistory?: () => void;
};

type FollowUpFilter = "none" | "pending" | "today" | "range";

// FollowUpState for badge logic
type FollowUpState = "pending" | "today" | "overdue" | "scheduled";

// ---------------- HELPERS ----------------
const toDateOnly = (iso: string): string => iso.slice(0, 10);

const todayStr = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const getFollowUpState = (lead: Lead): FollowUpState => {
  if (!lead.follow_up_date) return "pending";
  const d = toDateOnly(lead.follow_up_date);
  const today = todayStr();
  if (d === today) return "today";
  if (d < today) return "overdue";
  return "scheduled";
};

// Badge config per state
const BADGE_CONFIG: Record<FollowUpState, { bg: string; icon: string; label: string }> = {
  pending:   { bg: "#e67e22", icon: "schedule",        label: "Pending"   },
  overdue:   { bg: "#e74c3c", icon: "warning",         label: "Overdue"   },
  today:     { bg: "#27ae60", icon: "today",           label: "Today"     },
  scheduled: { bg: "#8e44ad", icon: "event-available", label: "Scheduled" },
};

// ---------------- CORNER BADGE ----------------
function FollowUpBadge({ state }: { state: FollowUpState }) {
  const cfg = BADGE_CONFIG[state];
  return (
    <View style={[badgeStyles.circle, { backgroundColor: cfg.bg }]}>
      <MaterialIcons name={cfg.icon as any} size={14} color="#fff" />
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  circle: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 24,
    height: 24,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 13,
    borderTopLeftRadius: 0,
    justifyContent: "center",
    alignItems: "center",
  },
});

// ---------------- DATE INPUT ----------------
function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShow(false);
    if (selectedDate) {
      const year = selectedDate.getFullYear();
      const month = (selectedDate.getMonth() + 1).toString().padStart(2, "0");
      const day = selectedDate.getDate().toString().padStart(2, "0");
      onChange(`${year}-${month}-${day}`);
    }
  };

  return (
    <View style={dateStyles.wrapper}>
      <Text style={dateStyles.label}>{label}</Text>
      <TouchableOpacity
        style={dateStyles.input}
        onPress={() => setShow(true)}
        activeOpacity={0.8}
      >
        <Text
          style={[
            dateStyles.dateText,
            value ? dateStyles.dateTextFilled : dateStyles.dateTextPlaceholder,
          ]}
        >
          {value || "Select Date"}
        </Text>
      </TouchableOpacity>
      {show && (
        <DateTimePicker
          value={value ? new Date(value) : new Date()}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onDateChange}
        />
      )}
    </View>
  );
}

const dateStyles = StyleSheet.create({
  wrapper: { marginBottom: 12 },
  label: { fontSize: 12, color: "#7f8c8d", marginBottom: 4, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: "#dcdcdc",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f9fafb",
  },
  dateText: { fontSize: 14 },
  dateTextFilled: { color: "#2c3e50" },
  dateTextPlaceholder: { color: "#aab" },
});

// ---------------- COMPONENT ----------------
export default function LeadsScreen({ onSelectLead }: Props) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [selectedFilter, setSelectedFilter] = useState<string>("All");

  // ---- Follow-up filter state ----
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [followUpFilter, setFollowUpFilter] = useState<FollowUpFilter>("none");
  const [rangeFrom, setRangeFrom] = useState<string>("");
  const [rangeTo, setRangeTo] = useState<string>("");
  // Applied values (only set when user taps Apply)
  const [appliedFollowUpFilter, setAppliedFollowUpFilter] = useState<FollowUpFilter>("none");
  const [appliedRangeFrom, setAppliedRangeFrom] = useState<string>("");
  const [appliedRangeTo, setAppliedRangeTo] = useState<string>("");

  const isFollowUpActive =
    appliedFollowUpFilter === "pending" ||
    appliedFollowUpFilter === "today" ||
    (appliedFollowUpFilter === "range" &&
      (appliedRangeFrom !== "" || appliedRangeTo !== ""));

  // ---------------- LOAD FROM DB ----------------
  const loadLeadsFromDB = useCallback(async () => {
    try {
      const savedLeads = await getLeads();
      setLeads(savedLeads);
    } catch (err) {
      console.error("Error loading leads:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // ---------------- INITIAL LOAD ----------------
  const hasAutoRefreshed = useRef(false);

  useEffect(() => {
    loadLeadsFromDB();
    if (!hasAutoRefreshed.current) {
      hasAutoRefreshed.current = true;
      const timer = setTimeout(async () => {
        setRefreshing(true);
        await loadLeadsFromDB();
        setRefreshing(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [loadLeadsFromDB]);

  // ---------------- REFRESH ----------------
  const refreshLeads = useCallback(async () => {
    setRefreshing(true);
    await loadLeadsFromDB();
    setRefreshing(false);
  }, [loadLeadsFromDB]);

  // ---------------- SEARCH HANDLER ----------------
  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (text.trim() === "") {
      await loadLeadsFromDB();
    } else {
      const results = await searchLeads(text);
      setLeads(results);
    }
  };

  // ---------------- APPLY FILTER ----------------
  const handleApplyFilter = () => {
    setAppliedFollowUpFilter(followUpFilter);
    setAppliedRangeFrom(rangeFrom);
    setAppliedRangeTo(rangeTo);
    setFilterModalVisible(false);
  };

  const handleClearFilter = () => {
    setFollowUpFilter("none");
    setRangeFrom("");
    setRangeTo("");
    setAppliedFollowUpFilter("none");
    setAppliedRangeFrom("");
    setAppliedRangeTo("");
    setFilterModalVisible(false);
  };

  const openFilterModal = () => {
    setFollowUpFilter(appliedFollowUpFilter);
    setRangeFrom(appliedRangeFrom);
    setRangeTo(appliedRangeTo);
    setFilterModalVisible(true);
  };

  // ---------------- FILTER + SEARCH COMBINED ----------------
  const filteredLeads = useMemo(() => {
    let filtered = leads;

    // Status filter
    if (selectedFilter === "Interested") {
      filtered = filtered.filter((lead) => lead.status?.startsWith("Interested"));
    } else if (selectedFilter === "Follow Up") {
      filtered = filtered.filter((lead) => lead.status?.startsWith("Follow Up"));
    } else if (selectedFilter === "Not Interested") {
      filtered = filtered.filter((lead) => lead.status === "Not Interested");
    } else if (selectedFilter === "Wrong Number") {
      filtered = filtered.filter((lead) => lead.status === "Wrong Number");
    }

    // Follow-up date filter
    if (appliedFollowUpFilter === "pending") {
      filtered = filtered.filter((lead) => !lead.follow_up_date);
    } else if (appliedFollowUpFilter === "today") {
      const today = todayStr();
      filtered = filtered.filter(
        (lead) => lead.follow_up_date && toDateOnly(lead.follow_up_date) === today
      );
    } else if (appliedFollowUpFilter === "range") {
      if (appliedRangeFrom || appliedRangeTo) {
        filtered = filtered.filter((lead) => {
          if (!lead.follow_up_date) return false;
          const d = toDateOnly(lead.follow_up_date);
          if (appliedRangeFrom && d < appliedRangeFrom) return false;
          if (appliedRangeTo && d > appliedRangeTo) return false;
          return true;
        });
      }
    }

    return filtered;
  }, [leads, selectedFilter, appliedFollowUpFilter, appliedRangeFrom, appliedRangeTo]);

  // ---------------- SOURCE ICON ----------------
  const renderSourceIcon = (source: Lead["source"]) => {
    switch (source) {
      case "fb":
        return <FontAwesome name="facebook" size={14} color="#1877F2" />;
      case "jd":
        return <MaterialIcons name="work" size={14} color="#2C3E50" />;
      case "web":
        return <MaterialIcons name="public" size={14} color="#27AE60" />;
      default:
        return <MaterialIcons name="help-outline" size={14} color="#7f8c8d" />;
    }
  };

  // ---------------- STATUS BADGE ----------------
  const renderStatusBadge = (status: Lead["status"]) => {
    let bgColor = "#ecf0f1";
    let textColor = "#7f8c8d";

    switch (status) {
      case "Open":
        bgColor = "#1abc9c33";
        textColor = "#1abc9c";
        break;
      case "OLD":
      case "Not Interested":
        bgColor = "#e74c3c33";
        textColor = "#e74c3c";
        break;
      case "Interested":
        bgColor = "#2ecc7133";
        textColor = "#2ecc71";
        break;
      case "Follow Up":
        bgColor = "#f1c40f33";
        textColor = "#f1c40f";
        break;
      case "Wrong Number":
        bgColor = "#95a5a633";
        textColor = "#7f8c8d";
        break;
      default:
        bgColor = "#1abc9c33";
        textColor = "#1abc9c";
    }

    return (
      <View style={[styles.statusBadge, { backgroundColor: bgColor }]}>
        <Text style={[styles.statusText, { color: textColor }]} numberOfLines={1}>
          {status}
        </Text>
      </View>
    );
  };

  const formatFollowUpDate = (isoString: string | undefined): string | null => {
    if (!isoString) return null;
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return null;
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const day = d.getDate().toString().padStart(2, "0");
    let hours = d.getHours();
    const mins = d.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    const hoursStr = hours.toString().padStart(2, "0");
    return `${year}-${month}-${day}, ${hoursStr}:${mins} ${ampm}`;
  };

  // active chip label helper
  const chipLabel = (): string => {
    if (appliedFollowUpFilter === "pending") return "Pending";
    if (appliedFollowUpFilter === "today") return "Today";
    return `${appliedRangeFrom || "…"} ${appliedRangeTo || "…"}`;
  };

  // ---------------- RENDER ----------------
  return (
    <View style={styles.container}>
      {/* SEARCH BAR + FILTER ICON */}
      <View style={styles.searchRow}>
        <View style={styles.searchWrapper}>
          <TextInput
            placeholder="Search by name or phone..."
            placeholderTextColor="#7f8c8d"
            style={styles.searchBar}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery.trim().length === 0 ? (
            <MaterialIcons
              name="search"
              size={22}
              color="#7f8c8d"
              style={styles.searchIcon}
            />
          ) : (
            <TouchableOpacity
              style={styles.clearIcon}
              onPress={() => handleSearch("")}
            >
              <MaterialIcons name="close" size={20} color="#7f8c8d" />
            </TouchableOpacity>
          )}
        </View>

        {/* FILTER BUTTON */}
        <TouchableOpacity
          style={[styles.filterIconBtn, isFollowUpActive && styles.filterIconBtnActive]}
          onPress={openFilterModal}
          activeOpacity={0.8}
        >
          <MaterialIcons
            name="tune"
            size={22}
            color={isFollowUpActive ? "#fff" : "#1abc9c"}
          />
          {isFollowUpActive && <View style={styles.filterDot} />}
        </TouchableOpacity>
      </View>

      {/* FILTER TABS */}
      <View style={styles.filterContainer}>
        {["All", "Interested", "Not Interested", "Wrong Number"].map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[
              styles.filterButton,
              selectedFilter === filter && styles.activeFilterButton,
            ]}
            onPress={() => setSelectedFilter(filter)}
          >
            <Text
              style={[
                styles.filterText,
                selectedFilter === filter && styles.activeFilterText,
              ]}
            >
              {filter}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1abc9c" />
          <Text style={styles.syncingText}>Loading leads...</Text>
        </View>
      ) : (
        <>
          {/* TOTAL LEADS */}
          <View style={styles.totalLeadsWrapper}>
            <MaterialIcons
              name="groups"
              size={22}
              color="#1abc9c"
              style={styles.totalLeadsIcon}
            />
            <Text style={styles.totalLeadsText}>
              Total Leads: {filteredLeads.length}
            </Text>
            {isFollowUpActive && (
              <TouchableOpacity onPress={handleClearFilter} style={styles.clearFilterChip}>
                <MaterialIcons name="event" size={12} color="#3498db" />
                <Text style={styles.clearFilterChipText}>{chipLabel()}</Text>
                <MaterialIcons name="close" size={12} color="#3498db" />
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={filteredLeads}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.list}
            refreshing={refreshing}
            onRefresh={refreshLeads}
            renderItem={({ item }) => {
              const fuState = getFollowUpState(item);
              return (
                <TouchableOpacity
                  style={styles.card}
                  onPress={() => onSelectLead(item.phone)}
                >
                  <FollowUpBadge state={fuState} />

                  <View style={styles.left}>
                    <View style={styles.nameRow}>
                      <Text style={styles.name} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <View style={styles.separatorLine} />
                      {renderSourceIcon(item.source)}
                    </View>
                    <Text style={styles.phone}>{item.phone || "N/A"}</Text>
                    {item.follow_up_date && (
                      <View style={styles.followUpContainer}>
                        <MaterialIcons name="calendar-today" size={10} color="#3498db" />
                        <Text style={styles.followUpText}>
                          {" "}
                          {formatFollowUpDate(item.follow_up_date)}
                        </Text>
                      </View>
                    )}
                    {item.city && <Text style={styles.city}>{item.city}</Text>}
                  </View>

                  <View style={styles.center}>
                    {renderStatusBadge(item.status)}
                  </View>

                  <View style={styles.right}>
                    <View style={styles.avatar}>
                      <MaterialIcons name="person" size={24} color="#fff" />
                    </View>
                    <Text style={styles.assignee}>{item.assignee || "-"}</Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </>
      )}

      {/* ============ FILTER MODAL ============ */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <TouchableOpacity
          style={modalStyles.overlay}
          activeOpacity={1}
          onPress={() => setFilterModalVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={modalStyles.sheet}
            onPress={() => {}}
          >
            {/* Header */}
            <View style={modalStyles.header}>
              <View style={modalStyles.headerLeft}>
                <MaterialIcons name="tune" size={20} color="#1abc9c" />
                <Text style={modalStyles.headerTitle}>Follow-Up Filter</Text>
              </View>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <MaterialIcons name="close" size={22} color="#7f8c8d" />
              </TouchableOpacity>
            </View>

            <View style={modalStyles.divider} />

            {/* Option: No filter */}
            <TouchableOpacity
              style={[
                modalStyles.optionRow,
                followUpFilter === "none" && modalStyles.optionRowActive,
              ]}
              onPress={() => setFollowUpFilter("none")}
              activeOpacity={0.8}
            >
              <View style={[modalStyles.radio, followUpFilter === "none" && modalStyles.radioActive]}>
                {followUpFilter === "none" && <View style={modalStyles.radioDot} />}
              </View>
              <View style={modalStyles.optionTextWrap}>
                <Text style={modalStyles.optionLabel}>All Leads</Text>
                <Text style={modalStyles.optionSub}>No date filter applied</Text>
              </View>
            </TouchableOpacity>

            {/* Option: Pending */}
            <TouchableOpacity
              style={[
                modalStyles.optionRow,
                followUpFilter === "pending" && modalStyles.optionRowActive,
              ]}
              onPress={() => setFollowUpFilter("pending")}
              activeOpacity={0.8}
            >
              <View style={[modalStyles.radio, followUpFilter === "pending" && modalStyles.radioActive]}>
                {followUpFilter === "pending" && <View style={modalStyles.radioDot} />}
              </View>
              <View style={modalStyles.optionTextWrap}>
                <View style={modalStyles.optionLabelRow}>
                  <Text style={modalStyles.optionLabel}>Pending Follow-Up</Text>
                  <View style={modalStyles.pendingBadge}>
                    <MaterialIcons name="schedule" size={10} color="#e67e22" />
                    <Text style={modalStyles.pendingBadgeText}>No date set</Text>
                  </View>
                </View>
                <Text style={modalStyles.optionSub}>
                  Leads with no follow-up date assigned yet
                </Text>
              </View>
            </TouchableOpacity>

            {/* Option: Today */}
            <TouchableOpacity
              style={[
                modalStyles.optionRow,
                followUpFilter === "today" && modalStyles.optionRowActive,
              ]}
              onPress={() => setFollowUpFilter("today")}
              activeOpacity={0.8}
            >
              <View style={[modalStyles.radio, followUpFilter === "today" && modalStyles.radioActive]}>
                {followUpFilter === "today" && <View style={modalStyles.radioDot} />}
              </View>
              <View style={modalStyles.optionTextWrap}>
                <View style={modalStyles.optionLabelRow}>
                  <Text style={modalStyles.optionLabel}>Today's Follow-Ups</Text>
                  <View style={modalStyles.todayBadge}>
                    <Text style={modalStyles.todayBadgeText}>{todayStr()}</Text>
                  </View>
                </View>
                <Text style={modalStyles.optionSub}>
                  Show only leads with follow-up scheduled today
                </Text>
              </View>
            </TouchableOpacity>

            {/* Option: Date Range */}
            <TouchableOpacity
              style={[
                modalStyles.optionRow,
                followUpFilter === "range" && modalStyles.optionRowActive,
              ]}
              onPress={() => setFollowUpFilter("range")}
              activeOpacity={0.8}
            >
              <View style={[modalStyles.radio, followUpFilter === "range" && modalStyles.radioActive]}>
                {followUpFilter === "range" && <View style={modalStyles.radioDot} />}
              </View>
              <View style={modalStyles.optionTextWrap}>
                <Text style={modalStyles.optionLabel}>Custom Date Range</Text>
                <Text style={modalStyles.optionSub}>
                  Filter follow-ups between two dates
                </Text>
              </View>
            </TouchableOpacity>

            {/* Date Range Inputs */}
            {followUpFilter === "range" && (
              <View style={modalStyles.rangeContainer}>
                <DateInput label="From Date" value={rangeFrom} onChange={setRangeFrom} />
                <DateInput label="To Date" value={rangeTo} onChange={setRangeTo} />
              </View>
            )}

            <View style={modalStyles.divider} />

            {/* Buttons */}
            <View style={modalStyles.buttonRow}>
              <TouchableOpacity style={modalStyles.clearBtn} onPress={handleClearFilter}>
                <Text style={modalStyles.clearBtnText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity style={modalStyles.applyBtn} onPress={handleApplyFilter}>
                <MaterialIcons name="check" size={16} color="#fff" />
                <Text style={modalStyles.applyBtnText}>Apply Filter</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ---------------- STYLES ----------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#eef5f4" },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 12,
    marginVertical: 10,
    gap: 8,
  },
  searchWrapper: { flex: 1, position: "relative" },
  searchBar: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: "#2c3e50",
    paddingRight: 40,
    elevation: 2,
  },
  searchIcon: { position: "absolute", right: 10, top: 10 },
  clearIcon: { position: "absolute", right: 10, top: 10 },

  filterIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
    borderWidth: 1.5,
    borderColor: "#1abc9c",
    position: "relative",
  },
  filterIconBtnActive: { backgroundColor: "#1abc9c", borderColor: "#1abc9c" },
  filterDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#e74c3c",
    borderWidth: 1.5,
    borderColor: "#fff",
  },

  filterContainer: {
    flexDirection: "row",
    paddingHorizontal: 10,
    marginBottom: 8,
    gap: 6,
  },
  filterButton: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dcdcdc",
  },
  activeFilterButton: { backgroundColor: "#1abc9c", borderColor: "#1abc9c" },
  filterText: { fontSize: 12, fontWeight: "600", color: "#7f8c8d" },
  activeFilterText: { color: "#fff" },

  totalLeadsWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: "#fff",
    borderRadius: 12,
    marginHorizontal: 12,
    marginBottom: 8,
    elevation: 2,
    flexDirection: "row",
    alignItems: "center",
  },
  totalLeadsIcon: { marginRight: 8 },
  totalLeadsText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2c3e50",
    flex: 1,
    textAlign: "center",
  },
  clearFilterChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ebf5fb",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 3,
    borderWidth: 1,
    borderColor: "#3498db44",
  },
  clearFilterChipText: {
    fontSize: 11,
    color: "#3498db",
    fontWeight: "600",
    maxWidth: 90,
  },

  list: { paddingHorizontal: 12, paddingBottom: 32 },

  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 8,
    elevation: 3,
    alignItems: "center",
    overflow: "hidden",
  },
  left: { flex: 3 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  separatorLine: { width: 1, height: 18, backgroundColor: "#7f8c8d" },
  name: { fontSize: 16, fontWeight: "700", color: "#2c3e50", width: 96 },
  phone: { fontSize: 14, color: "#7f8c8d", marginTop: 4 },
  city: { fontSize: 12, color: "#7f8c8d", marginTop: 2 },
  followUpContainer: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  followUpText: { fontSize: 10, color: "#3498db", fontWeight: "600" },
  center: { flex: 1, alignItems: "center" },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    alignSelf: "center",
    minWidth: 90,
    maxWidth: 120,
    marginRight: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  statusText: { fontSize: 12, fontWeight: "700" },
  right: { flex: 1, alignItems: "center" },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1abc9c",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  assignee: { fontSize: 12, color: "#34495e" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  syncingText: { color: "#1abc9c", marginTop: 10, fontSize: 12 },
});

// ---------------- MODAL STYLES ----------------
const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    elevation: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#2c3e50" },
  divider: { height: 1, backgroundColor: "#ecf0f1", marginVertical: 12 },

  optionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 6,
    backgroundColor: "#f8fffe",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  optionRowActive: { borderColor: "#1abc9c", backgroundColor: "#f0fdf9" },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#bdc3c7",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    marginTop: 2,
  },
  radioActive: { borderColor: "#1abc9c" },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#1abc9c" },
  optionTextWrap: { flex: 1 },
  optionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  optionLabel: { fontSize: 14, fontWeight: "600", color: "#2c3e50" },
  optionSub: { fontSize: 12, color: "#7f8c8d", marginTop: 2 },

  // pending badge (orange)
  pendingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#e67e2222",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pendingBadgeText: { fontSize: 10, color: "#e67e22", fontWeight: "700" },

  // today badge (green)
  todayBadge: {
    backgroundColor: "#1abc9c22",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  todayBadgeText: { fontSize: 11, color: "#1abc9c", fontWeight: "700" },

  rangeContainer: {
    backgroundColor: "#f8fffe",
    borderRadius: 14,
    padding: 14,
    marginBottom: 6,
    borderWidth: 1.5,
    borderColor: "#1abc9c44",
  },
  buttonRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  clearBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: "#ecf0f1",
    alignItems: "center",
  },
  clearBtnText: { fontSize: 14, fontWeight: "700", color: "#7f8c8d" },
  applyBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: "#1abc9c",
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  applyBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
});



// import React, { useEffect, useState, useCallback, useMemo, useRef  } from "react";
// import {
//   View,
//   Text,
//   FlatList,
//   TouchableOpacity,
//   StyleSheet,
//   TextInput,
//   ActivityIndicator,
// } from "react-native";
// import MaterialIcons from "react-native-vector-icons/MaterialIcons";
// import FontAwesome from "react-native-vector-icons/FontAwesome";
// import {
//   getLeads,
//   searchLeads,
// } from "../db/database";

// // ---------------- TYPES ----------------
// export type Lead = {
//   id: number;
//   name: string;
//   phone: string;
//   status: string;
//   assignee: string;
//   source: string;
//   city?: string;
//   follow_up_date?: string;
// };

// type Props = {
//   onSelectLead: (phone: string) => void;
//   onOpenReport?: () => void;
//   onOpenHistory?: () => void;
// };

// // ---------------- COMPONENT ----------------
// export default function LeadsScreen({ onSelectLead }: Props) {
//   const [leads, setLeads] = useState<Lead[]>([]);
//   const [searchQuery, setSearchQuery] = useState<string>("");
//   const [loading, setLoading] = useState<boolean>(true);
//   const [refreshing, setRefreshing] = useState<boolean>(false);
//   const [selectedFilter, setSelectedFilter] = useState<string>("All");

//   // ---------------- LOAD FROM DB ----------------
// const loadLeadsFromDB = useCallback(async () => {
//   try {
//     const savedLeads = await getLeads();
//     setLeads(savedLeads);
//   } catch (err) {
//     console.error("Error loading leads:", err);
//   } finally {
//     setLoading(false);
//     setRefreshing(false); // ✅ added
//   }
// }, []);

//   // ---------------- INITIAL LOAD ----------------
// const hasAutoRefreshed = useRef(false);

// // ---------------- INITIAL LOAD + ONE-TIME AUTO REFRESH ----------------
// useEffect(() => {
//   loadLeadsFromDB();

//   if (!hasAutoRefreshed.current) {
//     hasAutoRefreshed.current = true;
//     const timer = setTimeout(async () => {
//       setRefreshing(true);
//       await loadLeadsFromDB();
//       setRefreshing(false);
//     }, 3000);

//     return () => clearTimeout(timer);
//   }
// }, [loadLeadsFromDB]);

//   // ---------------- REFRESH ----------------
//   const refreshLeads = useCallback(async () => {
//     setRefreshing(true);
//     await loadLeadsFromDB();
//     setRefreshing(false);
//   }, [loadLeadsFromDB]);

//   // ---------------- SEARCH HANDLER ----------------
//   const handleSearch = async (text: string) => {
//     setSearchQuery(text);

//     if (text.trim() === "") {
//       await loadLeadsFromDB();
//     } else {
//       const results = await searchLeads(text);
//       setLeads(results);
//     }
//   };

//   // ---------------- FILTER + SEARCH COMBINED ----------------
//  const filteredLeads = useMemo(() => {
//   let filtered = leads;

//   if (selectedFilter === "Interested") {
//     filtered = filtered.filter((lead) =>
//       lead.status?.startsWith("Interested")
//     );
//   } else if (selectedFilter === "Follow Up") {
//     filtered = filtered.filter((lead) =>
//       lead.status?.startsWith("Follow Up")
//     );
//   } else if (selectedFilter === "Not Interested") {
//     filtered = filtered.filter((lead) => lead.status === "Not Interested");
//   } else if (selectedFilter === "Wrong Number") {
//     filtered = filtered.filter((lead) => lead.status === "Wrong Number");
//   }

//   return filtered;
// }, [leads, selectedFilter]);

//   // ---------------- SOURCE ICON ----------------
//   const renderSourceIcon = (source: Lead["source"]) => {
//     switch (source) {
//       case "fb":
//         return <FontAwesome name="facebook" size={14} color="#1877F2" />;
//       case "jd":
//         return <MaterialIcons name="work" size={14} color="#2C3E50" />;
//       case "web":
//         return <MaterialIcons name="public" size={14} color="#27AE60" />;
//       default:
//         return <MaterialIcons name="help-outline" size={14} color="#7f8c8d" />;
//     }
//   };

//   // ---------------- STATUS BADGE ----------------
//   const renderStatusBadge = (status: Lead["status"]) => {
//     let bgColor = "#ecf0f1";
//     let textColor = "#7f8c8d";

//     switch (status) {
//       case "Open":
//         bgColor = "#1abc9c33";
//         textColor = "#1abc9c";
//         break;
//       case "OLD":
//       case "Not Interested":
//         bgColor = "#e74c3c33";
//         textColor = "#e74c3c";
//         break;
//       case "Interested":
//         bgColor = "#2ecc7133";
//         textColor = "#2ecc71";
//         break;
//       case "Follow Up":
//         bgColor = "#f1c40f33";
//         textColor = "#f1c40f";
//         break;
//       case "Wrong Number":
//         bgColor = "#95a5a633";
//         textColor = "#7f8c8d";
//         break;
//       default:
//         bgColor = "#1abc9c33";
//         textColor = "#1abc9c";
//     }

//     return (
//       <View style={[styles.statusBadge, { backgroundColor: bgColor }]}>
//         <Text style={[styles.statusText, { color: textColor }]} numberOfLines={1}>
//           {status}
//         </Text>
//       </View>
//     );
//   };

//   const formatFollowUpDate = (isoString: string | undefined): string | null => {
//   if (!isoString) return null;
//   const d = new Date(isoString);
//   if (isNaN(d.getTime())) return null;
//   const year = d.getFullYear();
//   const month = (d.getMonth() + 1).toString().padStart(2, "0");
//   const day = d.getDate().toString().padStart(2, "0");
//   let hours = d.getHours();
//   const mins = d.getMinutes().toString().padStart(2, "0");
//   const ampm = hours >= 12 ? "PM" : "AM";
//   hours = hours % 12 || 12;
//   const hoursStr = hours.toString().padStart(2, "0");
//   return `${year}-${month}-${day}, ${hoursStr}:${mins} ${ampm}`;
// };

//   // ---------------- RENDER ----------------
//   return (
//     <View style={styles.container}>
//       {/* SEARCH BAR */}
//       <View style={styles.searchWrapper}>
//         <TextInput
//           placeholder="Search by name or phone..."
//           placeholderTextColor="#7f8c8d"
//           style={styles.searchBar}
//           value={searchQuery}
//           onChangeText={handleSearch}
//         />

//         {searchQuery.trim().length === 0 ? (
//           <MaterialIcons
//             name="search"
//             size={22}
//             color="#7f8c8d"
//             style={styles.searchIcon}
//           />
//         ) : (
//           <TouchableOpacity
//             style={styles.clearIcon}
//             onPress={() => handleSearch("")}
//           >
//             <MaterialIcons name="close" size={20} color="#7f8c8d" />
//           </TouchableOpacity>
//         )}
//       </View>

//       {/* FILTER TABS */}
//       <View style={styles.filterContainer}>
//         {["All", "Interested", "Not Interested", "Wrong Number"].map(
//           (filter) => (
//             <TouchableOpacity
//               key={filter}
//               style={[
//                 styles.filterButton,
//                 selectedFilter === filter && styles.activeFilterButton,
//               ]}
//               onPress={() => setSelectedFilter(filter)}
//             >
//               <Text
//                 style={[
//                   styles.filterText,
//                   selectedFilter === filter && styles.activeFilterText,
//                 ]}
//               >
//                 {filter}
//               </Text>
//             </TouchableOpacity>
//           )
//         )}
//       </View>

//       {loading ? (
//         <View style={styles.loadingContainer}>
//           <ActivityIndicator size="large" color="#1abc9c" />
//           <Text style={styles.syncingText}>Loading leads...</Text>
//         </View>
//       ) : (
//         <>
//           {/* TOTAL LEADS */}
//          <View style={styles.totalLeadsWrapper}>
//   <MaterialIcons name="groups" size={22} color="#1abc9c" style={styles.totalLeadsIcon} />
//   <Text style={styles.totalLeadsText}>
//     Total Leads: {filteredLeads.length}
//   </Text>
// </View>

//           <FlatList
//             data={filteredLeads}
//             keyExtractor={(item) => item.id.toString()}
//             contentContainerStyle={styles.list}
//             refreshing={refreshing}
//             onRefresh={refreshLeads}
//             renderItem={({ item }) => (
//               <TouchableOpacity
//                 style={styles.card}
//                 onPress={() => onSelectLead(item.phone)}
//               >
//                 <View style={styles.left}>
//                   <View style={styles.nameRow}>
//                     <Text style={styles.name} numberOfLines={1}>
//                       {item.name}
//                     </Text>
//                     <View style={styles.separatorLine} />
//                     {renderSourceIcon(item.source)}
//                   </View>
//                   <Text style={styles.phone}>{item.phone || "N/A"}</Text>
//                   {/* ✅ Follow-up date */}
// {item.follow_up_date && (
//   <View style={styles.followUpContainer}>
//     <MaterialIcons name="calendar-today" size={10} color="#3498db" />
//     <Text style={styles.followUpText}> {formatFollowUpDate(item.follow_up_date)}</Text>
//   </View>
// )}

// {item.city && <Text style={styles.city}>{item.city}</Text>}
//                   {item.city && <Text style={styles.city}>{item.city}</Text>}
//                 </View>

//                 <View style={styles.center}>
//                   {renderStatusBadge(item.status)}
//                 </View>

//                 <View style={styles.right}>
//                   <View style={styles.avatar}>
//                     <MaterialIcons name="person" size={24} color="#fff" />
//                   </View>
//                   <Text style={styles.assignee}>
//                     {item.assignee || "-"}
//                   </Text>
//                 </View>
//               </TouchableOpacity>
//             )}
//           />
//         </>
//       )}
//     </View>
//   );
// }

// // ---------------- STYLES ----------------
// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: "#eef5f4" },

//   searchWrapper: {
//     position: "relative",
//     marginHorizontal: 12,
//     marginVertical: 10,
//   },

//   searchBar: {
//     backgroundColor: "#fff",
//     borderRadius: 12,
//     paddingHorizontal: 16,
//     paddingVertical: 10,
//     fontSize: 14,
//     color: "#2c3e50",
//     paddingRight: 40,
//     elevation: 2,
//   },

//   searchIcon: { position: "absolute", right: 10, top: 10 },

//   clearIcon: { position: "absolute", right: 10, top: 10 },

//   filterContainer: {
//     flexDirection: "row",
//     paddingHorizontal: 10,
//     marginBottom: 8,
//     gap: 6,
//   },

//   filterButton: {
//     paddingHorizontal: 11,
//     paddingVertical: 6,
//     borderRadius: 20,
//     backgroundColor: "#fff",
//     borderWidth: 1,
//     borderColor: "#dcdcdc",
//   },

//   activeFilterButton: {
//     backgroundColor: "#1abc9c",
//     borderColor: "#1abc9c",
//   },

//   filterText: {
//     fontSize: 12,
//     fontWeight: "600",
//     color: "#7f8c8d",
//   },

//   activeFilterText: { color: "#fff" },

// totalLeadsWrapper: {
//   paddingHorizontal: 16,
//   paddingVertical: 3,
//   backgroundColor: "#fff",
//   borderRadius: 12,
//   marginHorizontal: 12,
//   marginBottom: 8,
//   elevation: 2,
//   flexDirection: "row",    // ✅ icon + text side by side
//   alignItems: "center",    // ✅ vertically centered
// },

// totalLeadsIcon: {
//   position: "absolute",    // ✅ icon pinned to left
//   left: 16,
// },

// totalLeadsText: {
//   fontSize: 14,
//   fontWeight: "700",
//   color: "#2c3e50",
//   flex: 1,                 // ✅ takes full width
//   textAlign: "center",     // ✅ text centered in remaining space
// },

//   list: { paddingHorizontal: 12, paddingBottom: 32 },

//   card: {
//     flexDirection: "row",
//     backgroundColor: "#fff",
//     paddingHorizontal: 16,
//     paddingVertical: 6,
//     borderRadius: 16,
//     marginBottom: 8,
//     elevation: 3,
//     alignItems: "center",
//   },

//   left: { flex: 3 },

//   nameRow: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 6,
//   },

//   separatorLine: {
//     width: 1,
//     height: 18,
//     backgroundColor: "#7f8c8d",
//   },

//   name: {
//     fontSize: 16,
//     fontWeight: "700",
//     color: "#2c3e50",
//     width: 96,
//   },

//   phone: {
//     fontSize: 14,
//     color: "#7f8c8d",
//     marginTop: 4,
//   },

//   city: {
//     fontSize: 12,
//     color: "#7f8c8d",
//     marginTop: 2,
//   },

//   followUpContainer: {
//   flexDirection: "row",
//   alignItems: "center",
//   marginTop: 2,
// },

// followUpText: {
//   fontSize: 10,
//   color: "#3498db",
//   fontWeight: "600",
// },

//   center: { flex: 1, alignItems: "center" },
  
//   statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16, alignSelf: "center", minWidth: 90, maxWidth: 120, marginRight: 26, alignItems: "center", justifyContent: "center" },

//   statusText: {
//     fontSize: 12,
//     fontWeight: "700",
//   },

//   right: { flex: 1, alignItems: "center" },

//   avatar: {
//     width: 40,
//     height: 40,
//     borderRadius: 20,
//     backgroundColor: "#1abc9c",
//     justifyContent: "center",
//     alignItems: "center",
//     marginBottom: 4,
//   },

//   assignee: {
//     fontSize: 12,
//     color: "#34495e",
//   },

//   loadingContainer: {
//     flex: 1,
//     justifyContent: "center",
//     alignItems: "center",
//   },

//   syncingText: {
//     color: "#1abc9c",
//     marginTop: 10,
//     fontSize: 12,
//   },
// });



// import React, { useEffect, useState, useCallback } from "react";
// import {
//   View,
//   Text,
//   FlatList,
//   TouchableOpacity,
//   StyleSheet,
//   TextInput,
//   ActivityIndicator,
// } from "react-native";
// import MaterialIcons from "react-native-vector-icons/MaterialIcons";
// import FontAwesome from "react-native-vector-icons/FontAwesome";
// import {
//   getLeads,
//   searchLeads,
// } from "../db/database";

// // ---------------- TYPES ----------------
// export type Lead = {
//   id: number;
//   name: string;
//   phone: string;
//   status: string;
//   assignee: string;
//   source: string;
//   city?: string;
// };

// type Props = {
//   onSelectLead: (phone: string) => void;
//   onOpenReport?: () => void;
//   onOpenHistory?: () => void;
// };

// // ---------------- COMPONENT ----------------
// export default function LeadsScreen({ onSelectLead }: Props) {
//   const [leads, setLeads] = useState<Lead[]>([]);
//   const [searchQuery, setSearchQuery] = useState<string>("");
//   const [loading, setLoading] = useState<boolean>(true);
//   const [refreshing, setRefreshing] = useState<boolean>(false);

//   // ---------------- LOAD FROM DB ----------------
//   const loadLeadsFromDB = useCallback(async () => {
//     try {
//       const savedLeads = await getLeads();
//       setLeads(savedLeads);
//     } catch (err) {
//       console.error("Error loading leads:", err);
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   // ---------------- INITIAL LOAD ----------------
//   useEffect(() => {
//     loadLeadsFromDB();
//   }, [loadLeadsFromDB]);

//   // ---------------- REFRESH (DB ONLY) ----------------
//   const refreshLeads = useCallback(async () => {
//     setRefreshing(true);
//     await loadLeadsFromDB();
//     setRefreshing(false);
//   }, [loadLeadsFromDB]);


//   //   // ---------------- INTERVAL REFRESH ----------------
//   useEffect(() => {
//   const timeout = setTimeout(() => {
//     refreshLeads(); // runs once after 10 sec
//   }, 3000); // 10000ms = 10 seconds

//   // Cleanup in case the screen unmounts before 10 sec
//   return () => clearTimeout(timeout);
// }, [refreshLeads]);

//   // ---------------- SEARCH HANDLER ----------------
//   const handleSearch = async (text: string) => {
//     setSearchQuery(text);

//     if (text.trim() === "") {
//       await loadLeadsFromDB();
//     } else {
//       const results = await searchLeads(text);
//       setLeads(results);
//     }
//   };

//   // ---------------- SOURCE ICON ----------------
//   const renderSourceIcon = (source: Lead["source"]) => {
//     switch (source) {
//       case "fb":
//         return <FontAwesome name="facebook" size={14} color="#1877F2" />;
//       case "jd":
//         return <MaterialIcons name="work" size={14} color="#2C3E50" />;
//       case "web":
//         return <MaterialIcons name="public" size={14} color="#27AE60" />;
//       default:
//         return <MaterialIcons name="help-outline" size={14} color="#7f8c8d" />;
//     }
//   };

//   // ---------------- STATUS BADGE ----------------
//   const renderStatusBadge = (status: Lead["status"]) => {
//     let bgColor = "#ecf0f1";
//     let textColor = "#7f8c8d";

//     switch (status) {
//       case "Open":
//         bgColor = "#1abc9c33";
//         textColor = "#1abc9c";
//         break;
//       case "OLD":
//       case "Not Interested":
//         bgColor = "#e74c3c33";
//         textColor = "#e74c3c";
//         break;
//       case "Interested":
//         bgColor = "#2ecc7133";
//         textColor = "#2ecc71";
//         break;
//       case "Follow Up":
//         bgColor = "#f1c40f33";
//         textColor = "#f1c40f";
//         break;
//       default:
//         bgColor = "#1abc9c33";
//         textColor = "#1abc9c";
//     }

//     return (
//       <View style={[styles.statusBadge, { backgroundColor: bgColor }]}>
//         <Text
//           style={[styles.statusText, { color: textColor }]}
//           numberOfLines={1}
//           ellipsizeMode="tail"
//         >
//           {status}
//         </Text>
//       </View>
//     );
//   };

//   // ---------------- RENDER ----------------
//   return (
//     <View style={styles.container}>
//       {/* SEARCH BAR */}
//       <View style={styles.searchWrapper}>
//         <TextInput
//           placeholder="Search by name or phone..."
//           placeholderTextColor="#7f8c8d"
//           style={styles.searchBar}
//           value={searchQuery}
//           onChangeText={handleSearch}
//         />

//         {searchQuery.trim().length === 0 ? (
//           <MaterialIcons
//             name="search"
//             size={22}
//             color="#7f8c8d"
//             style={styles.searchIcon}
//           />
//         ) : (
//           <TouchableOpacity
//             style={styles.clearIcon}
//             onPress={() => handleSearch("")}
//           >
//             <MaterialIcons name="close" size={20} color="#7f8c8d" />
//           </TouchableOpacity>
//         )}
//       </View>

//       {loading ? (
//         <View style={styles.loadingContainer}>
//           <ActivityIndicator size="large" color="#1abc9c" />
//           <Text style={styles.syncingText}>Loading leads...</Text>
//         </View>
//       ) : (
// <>
//          {/* TOTAL LEADS */}
//     <View style={styles.totalLeadsWrapper}>
//       <Text style={styles.totalLeadsText}>
//         Total Leads: {leads.length}
//       </Text>
//     </View>
//         <FlatList
//           data={leads}
//           keyExtractor={(item) => item.id.toString()}
//           contentContainerStyle={styles.list}
//           renderItem={({ item }) => (
//             <TouchableOpacity
//               style={styles.card}
//               onPress={() => onSelectLead(item.phone)}
//             >
//               <View style={styles.left}>
//                 <View style={styles.nameRow}>
//                   <Text
//                     style={styles.name}
//                     numberOfLines={1}
//                     ellipsizeMode="tail"
//                   >
//                     {item.name}
//                   </Text>
//                   <View style={styles.separatorLine} />
//                   {renderSourceIcon(item.source)}
//                 </View>
//                 <Text style={styles.phone}>{item.phone || "N/A"}</Text>
//                 {item.city ? (
//                   <Text style={styles.city}>{item.city}</Text>
//                 ) : null}
//               </View>

//               <View style={styles.center}>
//                 {renderStatusBadge(item.status)}
//               </View>

//               <View style={styles.right}>
//                 <View style={styles.avatar}>
//                   <MaterialIcons name="person" size={24} color="#fff" />
//                 </View>
//                 <Text style={styles.assignee}>
//                   {item.assignee || "-"}
//                 </Text>
//               </View>
//             </TouchableOpacity>
//           )}
//           refreshing={refreshing}
//           onRefresh={refreshLeads}
//         />
//         </>
//       )}
//     </View>
//   );
// }

// // ---------------- STYLES ----------------
// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: "#eef5f4" },
//   searchWrapper: { position: "relative", marginHorizontal: 12, marginVertical: 10 },
//   searchBar: {
//     backgroundColor: "#fff",
//     borderRadius: 12,
//     paddingHorizontal: 16,
//     paddingVertical: 10,
//     fontSize: 14,
//     color: "#2c3e50",
//     paddingRight: 40,
//     shadowColor: "#000",
//     shadowOpacity: 0.05,
//     shadowOffset: { width: 0, height: 2 },
//     shadowRadius: 4,
//     elevation: 2,
//   },
//   searchIcon: { position: "absolute", right: 10, top: 10 },
//   clearIcon: {
//   position: "absolute",
//   right: 10, // adjust so it doesn't overlap search icon
//   top: 10,
// },
//   list: { paddingHorizontal: 12, paddingBottom: 32 },
//   card: {
//     flexDirection: "row",
//     backgroundColor: "#fff",
//     paddingHorizontal: 16,
//     paddingVertical: 6,
//     borderRadius: 16,
//     marginBottom: 8,
//     shadowColor: "#000",
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.08,
//     shadowRadius: 6,
//     elevation: 3,
//     alignItems: "center",
//   },
//   left: { flex: 3 },
//   loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
//   nameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "nowrap" },
//   separatorLine: { width: 1, height: 18, backgroundColor: "#7f8c8d", alignSelf: "center" },
//   name: { fontSize: 16, fontWeight: "700", color: "#2c3e50", width: 96 },
//   phone: { fontSize: 14, color: "#7f8c8d", marginTop: 4 },
//   center: { flex: 1, alignItems: "center" },
//   statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16, alignSelf: "center", minWidth: 80, maxWidth: 120, marginRight: 26, alignItems: "center", justifyContent: "center" },
//   statusText: { fontSize: 12, fontWeight: "700", textAlign: "center", flexShrink: 1 },
//   right: { flex: 1, alignItems: "center" },
//   avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#1abc9c", justifyContent: "center", alignItems: "center", marginBottom: 4 },
//   assignee: { fontSize: 12, color: "#34495e" },
//   city: { fontSize: 12, color: "#7f8c8d", marginTop: 2 },
//   syncingOverlay: { position: "absolute", top: 60, left: 0, right: 0, alignItems: "center", zIndex: 10 },
//   syncingText: { color: "#1abc9c", marginTop: 10, fontSize: 12, fontWeight: "500" },

//   totalLeadsWrapper: {
//   paddingHorizontal: 16,
//   paddingVertical: 8,
//   backgroundColor: "#fff",
//   borderRadius: 12,
//   marginHorizontal: 12,
//   marginBottom: 8,
//   shadowColor: "#000",
//   shadowOpacity: 0.05,
//   shadowOffset: { width: 0, height: 2 },
//   shadowRadius: 4,
//   elevation: 2,
// },
// totalLeadsText: {
//   fontSize: 14,
//   fontWeight: "700",
//   color: "#2c3e50",
// },
// });


// import React, { useEffect, useState, useCallback } from "react";
// import {
//   View,
//   Text,
//   FlatList,
//   TouchableOpacity,
//   StyleSheet,
//   TextInput,
//   ActivityIndicator,
// } from "react-native";
// import MaterialIcons from "react-native-vector-icons/MaterialIcons";
// import FontAwesome from "react-native-vector-icons/FontAwesome";
// import {
//   initDB,
//   getLeads,
//   searchLeads,
//   insertLead,
//   getLoggedInUser,
// } from "../db/database";

// // ---------------- TYPES ----------------
// export type Lead = {
//   id: number;
//   name: string;
//   phone: string;
//   status: string;
//   assignee: string;
//   source: string;
//   city?: string;
// };

// type Props = {
//   onSelectLead: (phone: string) => void;
//   onOpenReport?: () => void;
//   onOpenHistory?: () => void;
// };

// // ---------------- COMPONENT ----------------
// export default function LeadsScreen({ onSelectLead }: Props) {
//   const [leads, setLeads] = useState<Lead[]>([]);
//   const [searchQuery, setSearchQuery] = useState<string>("");
//   const [loading, setLoading] = useState<boolean>(true);
//   const [syncing, setSyncing] = useState<boolean>(false);
//   const [hasLocalLeads, setHasLocalLeads] = useState<boolean>(false);
//   const [refreshing, setRefreshing] = useState<boolean>(false);

//   // ---------------- MAP SOURCE ----------------
//   const mapLeadSource = useCallback((source: string): "fb" | "jd" | "web" => {
//     if (!source) return "web";
//     source = source.toLowerCase();
//     if (source.includes("facebook")) return "fb";
//     if (source.includes("dealer") || source.includes("jd")) return "jd";
//     return "web";
//   }, []);

//   // ---------------- FETCH API & STORE ----------------
//   const fetchAndUpdateLeads = useCallback(async () => {
//     try {
//       setSyncing(true);
//       const user = await getLoggedInUser();
//       if (!user?.entity_id) return;

//       let offset = 0;
//       const limit = 25;
//       let hasMore = true;

//       while (hasMore) {
//         const url = `https://server103.multi-techno.com:8383/ords/ard_holdings/crm_app/get_leads_data?entity_id=${user.entity_id}&offset=${offset}&limit=${limit}`;
//         const response = await fetch(url);
//         if (!response.ok) throw new Error("Failed to fetch leads");

//         const data = await response.json();
//         const items = data.items || [];

//         for (const lead of items) {
//           await insertLead(
//             lead.lead_id,
//             lead.name || "Unknown",
//             lead.phone?.trim() || "N/A",
//             lead.status || "-",
//             lead.assignee || "-",
//             mapLeadSource(lead.lead_source)
//           );
//         }

//         hasMore = data.hasMore || false;
//         offset += limit;
//       }

//       // Reload from DB and update state
//       const updatedLeads = await getLeads();
//       setLeads(updatedLeads);
//       setHasLocalLeads(updatedLeads.length > 0);
//     } catch (err) {
//       console.error("Error syncing leads:", err);
//     } finally {
//       setLoading(false);
//       setSyncing(false);
//     }
//   }, [mapLeadSource]);

//   // ---------------- LOAD FROM DB ----------------
//   const loadLeadsFromDB = useCallback(async () => {
//     try {
//       const savedLeads = await getLeads();
//       setLeads(savedLeads);
//       setHasLocalLeads(savedLeads.length > 0);
//     } catch (err) {
//       console.error("Error loading leads from DB:", err);
//     }
//   }, []);

//   // ---------------- REFRESH FUNCTION ----------------
//   const refreshLeads = useCallback(async () => {
//     setRefreshing(true);
//     await loadLeadsFromDB(); // load latest from DB
//     setRefreshing(false);
//   }, [loadLeadsFromDB]);

//   // ---------------- INITIAL LOAD ----------------
//   useEffect(() => {
//     (async () => {
//       await initDB();

//       // Load DB leads first
//       await loadLeadsFromDB();

//       // Show loader only if no local leads
//       if (!hasLocalLeads) setLoading(true);

//       // Fetch latest leads in background
//       await fetchAndUpdateLeads();
//     })();
//   }, [loadLeadsFromDB, fetchAndUpdateLeads, hasLocalLeads]);

//   // ---------------- AUTO REFRESH ON SCREEN OPEN ----------------
//   useEffect(() => {
//     refreshLeads();
//   }, [refreshLeads]);

//   // ---------------- INTERVAL REFRESH ----------------
//   useEffect(() => {
//   const timeout = setTimeout(() => {
//     refreshLeads(); // runs once after 10 sec
//   }, 1000); // 10000ms = 10 seconds

//   // Cleanup in case the screen unmounts before 10 sec
//   return () => clearTimeout(timeout);
// }, [refreshLeads]);

//   // ---------------- SEARCH HANDLER ----------------
//   const handleSearch = async (text: string) => {
//     setSearchQuery(text);
//     if (text.trim() === "") {
//       await loadLeadsFromDB();
//     } else {
//       const results = await searchLeads(text);
//       setLeads(results);
//     }
//   };

//   // ---------------- RENDER ICONS & BADGES ----------------
//   const renderSourceIcon = (source: Lead["source"]) => {
//     switch (source) {
//       case "fb":
//         return <FontAwesome name="facebook" size={14} color="#1877F2" />;
//       case "jd":
//         return <MaterialIcons name="work" size={14} color="#2C3E50" />;
//       case "web":
//         return <MaterialIcons name="public" size={14} color="#27AE60" />;
//       default:
//         return <MaterialIcons name="help-outline" size={14} color="#7f8c8d" />;
//     }
//   };

//   const renderStatusBadge = (status: Lead["status"]) => {
//     let bgColor = "#ecf0f1";
//     let textColor = "#7f8c8d";

//     switch (status) {
//       case "New Lead":
//         bgColor = "#1abc9c33";
//         textColor = "#1abc9c";
//         break;
//        case "OLD Lead":
//         bgColor = "#e74c3c33";
//         textColor = "#e74c3c";
//         break;
//       case "Not Interested":
//         bgColor = "#e74c3c33";
//         textColor = "#e74c3c";
//         break;
//       case "Interested":
//         bgColor = "#2ecc7133";
//         textColor = "#2ecc71";
//         break;
//       case "Follow Up":
//         bgColor = "#f1c40f33";
//         textColor = "#f1c40f";
//         break;
//       default:
//         bgColor = "#1abc9c33";
//         textColor = "#1abc9c";
//     }

//     return (
//       <View style={[styles.statusBadge, { backgroundColor: bgColor }]}>
//         <Text style={[styles.statusText, { color: textColor }]} numberOfLines={1} ellipsizeMode="tail">
//           {status}
//         </Text>
//       </View>
//     );
//   };

//   // ---------------- RENDER ----------------
//   return (
//     <View style={styles.container}>
//       {/* SEARCH BAR */}
//    <View style={styles.searchWrapper}>
//   <TextInput
//     placeholder="Search by name or phone..."
//     placeholderTextColor="#7f8c8d"
//     style={styles.searchBar}
//     value={searchQuery}
//     onChangeText={handleSearch}
//   />

//   {/* ICONS */}
//   {searchQuery.trim().length === 0 ? (
//     // Show search icon only when search is empty
//     <MaterialIcons name="search" size={22} color="#7f8c8d" style={styles.searchIcon} />
//   ) : (
//     // Show cross icon only when there is text
//     <TouchableOpacity
//       style={styles.clearIcon}
//       onPress={() => handleSearch("")} // reset search
//     >
//       <MaterialIcons name="close" size={20} color="#7f8c8d" />
//     </TouchableOpacity>
//   )}
// </View>


//       {loading && !hasLocalLeads ? (
//         <View style={styles.loadingContainer}>
//           <ActivityIndicator size="large" color="#1abc9c" />
//           <Text style={styles.syncingText}>Loading leads...</Text>
//         </View>
//       ) : (
//         <>
//           {syncing && (
//             <View style={styles.syncingOverlay}>
//               {/* optional syncing indicator */}
//             </View>
//           )}
//           <FlatList
//             data={leads}
//             keyExtractor={(item) => item.id.toString()}
//             contentContainerStyle={styles.list}
//             renderItem={({ item }) => (
//               <TouchableOpacity style={styles.card} onPress={() => onSelectLead(item.phone)}>
//                 <View style={styles.left}>
//                   <View style={styles.nameRow}>
//                     <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">{item.name}</Text>
//                     <View style={styles.separatorLine} />
//                     {renderSourceIcon(item.source)}
//                   </View>
//                   <Text style={styles.phone}>{item.phone || "N/A"}</Text>
//                   {item.city ? <Text style={styles.city}>{item.city}</Text> : null}
//                 </View>
//                 <View style={styles.center}>{renderStatusBadge(item.status)}</View>
//                 <View style={styles.right}>
//                   <View style={styles.avatar}>
//                     <MaterialIcons name="person" size={24} color="#fff" />
//                   </View>
//                   <Text style={styles.assignee}>{item.assignee || "-"}</Text>
//                 </View>
//               </TouchableOpacity>
//             )}
//             refreshing={refreshing}
//             onRefresh={refreshLeads}
//           />
//         </>
//       )}
//     </View>
//   );
// }

// // ---------------- STYLES ----------------
// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: "#eef5f4" },
//   searchWrapper: { position: "relative", marginHorizontal: 12, marginVertical: 10 },
//   searchBar: {
//     backgroundColor: "#fff",
//     borderRadius: 12,
//     paddingHorizontal: 16,
//     paddingVertical: 10,
//     fontSize: 14,
//     color: "#2c3e50",
//     paddingRight: 40,
//     shadowColor: "#000",
//     shadowOpacity: 0.05,
//     shadowOffset: { width: 0, height: 2 },
//     shadowRadius: 4,
//     elevation: 2,
//   },
//   searchIcon: { position: "absolute", right: 18, top: 10 },
//   clearIcon: {
//   position: "absolute",
//   right: 18, // adjust so it doesn't overlap search icon
//   top: 10,
// },
//   list: { paddingHorizontal: 12, paddingBottom: 32 },
//   card: {
//     flexDirection: "row",
//     backgroundColor: "#fff",
//     paddingHorizontal: 16,
//     paddingVertical: 6,
//     borderRadius: 16,
//     marginBottom: 8,
//     shadowColor: "#000",
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.08,
//     shadowRadius: 6,
//     elevation: 3,
//     alignItems: "center",
//   },
//   left: { flex: 3 },
//   loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
//   nameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "nowrap" },
//   separatorLine: { width: 1, height: 18, backgroundColor: "#7f8c8d", alignSelf: "center" },
//   name: { fontSize: 16, fontWeight: "700", color: "#2c3e50", width: 96 },
//   phone: { fontSize: 14, color: "#7f8c8d", marginTop: 4 },
//   center: { flex: 1, alignItems: "center" },
//   statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16, alignSelf: "center", minWidth: 80, maxWidth: 120, marginRight: 26, alignItems: "center", justifyContent: "center" },
//   statusText: { fontSize: 12, fontWeight: "700", textAlign: "center", flexShrink: 1 },
//   right: { flex: 1, alignItems: "center" },
//   avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#1abc9c", justifyContent: "center", alignItems: "center", marginBottom: 4 },
//   assignee: { fontSize: 12, color: "#34495e" },
//   city: { fontSize: 12, color: "#7f8c8d", marginTop: 2 },
//   syncingOverlay: { position: "absolute", top: 60, left: 0, right: 0, alignItems: "center", zIndex: 10 },
//   syncingText: { color: "#1abc9c", marginTop: 10, fontSize: 12, fontWeight: "500" },
// });



// import React, { useEffect, useState, useCallback } from "react";
// import {
//   View,
//   Text,
//   FlatList,
//   TouchableOpacity,
//   StyleSheet,
//   TextInput,
//   ActivityIndicator,
// } from "react-native";
// import MaterialIcons from "react-native-vector-icons/MaterialIcons";
// import FontAwesome from "react-native-vector-icons/FontAwesome";
// import {
//   initDB,
//   getLeads,
//   searchLeads,
//   insertLead,
//   getLoggedInUser,
// } from "../db/database";

// // ---------------- TYPES ----------------
// export type Lead = {
//   id: number;
//   name: string;
//   phone: string;
//   status: string;
//   assignee: string;
//   source: string;
//   city?: string;
// };

// type Props = {
//   onSelectLead: (phone: string) => void;
//   onOpenReport?: () => void;
//   onOpenHistory?: () => void;
// };

// // ---------------- COMPONENT ----------------
// export default function LeadsScreen({ onSelectLead }: Props) {
//   const [leads, setLeads] = useState<Lead[]>([]);
//   const [searchQuery, setSearchQuery] = useState<string>("");
//   const [loading, setLoading] = useState<boolean>(true);
//   const [syncing, setSyncing] = useState<boolean>(false);
//   const [hasLocalLeads, setHasLocalLeads] = useState<boolean>(false);
//   const [refreshing, setRefreshing] = useState<boolean>(false);


//   // ---------------- MAP SOURCE ----------------
//   const mapLeadSource = useCallback((source: string): "fb" | "jd" | "web" => {
//     if (!source) return "web";
//     source = source.toLowerCase();
//     if (source.includes("facebook")) return "fb";
//     if (source.includes("dealer") || source.includes("jd")) return "jd";
//     return "web";
//   }, []);

//   // ---------------- FETCH API & STORE ----------------
// const fetchAndUpdateLeads = useCallback(async () => {
//   try {
//     setSyncing(true);
//     const user = await getLoggedInUser();
//     if (!user?.entity_id) return;

//     let offset = 0;
//     const limit = 25;
//     let hasMore = true;

//     while (hasMore) {
//       const url = `https://server103.multi-techno.com:8383/ords/ard_holdings/crm_app/get_leads_data?entity_id=${user.entity_id}&offset=${offset}&limit=${limit}`;
//       const response = await fetch(url);
//       if (!response.ok) throw new Error("Failed to fetch leads");

//       const data = await response.json();
//       const items = data.items || [];

//       for (const lead of items) {
//         await insertLead(
//           lead.lead_id,
//           lead.name || "Unknown",
//           lead.phone?.trim() || "N/A",
//           lead.last_task_name || "-",
//           lead.assignee || "-",
//           mapLeadSource(lead.lead_source)
//         );
//       }

//       hasMore = data.hasMore || false;
//       offset += limit;
//     }

//     // Reload from DB and update state
//     const updatedLeads = await getLeads();
//     setLeads(updatedLeads);
//     setHasLocalLeads(updatedLeads.length > 0); // DB now has leads
//   } catch (err) {
//     console.error("Error syncing leads:", err);
//   } finally {
//     setLoading(false); // stop initial loader
//     setSyncing(false);
//   }
// }, [mapLeadSource]);


//   // ---------------- LOAD FROM DB ----------------
// const loadLeadsFromDB = useCallback(async () => {
//   try {
//     const savedLeads = await getLeads();
//     setLeads(savedLeads);
//     setHasLocalLeads(savedLeads.length > 0); // true if DB has leads
//   } catch (err) {
//     console.error("Error loading leads from DB:", err);
//   }
// }, []);


// const refreshLeads = useCallback(async () => {
//   setRefreshing(true);
//   await loadLeadsFromDB(); // load latest from DB
//   setRefreshing(false);
// }, [loadLeadsFromDB]);


// useEffect(() => {
//   const interval = setInterval(() => {
//     refreshLeads();
//   }, 30000); // refresh every 30 seconds

//   return () => clearInterval(interval); // cleanup
// }, [refreshLeads]);


//   // ---------------- INITIAL LOAD ----------------
//   useEffect(() => {
//   (async () => {
//     await initDB();

//     // Load from DB first
//     await loadLeadsFromDB();

//     // Show loader only if no local leads
//     if (!hasLocalLeads) setLoading(true);

//     // Fetch new leads in background
//     await fetchAndUpdateLeads();
//   })();
// }, [loadLeadsFromDB, fetchAndUpdateLeads, hasLocalLeads]);


//   // ---------------- SEARCH HANDLER ----------------
//   const handleSearch = async (text: string) => {
//     setSearchQuery(text);
//     if (text.trim() === "") {
//       await loadLeadsFromDB();
//     } else {
//       const results = await searchLeads(text);
//       setLeads(results);
//     }
//   };

//   // ---------------- RENDER ICONS & BADGES ----------------
//   const renderSourceIcon = (source: Lead["source"]) => {
//     switch (source) {
//       case "fb":
//         return <FontAwesome name="facebook" size={14} color="#1877F2" />;
//       case "jd":
//         return <MaterialIcons name="work" size={14} color="#2C3E50" />;
//       case "web":
//         return <MaterialIcons name="public" size={14} color="#27AE60" />;
//       default:
//         return <MaterialIcons name="help-outline" size={14} color="#7f8c8d" />;
//     }
//   };

//   const renderStatusBadge = (status: Lead["status"]) => {
//     let bgColor = "#ecf0f1";
//     let textColor = "#7f8c8d";

//     switch (status) {
//       case "New Lead":
//         bgColor = "#1abc9c33";
//         textColor = "#1abc9c";
//         break;
//       case "OLD Lead":
//         bgColor = "#e74c3c33";
//         textColor = "#e74c3c";
//         break;
//       case "Not Interested":
//         bgColor = "#e74c3c33";
//         textColor = "#e74c3c";
//         break;
//       case "Interested":
//         bgColor = "#2ecc7133";
//         textColor = "#2ecc71";
//         break;
//       case "Follow Up":
//         bgColor = "#f1c40f33";
//         textColor = "#f1c40f";
//         break;
//       default:
//         bgColor = "#1abc9c33";
//         textColor = "#1abc9c";
//     }

//     return (
//       <View style={[styles.statusBadge, { backgroundColor: bgColor }]}>
//         <Text style={[styles.statusText, { color: textColor }]} numberOfLines={1} ellipsizeMode="tail">
//           {status}
//         </Text>
//       </View>
//     );
//   };

//   // ---------------- RENDER ----------------
//   return (
//     <View style={styles.container}>
//       {/* SEARCH BAR */}
//       <View style={styles.searchWrapper}>
//         <TextInput
//           placeholder="Search by name or phone..."
//           placeholderTextColor="#7f8c8d"
//           style={styles.searchBar}
//           value={searchQuery}
//           onChangeText={handleSearch}
//         />
//         <MaterialIcons name="search" size={22} color="#7f8c8d" style={styles.searchIcon} />
//       </View>

//       {loading && !hasLocalLeads ? (
//         <View style={styles.loadingContainer}>
//           <ActivityIndicator size="large" color="#1abc9c" />
//           <Text style={styles.syncingText}>Loading leads...</Text>
//         </View>
//       ) : (
//         <>
//           {syncing && (
//             <View style={styles.syncingOverlay}>
//               {/* <ActivityIndicator size="small" color="#1abc9c" />
//               <Text style={styles.syncingText}>Loading leads...</Text> */}
//             </View>
//           )}
//           <FlatList
//             data={leads}
//             keyExtractor={(item) => item.id.toString()}
//             contentContainerStyle={styles.list}
//             renderItem={({ item }) => (
//               <TouchableOpacity style={styles.card} onPress={() => onSelectLead(item.phone)}>
//                 <View style={styles.left}>
//                   <View style={styles.nameRow}>
//                     <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">{item.name}</Text>
//                     <View style={styles.separatorLine} />
//                     {renderSourceIcon(item.source)}
//                   </View>
//                   <Text style={styles.phone}>{item.phone || "N/A"}</Text>
//                   {item.city ? <Text style={styles.city}>{item.city}</Text> : null}
//                 </View>
//                 <View style={styles.center}>{renderStatusBadge(item.status)}</View>
//                 <View style={styles.right}>
//                   <View style={styles.avatar}>
//                     <MaterialIcons name="person" size={24} color="#fff" />
//                   </View>
//                   <Text style={styles.assignee}>{item.assignee || "-"}</Text>
//                 </View>
//               </TouchableOpacity>
//             )}
//              refreshing={refreshing}
//              onRefresh={refreshLeads} 
//           />
//         </>
//       )}
//     </View>
//   );
// }

// // ---------------- STYLES ----------------
// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: "#eef5f4" },
//   searchWrapper: { position: "relative", marginHorizontal: 12, marginVertical: 10 },
//   searchBar: {
//     backgroundColor: "#fff",
//     borderRadius: 12,
//     paddingHorizontal: 16,
//     paddingVertical: 10,
//     fontSize: 14,
//     color: "#2c3e50",
//     paddingRight: 40,
//     shadowColor: "#000",
//     shadowOpacity: 0.05,
//     shadowOffset: { width: 0, height: 2 },
//     shadowRadius: 4,
//     elevation: 2,
//   },
//   searchIcon: { position: "absolute", right: 18, top: 10 },
//   list: { paddingHorizontal: 12, paddingBottom: 32 },
//   card: {
//     flexDirection: "row",
//     backgroundColor: "#fff",
//     paddingHorizontal: 16,
//     paddingVertical: 6,
//     borderRadius: 16,
//     marginBottom: 8,
//     shadowColor: "#000",
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.08,
//     shadowRadius: 6,
//     elevation: 3,
//     alignItems: "center",
//   },
//   left: { flex: 3 },
//   loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
//   nameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "nowrap" },
//   separatorLine: { width: 1, height: 18, backgroundColor: "#7f8c8d", alignSelf: "center" },
//   name: { fontSize: 16, fontWeight: "700", color: "#2c3e50", width: 96 },
//   phone: { fontSize: 14, color: "#7f8c8d", marginTop: 4 },
//   center: { flex: 1, alignItems: "center" },
//   statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16, alignSelf: "center", minWidth: 80, maxWidth: 120, marginRight: 26, alignItems: "center", justifyContent: "center" },
//   statusText: { fontSize: 12, fontWeight: "700", textAlign: "center", flexShrink: 1 },
//   right: { flex: 1, alignItems: "center" },
//   avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#1abc9c", justifyContent: "center", alignItems: "center", marginBottom: 4 },
//   assignee: { fontSize: 12, color: "#34495e" },
//   city: { fontSize: 12, color: "#7f8c8d", marginTop: 2 },
//   syncingOverlay: {
//     position: "absolute",
//     top: 60,
//     left: 0,
//     right: 0,
//     alignItems: "center",
//     zIndex: 10,
//   },
//   syncingText: {
//   color: "#1abc9c",
//   marginTop: 10,
//   fontSize: 12,
//   fontWeight: "500",
// },

// });




// import React, { useEffect, useState, useCallback } from "react";
// import {
//   View,
//   Text,
//   FlatList,
//   TouchableOpacity,
//   StyleSheet,
//   TextInput,
//   ActivityIndicator,
// } from "react-native";
// import MaterialIcons from "react-native-vector-icons/MaterialIcons";
// import FontAwesome from "react-native-vector-icons/FontAwesome";
// import {
//   initDB,
//   getLeads,
//   searchLeads,
//   insertLead,
//   getLoggedInUser,
// } from "../db/database";

// // ---------------- TYPES ----------------
// export type Lead = {
//   id: number;
//   name: string;
//   phone: string;
//   status: string;
//   assignee: string;
//   source: string;
//   city?: string;
// };

// type Props = {
//   onSelectLead: (phone: string) => void;
//   onOpenReport?: () => void;
//   onOpenHistory?: () => void;
// };

// // ---------------- COMPONENT ----------------
// export default function LeadsScreen({ onSelectLead }: Props) {
//   const [leads, setLeads] = useState<Lead[]>([]);
//   const [searchQuery, setSearchQuery] = useState<string>("");
//   const [loading, setLoading] = useState<boolean>(true);

//   // ---------------- MAP SOURCE ----------------
//   const mapLeadSource = useCallback((source: string): "fb" | "jd" | "web" => {
//     if (!source) return "web";
//     source = source.toLowerCase();
//     if (source.includes("facebook")) return "fb";
//     if (source.includes("dealer") || source.includes("jd")) return "jd";
//     return "web";
//   }, []);

//   // ---------------- FETCH API & STORE ----------------
//   const fetchAndStoreLeads = useCallback(async () => {
//     try {
//       const user = await getLoggedInUser();
//       if (!user?.entity_id) return;

//       let offset = 0;
//       const limit = 25;
//       let hasMore = true;

//       while (hasMore) {
//         const url = `https://server103.multi-techno.com:8383/ords/ard_holdings/crm_app/get_leads_data?entity_id=${user.entity_id}&offset=${offset}&limit=${limit}`;
//         const response = await fetch(url);
//         if (!response.ok) throw new Error("Failed to fetch leads");

//         const data = await response.json();
//         const items = data.items || [];

//         for (const lead of items) {
//           await insertLead(
//             lead.lead_id,               // API lead_id
//             lead.name || "Unknown",
//             lead.phone?.trim() || "N/A",
//             lead.status || "NEW",
//             lead.last_task_name || "-",
//             mapLeadSource(lead.lead_source)
//           );
//         }

//         hasMore = data.hasMore || false;
//         offset += limit;
//       }
//     } catch (err) {
//       console.error("Error fetching API leads:", err);
//     }
//   }, [mapLeadSource]);

//   // ---------------- LOAD LEADS ----------------
//   const loadLeads = useCallback(async () => {
//     setLoading(true);
//     try {
//       await fetchAndStoreLeads();
//       const savedLeads = await getLeads();
//       setLeads(savedLeads);
//     } catch (error) {
//       console.error("Error loading leads:", error);
//     } finally {
//       setLoading(false);
//     }
//   }, [fetchAndStoreLeads]);

//   useEffect(() => {
//     (async () => {
//       await initDB();
//       await loadLeads();
//     })();
//   }, [loadLeads]);

//   // ---------------- SEARCH HANDLER ----------------
//   const handleSearch = async (text: string) => {
//     setSearchQuery(text);
//     if (text.trim() === "") {
//       await loadLeads();
//     } else {
//       const results = await searchLeads(text);
//       setLeads(results);
//     }
//   };

//   // ---------------- RENDER ICONS & BADGES ----------------
//   const renderSourceIcon = (source: Lead["source"]) => {
//     switch (source) {
//       case "fb":
//         return <FontAwesome name="facebook" size={14} color="#1877F2" />;
//       case "jd":
//         return <MaterialIcons name="work" size={14} color="#2C3E50" />;
//       case "web":
//         return <MaterialIcons name="public" size={14} color="#27AE60" />;
//       default:
//         return <MaterialIcons name="help-outline" size={14} color="#7f8c8d" />;
//     }
//   };

//   const renderStatusBadge = (status: Lead["status"]) => {
//     let bgColor = "#ecf0f1";
//     let textColor = "#7f8c8d";

//     switch (status) {
//       case "NEW": bgColor = "#1abc9c33"; textColor = "#1abc9c"; break;
//       case "OLD": bgColor = "#e74c3c33"; textColor = "#e74c3c"; break;
//       case "Not Interested": bgColor = "#e74c3c33"; textColor = "#e74c3c"; break;
//       case "Interested": bgColor = "#2ecc7133"; textColor = "#2ecc71"; break;
//       case "Follow Up": bgColor = "#f1c40f33"; textColor = "#f1c40f"; break;
//       default: bgColor = "#bdc3c733"; textColor = "#7f8c8d";
//     }

//     return (
//       <View style={[styles.statusBadge, { backgroundColor: bgColor }]}>
//         <Text style={[styles.statusText, { color: textColor }]} numberOfLines={1} ellipsizeMode="tail">
//           {status}
//         </Text>
//       </View>
//     );
//   };

//   // ---------------- RENDER ----------------
//   return (
//     <View style={styles.container}>
//       {/* SEARCH BAR */}
//       <View style={styles.searchWrapper}>
//         <TextInput
//           placeholder="Search by name or phone..."
//           placeholderTextColor="#7f8c8d"
//           style={styles.searchBar}
//           value={searchQuery}
//           onChangeText={handleSearch}
//         />
//         <MaterialIcons name="search" size={22} color="#7f8c8d" style={styles.searchIcon} />
//       </View>

//       {loading ? (
//         <View style={styles.loadingContainer}>
//           <ActivityIndicator size="large" color="#1abc9c" />
//         </View>
//       ) : (
//         <FlatList
//           data={leads}
//           keyExtractor={(item) => item.id.toString()}
//           contentContainerStyle={styles.list}
//           renderItem={({ item }) => (
//             <TouchableOpacity style={styles.card} onPress={() => onSelectLead(item.phone)}>
//               <View style={styles.left}>
//                 <View style={styles.nameRow}>
//                   <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">{item.name}</Text>
//                   <View style={styles.separatorLine} />
//                   {renderSourceIcon(item.source)}
//                 </View>
//                 <Text style={styles.phone}>{item.phone || "N/A"}</Text>
//                 {item.city ? <Text style={styles.city}>{item.city}</Text> : null}
//               </View>
//               <View style={styles.center}>{renderStatusBadge(item.status)}</View>
//               <View style={styles.right}>
//                 <View style={styles.avatar}>
//                   <MaterialIcons name="person" size={24} color="#fff" />
//                 </View>
//                 <Text style={styles.assignee}>{item.assignee || "-"}</Text>
//               </View>
//             </TouchableOpacity>
//           )}
//         />
//       )}
//     </View>
//   );
// }

// // ---------------- STYLES ----------------
// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: "#eef5f4" },
//   searchWrapper: { position: "relative", marginHorizontal: 12, marginVertical: 10 },
//   searchBar: {
//     backgroundColor: "#fff",
//     borderRadius: 12,
//     paddingHorizontal: 16,
//     paddingVertical: 10,
//     fontSize: 14,
//     color: "#2c3e50",
//     paddingRight: 40,
//     shadowColor: "#000",
//     shadowOpacity: 0.05,
//     shadowOffset: { width: 0, height: 2 },
//     shadowRadius: 4,
//     elevation: 2,
//   },
//   searchIcon: { position: "absolute", right: 18, top: 10 },
//   list: { paddingHorizontal: 12, paddingBottom: 32 },
//   card: {
//     flexDirection: "row",
//     backgroundColor: "#fff",
//     paddingHorizontal: 16,
//     paddingVertical: 6,
//     borderRadius: 16,
//     marginBottom: 8,
//     shadowColor: "#000",
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.08,
//     shadowRadius: 6,
//     elevation: 3,
//     alignItems: "center",
//   },
//   left: { flex: 3 },
//   loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
//   nameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "nowrap" },
//   separatorLine: { width: 1, height: 18, backgroundColor: "#7f8c8d", alignSelf: "center" },
//   name: { fontSize: 16, fontWeight: "700", color: "#2c3e50", width: 96 },
//   phone: { fontSize: 14, color: "#7f8c8d", marginTop: 4 },
//   center: { flex: 1, alignItems: "center" },
//   statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16, alignSelf: "center", minWidth: 80, maxWidth: 120, marginRight: 26, alignItems: "center", justifyContent: "center" },
//   statusText: { fontSize: 12, fontWeight: "700", textAlign: "center", flexShrink: 1 },
//   right: { flex: 1, alignItems: "center" },
//   avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#1abc9c", justifyContent: "center", alignItems: "center", marginBottom: 4 },
//   assignee: { fontSize: 12, color: "#34495e" },
//   city: { fontSize: 12, color: "#7f8c8d", marginTop: 2 },
// });




// import React, { useEffect, useState } from "react";
// import {
//   View,
//   Text,
//   FlatList,
//   TouchableOpacity,
//   StyleSheet,
//   TextInput,
// } from "react-native";
// import MaterialIcons from "react-native-vector-icons/MaterialIcons";
// import FontAwesome from "react-native-vector-icons/FontAwesome";
// import { initDB, getLeads, insertLead, searchLeads } from "../db/database"; // SQLite helper functions

// export type Lead = {
//   id: number;
//   name: string;
//   phone: string;
//   status: "NEW" | "OLD" | "Interested" | "Not Interested" | "Follow Up";
//   assignee: string;
//   source: "fb" | "jd" | "web";
// };

// type Props = {
//   onSelectLead: (phone: string) => void;
//   onOpenReport?: () => void;   // optional if you want
//   onOpenHistory?: () => void;  // optional if you want
// };


// export default function LeadsScreen({ onSelectLead }: Props) {
//   const [leads, setLeads] = useState<Lead[]>([]);
//   const [searchQuery, setSearchQuery] = useState<string>("");

//   useEffect(() => {
//     (async () => {
//       await initDB();
//       await loadLeads();
//     })();
//   }, []);

//   const loadLeads = async () => {
//     try {
//       let savedLeads = await getLeads();
//       if (savedLeads.length === 0) {
//         // Insert dummy leads if DB is empty
//         const dummy: Lead[] = [
//           { id: 0, name: "Ali", phone: "03001234567", status: "NEW", assignee: "Umer", source: "fb" },
//           { id: 0, name: "Umer", phone: "03229199459", status: "NEW", assignee: "Umer", source: "web" },
//           { id: 0, name: "Noman", phone: "03003334444", status: "NEW", assignee: "Ali", source: "fb" },
//           { id: 0, name: "Ahmad", phone: "03005556666", status: "OLD", assignee: "Ali", source: "fb" },
//         ];
//         for (const lead of dummy) {
//           await insertLead(lead.name, lead.phone, lead.status, lead.assignee, lead.source);
//         }
//         savedLeads = await getLeads();
//       }
//       setLeads(savedLeads);
//     } catch (error) {
//       console.error("Error loading leads from DB:", error);
//     }
//   };

//   const handleSearch = async (text: string) => {
//     setSearchQuery(text);
//     if (text.trim() === "") {
//       await loadLeads();
//     } else {
//       const results = await searchLeads(text);
//       setLeads(results);
//     }
//   };

//   const renderSourceIcon = (source: Lead["source"]) => {
//     switch (source) {
//       case "fb":
//         return <FontAwesome name="facebook" size={14} color="#1877F2" />;
//       case "jd":
//         return <MaterialIcons name="work" size={14} color="#2C3E50" />;
//       case "web":
//         return <MaterialIcons name="public" size={14} color="#27AE60" />;
//       default:
//         return <MaterialIcons name="help-outline" size={14} color="#7f8c8d" />;
//     }
//   };

//   const renderStatusBadge = (status: Lead["status"]) => {
//     let bgColor = "#ecf0f1";
//     let textColor = "#7f8c8d";

//     switch (status) {
//       case "NEW": bgColor = "#1abc9c33"; textColor = "#1abc9c"; break;
//       case "OLD": bgColor = "#e74c3c33"; textColor = "#e74c3c"; break;
//       case "Not Interested": bgColor = "#e74c3c33"; textColor = "#e74c3c"; break;
//       case "Interested": bgColor = "#2ecc7133"; textColor = "#2ecc71"; break;
//       case "Follow Up": bgColor = "#f1c40f33"; textColor = "#f1c40f"; break;
//       default: bgColor = "#bdc3c733"; textColor = "#7f8c8d";
//     }

//     return (
//       <View style={[styles.statusBadge, { backgroundColor: bgColor }]}>
//         <Text style={[styles.statusText, { color: textColor }]} numberOfLines={1} ellipsizeMode="tail">
//           {status}
//         </Text>
//       </View>
//     );
//   };

//   return (
//     <View style={styles.container}>
//       {/* SEARCH BAR */}
//       <View style={styles.searchWrapper}>
//         <TextInput
//           placeholder="Search by name or phone..."
//           placeholderTextColor="#7f8c8d"
//           style={styles.searchBar}
//           value={searchQuery}
//           onChangeText={handleSearch}
//         />
//         <MaterialIcons name="search" size={22} color="#7f8c8d" style={styles.searchIcon} />
//       </View>

//       {/* LIST */}
//       <FlatList
//         data={leads}
//         keyExtractor={(item) => item.id.toString()}
//         contentContainerStyle={styles.list}
//         renderItem={({ item }) => (
//           <TouchableOpacity
//             style={styles.card}
//             onPress={() => onSelectLead(item.phone)}
//           >
//             <View style={styles.left}>
//               <View style={styles.nameRow}>
//                 <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">{item.name}</Text>
//                 {/* <Text style={styles.separator}>|</Text> */}
//                  <View style={styles.separatorLine} />
//                 <Text style={styles.source}>{renderSourceIcon(item.source)}</Text>
//               </View>
//               <Text style={styles.phone}>{item.phone}</Text>
//             </View>
//             <View style={styles.center}>{renderStatusBadge(item.status)}</View>
//             <View style={styles.right}>
//               <View style={styles.avatar}>
//                 <MaterialIcons name="person" size={24} color="#fff" />
//               </View>
//               <Text style={styles.assignee}>{item.assignee}</Text>
//             </View>
//           </TouchableOpacity>
//         )}
//       />
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: "#eef5f4" },
//   searchWrapper: {
//     position: "relative",
//     marginHorizontal: 12,
//     marginVertical: 10,
//   },
//   searchBar: {
//     backgroundColor: "#fff",
//     borderRadius: 12,
//     paddingHorizontal: 16,
//     paddingVertical: 10,
//     fontSize: 14,
//     color: "#2c3e50",
//     paddingRight: 40,
//     shadowColor: "#000",
//     shadowOpacity: 0.05,
//     shadowOffset: { width: 0, height: 2 },
//     shadowRadius: 4,
//     elevation: 2,
//   },
//   searchIcon: {
//     position: "absolute",
//     right: 18,
//     top: 10,
//   },
//   list: { paddingHorizontal: 12, paddingBottom: 32 },
//   card: {
//     flexDirection: "row",
//     backgroundColor: "#fff",
//     paddingHorizontal: 16,
//     paddingVertical: 6,
//     borderRadius: 16,
//     marginBottom: 8,
//     shadowColor: "#000",
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.08,
//     shadowRadius: 6,
//     elevation: 3,
//     alignItems: "center",
//   },
//   left: { flex: 3 },
//   nameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "nowrap" },
//   separator: { fontSize: 14, color: "#7f8c8d", marginHorizontal: 4 },
//   separatorLine: {
//   width: 1,             // thin vertical line
//   height: 18,           // match text height
//   backgroundColor: "#7f8c8d",
//   alignSelf: "center",  // vertical align center
// },
//   name: { fontSize: 16, fontWeight: "700", color: "#2c3e50", width: 96, },
//   source: { fontSize: 14 },
//   phone: { fontSize: 14, color: "#7f8c8d", marginTop: 4 },
//   center: { flex: 1, alignItems: "center" },
//   statusBadge: {
//     paddingHorizontal: 12,
//     paddingVertical: 4,
//     borderRadius: 16,
//     alignSelf: "center",
//     minWidth: 80,
//     maxWidth: 120,
//     marginRight: 26,
//     alignItems: "center",
//     justifyContent: "center",
//   },
//   statusText: {
//     fontSize: 12,
//     fontWeight: "700",
//     textAlign: "center",
//     flexShrink: 1,
//   },
//   right: { flex: 1, alignItems: "center" },
//   avatar: {
//     width: 40,
//     height: 40,
//     borderRadius: 20,
//     backgroundColor: "#1abc9c",
//     justifyContent: "center",
//     alignItems: "center",
//     marginBottom: 4,
//   },
//   assignee: { fontSize: 12, color: "#34495e" },
// });



// 
// import React, { useEffect, useState } from "react";
// import {
//   View,
//   Text,
//   FlatList,
//   TouchableOpacity,
//   StyleSheet,
//   TextInput,
// } from "react-native";
// import AsyncStorage from "@react-native-async-storage/async-storage";
// import MaterialIcons from "react-native-vector-icons/MaterialIcons"; 
// import FontAwesome from "react-native-vector-icons/FontAwesome";

// export type Lead = {
//   id: string;
//   name: string;
//   phone: string;
//   status: "NEW" | "OLD" | "Interested" | "Not Interested" | "Follow Up";
//   assignee: string;
//   source: "fb" | "jd" | "web";
// };

// type Props = {
//   onSelectLead: (phone: string) => void;
//   onOpenHistory: () => void;
//   onOpenReport: () => void;
// };

// export default function LeadsScreen({ onSelectLead}: Props) {
//   const [leads, setLeads] = useState<Lead[]>([]);
//   const [searchQuery, setSearchQuery] = useState<string>("");

//   useEffect(() => {
//     loadLeads();
//   }, []);

//   const loadLeads = async () => {
//     const saved = await AsyncStorage.getItem("leads");
//     if (saved) {
//       setLeads(JSON.parse(saved));
//       return;
//     }

//     const dummy: Lead[] = [
//       { id: "1", name: "Ali", phone: "03001234567", status: "NEW", assignee: "Umer", source: "fb" },
//       { id: "2", name: "Umer", phone: "03229199459", status: "NEW", assignee: "Umer", source: "web" },
//       { id: "3", name: "Noman", phone: "03003334444", status: "NEW", assignee: "Ali", source: "fb" },
//       { id: "4", name: "Ahmad", phone: "03005556666", status: "OLD", assignee: "Ali", source: "fb" },
//       { id: "5", name: "Sara", phone: "03008889999", status: "NEW", assignee: "Umer", source: "web" },
//       { id: "6", name: "Hassan", phone: "03112223344", status: "OLD", assignee: "Ali", source: "jd" },
//       { id: "7", name: "Adeel", phone: "03221112233", status: "NEW", assignee: "Umer", source: "fb" },
//       { id: "8", name: "Bilal", phone: "03009998877", status: "OLD", assignee: "Ali", source: "web" },
//     ];

//     setLeads(dummy);
//     await AsyncStorage.setItem("leads", JSON.stringify(dummy));
//   };

//   const renderSourceIcon = (source: Lead["source"]) => {
//     switch (source) {
//       case "fb":
//         return <FontAwesome name="facebook" size={20} color="#1877F2" />;
//       case "jd":
//         return <MaterialIcons name="work" size={20} color="#2C3E50" />;
//       case "web":
//         return <MaterialIcons name="public" size={20} color="#27AE60" />;
//       default:
//         return <MaterialIcons name="help-outline" size={20} color="#7f8c8d" />;
//     }
//   };

//   const renderStatusBadge = (status: Lead["status"]) => {
//     let bgColor = "#ecf0f1";
//     let textColor = "#7f8c8d";

//     switch (status) {
//       case "NEW": bgColor = "#1abc9c33"; textColor = "#1abc9c"; break;
//       case "OLD": bgColor = "#e74c3c33"; textColor = "#e74c3c"; break;
//       case "Not Interested": bgColor = "#e74c3c33"; textColor = "#e74c3c"; break;
//       case "Interested": bgColor = "#2ecc7133"; textColor = "#2ecc71"; break;
//       case "Follow Up": bgColor = "#f1c40f33"; textColor = "#f1c40f"; break;
//       default: bgColor = "#bdc3c733"; textColor = "#7f8c8d";
//     }

//     return (
//       <View style={[styles.statusBadge, { backgroundColor: bgColor }]}>
//         <Text style={[styles.statusText, { color: textColor }]} numberOfLines={1} ellipsizeMode="tail">
//           {status}
//         </Text>
//       </View>
//     );
//   };

//   const filteredLeads = leads.filter(
//     (lead) =>
//       lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
//       lead.phone.includes(searchQuery)
//   );

//   return (
//     <View style={styles.container}>
//       {/* SEARCH BAR */}
//       <View style={styles.searchWrapper}>
//         <TextInput
//           placeholder="Search by name or phone..."
//           placeholderTextColor="#7f8c8d"
//           style={styles.searchBar}
//           value={searchQuery}
//           onChangeText={setSearchQuery}
//         />
//         <MaterialIcons name="search" size={22} color="#7f8c8d" style={styles.searchIcon} />
//       </View>

//       {/* LIST */}
//       <FlatList
//         data={filteredLeads}
//         keyExtractor={(item) => item.id}
//         contentContainerStyle={styles.list}
//         renderItem={({ item }) => (
//           <TouchableOpacity
//             style={styles.card}
//             onPress={() => onSelectLead(item.phone)}
//           >
//             <View style={styles.left}>
//               <View style={styles.nameRow}>
//                 <Text style={styles.name}>{item.name}</Text>
//                 <Text style={styles.separator}>|</Text>
//                 <Text style={styles.source}>{renderSourceIcon(item.source)}</Text>
//               </View>
//               <Text style={styles.phone}>{item.phone}</Text>
//             </View>
//             <View style={styles.center}>{renderStatusBadge(item.status)}</View>
//             <View style={styles.right}>
//               <View style={styles.avatar}>
//                 <MaterialIcons name="person" size={24} color="#fff" />
//               </View>
//               <Text style={styles.assignee}>{item.assignee}</Text>
//             </View>
//           </TouchableOpacity>
//         )}
//       />
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: "#eef5f4" },

//   header: {
//   backgroundColor: "#fff",
//   paddingHorizontal: 16,
//   paddingVertical: 10,
//   flexDirection: "row",
//   justifyContent: "space-between", // left-right spacing
//   alignItems: "center",
//   borderBottomWidth: 1,
//   borderColor: "#e6e6e6",
// },
// headerTitle: {
//   fontSize: 18,
//   fontWeight: "700",
//   color: "#2c3e50",
// },
// iconBtn: {
//   flexDirection: "row",
//   alignItems: "center",
//   gap: 10,
//   backgroundColor: "#e0f7f4",
//   paddingHorizontal: 12,
//   paddingVertical: 6,
//   borderRadius: 8,
//   width:"46%",
// },
// iconText: {
//   fontSize: 14,
//   fontWeight: "600",
//   color: "#1abc9c",
// },

//   searchWrapper: {
//     position: "relative",
//     marginHorizontal: 12,
//     marginVertical: 10,
//   },
//   searchBar: {
//     backgroundColor: "#fff",
//     borderRadius: 12,
//     paddingHorizontal: 16,
//     paddingVertical: 10,
//     fontSize: 14,
//     color: "#2c3e50",
//     paddingRight: 40,
//     shadowColor: "#000",
//     shadowOpacity: 0.05,
//     shadowOffset: { width: 0, height: 2 },
//     shadowRadius: 4,
//     elevation: 2,
//   },
//   searchIcon: {
//     position: "absolute",
//     right: 18,
//     top: 10,
//   },

//   list: { paddingHorizontal: 12, paddingBottom: 32 },

//   card: {
//     flexDirection: "row",
//     backgroundColor: "#fff",
//     paddingHorizontal: 16,
//     paddingVertical: 6,
//     borderRadius: 16,
//     marginBottom: 8,
//     shadowColor: "#000",
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.08,
//     shadowRadius: 6,
//     elevation: 3,
//     alignItems: "center",
//   },
//   left: { flex: 3 },
//   nameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "nowrap" },
//   separator: { fontSize: 14, color: "#7f8c8d", marginHorizontal: 4 },
//   name: { fontSize: 16, fontWeight: "700", color: "#2c3e50" },
//   source: { fontSize: 14 },
//   phone: { fontSize: 14, color: "#7f8c8d", marginTop: 4 },

//   center: { flex: 1, alignItems: "center" },
//   statusBadge: {
//     paddingHorizontal: 12,
//     paddingVertical: 4,
//     borderRadius: 16,
//     alignSelf: "center",
//     minWidth: 80,
//     maxWidth: 120,
//     marginRight: 26,
//     alignItems: "center",
//     justifyContent: "center",
//   },
//   statusText: {
//     fontSize: 12,
//     fontWeight: "700",
//     textAlign: "center",
//     flexShrink: 1,
//   },

//   right: { flex: 1, alignItems: "center" },
//   avatar: {
//     width: 40,
//     height: 40,
//     borderRadius: 20,
//     backgroundColor: "#1abc9c",
//     justifyContent: "center",
//     alignItems: "center",
//     marginBottom: 4,
//   },
//   assignee: { fontSize: 12, color: "#34495e" },
// });




// import React, { useEffect, useState } from "react";
// import {
//   View,
//   Text,
//   FlatList,
//   TouchableOpacity,
//   StyleSheet,
//   TextInput,
// } from "react-native";
// import MaterialIcons from "react-native-vector-icons/MaterialIcons"; 
// import FontAwesome from "react-native-vector-icons/FontAwesome";

// // Import your DB methods
// import { initDB, getLeads, insertLead } from "../db/database";

// export type Lead = {
//   id: string;
//   name: string;
//   phone: string;
//   status: "NEW" | "OLD" | "Interested" | "Not Interested" | "Follow Up";
//   assignee: string;
//   source: "fb" | "jd" | "web";
// };

// type Props = {
//   onSelectLead: (phone: string) => void;
//   onOpenHistory: () => void;
//   onOpenReport: () => void;
// };

// export default function LeadsScreen({ onSelectLead }: Props) {
//   const [leads, setLeads] = useState<Lead[]>([]);
//   const [searchQuery, setSearchQuery] = useState<string>("");

//   useEffect(() => {
//     const prepareDB = async () => {
//       try {
//         await initDB();          // Initialize tables
//         await loadLeads();       // Load leads from DB
//       } catch (err) {
//         console.error("DB init failed:", err);
//       }
//     };
//     prepareDB();
//   }, []);

//   // Load leads from SQLite
//   const loadLeads = async () => {
//     try {
//       const dbLeads = await getLeads();
//       if (dbLeads.length === 0) {
//         // Insert dummy leads if DB is empty
//         const dummy: Omit<Lead, "id">[] = [
//           { name: "Ali", phone: "03001234567", status: "NEW", assignee: "Umer", source: "fb" },
//           { name: "Umer", phone: "03229199459", status: "NEW", assignee: "Umer", source: "web" },
//           { name: "Noman", phone: "03003334444", status: "NEW", assignee: "Ali", source: "fb" },
//           { name: "Ahmad", phone: "03005556666", status: "OLD", assignee: "Ali", source: "fb" },
//           { name: "Sara", phone: "03008889999", status: "NEW", assignee: "Umer", source: "web" },
//           { name: "Hassan", phone: "03112223344", status: "OLD", assignee: "Ali", source: "jd" },
//           { name: "Adeel", phone: "03221112233", status: "NEW", assignee: "Umer", source: "fb" },
//           { name: "Bilal", phone: "03009998877", status: "OLD", assignee: "Ali", source: "web" },
//         ];

//         // Insert into DB
//         for (const lead of dummy) {
//           await insertLead(lead.name, lead.phone, lead.status, lead.assignee, lead.source);
//         }

//         const newLeads = await getLeads();
//         setLeads(newLeads);
//       } else {
//         setLeads(dbLeads);
//       }
//     } catch (err) {
//       console.error("Failed to load leads:", err);
//     }
//   };

//   const renderSourceIcon = (source: Lead["source"]) => {
//     switch (source) {
//       case "fb":
//         return <FontAwesome name="facebook" size={20} color="#1877F2" />;
//       case "jd":
//         return <MaterialIcons name="work" size={20} color="#2C3E50" />;
//       case "web":
//         return <MaterialIcons name="public" size={20} color="#27AE60" />;
//       default:
//         return <MaterialIcons name="help-outline" size={20} color="#7f8c8d" />;
//     }
//   };

//   const renderStatusBadge = (status: Lead["status"]) => {
//     let bgColor = "#ecf0f1";
//     let textColor = "#7f8c8d";

//     switch (status) {
//       case "NEW": bgColor = "#1abc9c33"; textColor = "#1abc9c"; break;
//       case "OLD": bgColor = "#e74c3c33"; textColor = "#e74c3c"; break;
//       case "Not Interested": bgColor = "#e74c3c33"; textColor = "#e74c3c"; break;
//       case "Interested": bgColor = "#2ecc7133"; textColor = "#2ecc71"; break;
//       case "Follow Up": bgColor = "#f1c40f33"; textColor = "#f1c40f"; break;
//       default: bgColor = "#bdc3c733"; textColor = "#7f8c8d";
//     }

//     return (
//       <View style={[styles.statusBadge, { backgroundColor: bgColor }]}>
//         <Text style={[styles.statusText, { color: textColor }]} numberOfLines={1} ellipsizeMode="tail">
//           {status}
//         </Text>
//       </View>
//     );
//   };

//   const filteredLeads = leads.filter(
//     (lead) =>
//       lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
//       lead.phone.includes(searchQuery)
//   );

//   return (
//     <View style={styles.container}>
//       <View style={styles.searchWrapper}>
//         <TextInput
//           placeholder="Search by name or phone..."
//           placeholderTextColor="#7f8c8d"
//           style={styles.searchBar}
//           value={searchQuery}
//           onChangeText={setSearchQuery}
//         />
//         <MaterialIcons name="search" size={22} color="#7f8c8d" style={styles.searchIcon} />
//       </View>

//       <FlatList
//         data={filteredLeads}
//         keyExtractor={(item) => item.id.toString()}
//         contentContainerStyle={styles.list}
//         renderItem={({ item }) => (
//           <TouchableOpacity style={styles.card} onPress={() => onSelectLead(item.phone)}>
//             <View style={styles.left}>
//               <View style={styles.nameRow}>
//                 <Text style={styles.name}>{item.name}</Text>
//                 <Text style={styles.separator}>|</Text>
//                 <Text style={styles.source}>{renderSourceIcon(item.source)}</Text>
//               </View>
//               <Text style={styles.phone}>{item.phone}</Text>
//             </View>
//             <View style={styles.center}>{renderStatusBadge(item.status)}</View>
//             <View style={styles.right}>
//               <View style={styles.avatar}>
//                 <MaterialIcons name="person" size={24} color="#fff" />
//               </View>
//               <Text style={styles.assignee}>{item.assignee}</Text>
//             </View>
//           </TouchableOpacity>
//         )}
//       />
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: "#eef5f4" },
//   searchWrapper: { position: "relative", marginHorizontal: 12, marginVertical: 10 },
//   searchBar: {
//     backgroundColor: "#fff",
//     borderRadius: 12,
//     paddingHorizontal: 16,
//     paddingVertical: 10,
//     fontSize: 14,
//     color: "#2c3e50",
//     paddingRight: 40,
//     shadowColor: "#000",
//     shadowOpacity: 0.05,
//     shadowOffset: { width: 0, height: 2 },
//     shadowRadius: 4,
//     elevation: 2,
//   },
//   searchIcon: { position: "absolute", right: 18, top: 10 },
//   list: { paddingHorizontal: 12, paddingBottom: 32 },
//   card: {
//     flexDirection: "row",
//     backgroundColor: "#fff",
//     paddingHorizontal: 16,
//     paddingVertical: 6,
//     borderRadius: 16,
//     marginBottom: 8,
//     shadowColor: "#000",
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.08,
//     shadowRadius: 6,
//     elevation: 3,
//     alignItems: "center",
//   },
//   left: { flex: 3 },
//   nameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "nowrap" },
//   separator: { fontSize: 14, color: "#7f8c8d", marginHorizontal: 4 },
//   name: { fontSize: 16, fontWeight: "700", color: "#2c3e50" },
//   source: { fontSize: 14 },
//   phone: { fontSize: 14, color: "#7f8c8d", marginTop: 4 },
//   center: { flex: 1, alignItems: "center" },
//   statusBadge: {
//     paddingHorizontal: 12,
//     paddingVertical: 4,
//     borderRadius: 16,
//     alignSelf: "center",
//     minWidth: 80,
//     maxWidth: 120,
//     marginRight: 26,
//     alignItems: "center",
//     justifyContent: "center",
//   },
//   statusText: { fontSize: 12, fontWeight: "700", textAlign: "center", flexShrink: 1 },
//   right: { flex: 1, alignItems: "center" },
//   avatar: {
//     width: 40,
//     height: 40,
//     borderRadius: 20,
//     backgroundColor: "#1abc9c",
//     justifyContent: "center",
//     alignItems: "center",
//     marginBottom: 4,
//   },
//   assignee: { fontSize: 12, color: "#34495e" },
// });





// import React, { useEffect, useState } from "react";
// import {
//   View,
//   Text,
//   FlatList,
//   TouchableOpacity,
//   StyleSheet,
//   TextInput,
// } from "react-native";
// import AsyncStorage from "@react-native-async-storage/async-storage";
// import MaterialIcons from "react-native-vector-icons/MaterialIcons"; 
// import FontAwesome from "react-native-vector-icons/FontAwesome";

// export type Lead = {
//   id: string;
//   name: string;
//   phone: string;
//   status: "NEW" | "OLD" | "Interested" | "Not Interested" | "Follow Up";
//   assignee: string;
//   source: "fb" | "jd" | "web";
// };

// type Props = {
//   onSelectLead: (phone: string) => void;
//   onOpenHistory: () => void;
//   onOpenReport: () => void;
// };

// export default function LeadsScreen({ onSelectLead}: Props) {
//   const [leads, setLeads] = useState<Lead[]>([]);
//   const [searchQuery, setSearchQuery] = useState<string>("");

//   useEffect(() => {
//     loadLeads();
//   }, []);

//   const loadLeads = async () => {
//     const saved = await AsyncStorage.getItem("leads");
//     if (saved) {
//       setLeads(JSON.parse(saved));
//       return;
//     }

//     const dummy: Lead[] = [
//       { id: "1", name: "Ali", phone: "03001234567", status: "NEW", assignee: "Umer", source: "fb" },
//       { id: "2", name: "Umer", phone: "03229199459", status: "NEW", assignee: "Umer", source: "web" },
//       { id: "3", name: "Noman", phone: "03003334444", status: "NEW", assignee: "Ali", source: "fb" },
//       { id: "4", name: "Ahmad", phone: "03005556666", status: "OLD", assignee: "Ali", source: "fb" },
//       { id: "5", name: "Sara", phone: "03008889999", status: "NEW", assignee: "Umer", source: "web" },
//       { id: "6", name: "Hassan", phone: "03112223344", status: "OLD", assignee: "Ali", source: "jd" },
//       { id: "7", name: "Adeel", phone: "03221112233", status: "NEW", assignee: "Umer", source: "fb" },
//       { id: "8", name: "Bilal", phone: "03009998877", status: "OLD", assignee: "Ali", source: "web" },
//     ];

//     setLeads(dummy);
//     await AsyncStorage.setItem("leads", JSON.stringify(dummy));
//   };

//   const renderSourceIcon = (source: Lead["source"]) => {
//     switch (source) {
//       case "fb":
//         return <FontAwesome name="facebook" size={20} color="#1877F2" />;
//       case "jd":
//         return <MaterialIcons name="work" size={20} color="#2C3E50" />;
//       case "web":
//         return <MaterialIcons name="public" size={20} color="#27AE60" />;
//       default:
//         return <MaterialIcons name="help-outline" size={20} color="#7f8c8d" />;
//     }
//   };

//   const renderStatusBadge = (status: Lead["status"]) => {
//     let bgColor = "#ecf0f1";
//     let textColor = "#7f8c8d";

//     switch (status) {
//       case "NEW": bgColor = "#1abc9c33"; textColor = "#1abc9c"; break;
//       case "OLD": bgColor = "#e74c3c33"; textColor = "#e74c3c"; break;
//       case "Not Interested": bgColor = "#e74c3c33"; textColor = "#e74c3c"; break;
//       case "Interested": bgColor = "#2ecc7133"; textColor = "#2ecc71"; break;
//       case "Follow Up": bgColor = "#f1c40f33"; textColor = "#f1c40f"; break;
//       default: bgColor = "#bdc3c733"; textColor = "#7f8c8d";
//     }

//     return (
//       <View style={[styles.statusBadge, { backgroundColor: bgColor }]}>
//         <Text style={[styles.statusText, { color: textColor }]} numberOfLines={1} ellipsizeMode="tail">
//           {status}
//         </Text>
//       </View>
//     );
//   };

//   const filteredLeads = leads.filter(
//     (lead) =>
//       lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
//       lead.phone.includes(searchQuery)
//   );

//   return (
//     <View style={styles.container}>
//       {/* SEARCH BAR */}
//       <View style={styles.searchWrapper}>
//         <TextInput
//           placeholder="Search by name or phone..."
//           placeholderTextColor="#7f8c8d"
//           style={styles.searchBar}
//           value={searchQuery}
//           onChangeText={setSearchQuery}
//         />
//         <MaterialIcons name="search" size={22} color="#7f8c8d" style={styles.searchIcon} />
//       </View>

//       {/* LIST */}
//       <FlatList
//         data={filteredLeads}
//         keyExtractor={(item) => item.id}
//         contentContainerStyle={styles.list}
//         renderItem={({ item }) => (
//           <TouchableOpacity
//             style={styles.card}
//             onPress={() => onSelectLead(item.phone)}
//           >
//             <View style={styles.left}>
//               <View style={styles.nameRow}>
//                 <Text style={styles.name}>{item.name}</Text>
//                 <Text style={styles.separator}>|</Text>
//                 <Text style={styles.source}>{renderSourceIcon(item.source)}</Text>
//               </View>
//               <Text style={styles.phone}>{item.phone}</Text>
//             </View>
//             <View style={styles.center}>{renderStatusBadge(item.status)}</View>
//             <View style={styles.right}>
//               <View style={styles.avatar}>
//                 <MaterialIcons name="person" size={24} color="#fff" />
//               </View>
//               <Text style={styles.assignee}>{item.assignee}</Text>
//             </View>
//           </TouchableOpacity>
//         )}
//       />
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: "#eef5f4" },

//   header: {
//   backgroundColor: "#fff",
//   paddingHorizontal: 16,
//   paddingVertical: 10,
//   flexDirection: "row",
//   justifyContent: "space-between", // left-right spacing
//   alignItems: "center",
//   borderBottomWidth: 1,
//   borderColor: "#e6e6e6",
// },
// headerTitle: {
//   fontSize: 18,
//   fontWeight: "700",
//   color: "#2c3e50",
// },
// iconBtn: {
//   flexDirection: "row",
//   alignItems: "center",
//   gap: 10,
//   backgroundColor: "#e0f7f4",
//   paddingHorizontal: 12,
//   paddingVertical: 6,
//   borderRadius: 8,
//   width:"46%",
// },
// iconText: {
//   fontSize: 14,
//   fontWeight: "600",
//   color: "#1abc9c",
// },

//   searchWrapper: {
//     position: "relative",
//     marginHorizontal: 12,
//     marginVertical: 10,
//   },
//   searchBar: {
//     backgroundColor: "#fff",
//     borderRadius: 12,
//     paddingHorizontal: 16,
//     paddingVertical: 10,
//     fontSize: 14,
//     color: "#2c3e50",
//     paddingRight: 40,
//     shadowColor: "#000",
//     shadowOpacity: 0.05,
//     shadowOffset: { width: 0, height: 2 },
//     shadowRadius: 4,
//     elevation: 2,
//   },
//   searchIcon: {
//     position: "absolute",
//     right: 18,
//     top: 10,
//   },

//   list: { paddingHorizontal: 12, paddingBottom: 32 },

//   card: {
//     flexDirection: "row",
//     backgroundColor: "#fff",
//     paddingHorizontal: 16,
//     paddingVertical: 6,
//     borderRadius: 16,
//     marginBottom: 8,
//     shadowColor: "#000",
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.08,
//     shadowRadius: 6,
//     elevation: 3,
//     alignItems: "center",
//   },
//   left: { flex: 3 },
//   nameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "nowrap" },
//   separator: { fontSize: 14, color: "#7f8c8d", marginHorizontal: 4 },
//   name: { fontSize: 16, fontWeight: "700", color: "#2c3e50" },
//   source: { fontSize: 14 },
//   phone: { fontSize: 14, color: "#7f8c8d", marginTop: 4 },

//   center: { flex: 1, alignItems: "center" },
//   statusBadge: {
//     paddingHorizontal: 12,
//     paddingVertical: 4,
//     borderRadius: 16,
//     alignSelf: "center",
//     minWidth: 80,
//     maxWidth: 120,
//     marginRight: 26,
//     alignItems: "center",
//     justifyContent: "center",
//   },
//   statusText: {
//     fontSize: 12,
//     fontWeight: "700",
//     textAlign: "center",
//     flexShrink: 1,
//   },

//   right: { flex: 1, alignItems: "center" },
//   avatar: {
//     width: 40,
//     height: 40,
//     borderRadius: 20,
//     backgroundColor: "#1abc9c",
//     justifyContent: "center",
//     alignItems: "center",
//     marginBottom: 4,
//   },
//   assignee: { fontSize: 12, color: "#34495e" },
// });




// import React, { useEffect, useState } from "react";
// import {
//   View,
//   Text,
//   FlatList,
//   TouchableOpacity,
//   StyleSheet,
//   TextInput,
// } from "react-native";
// import AsyncStorage from "@react-native-async-storage/async-storage";
// import MaterialIcons from "react-native-vector-icons/MaterialIcons"; 
// import FontAwesome from "react-native-vector-icons/FontAwesome";

// export type Lead = {
//   id: string;
//   name: string;
//   phone: string;
//   status: "NEW" | "OLD" | "Interested" | "Not Interested" | "Follow Up";
//   assignee: string;
//   source: "fb" | "jd" | "web";
// };

// type Props = {
//   onSelectLead: (phone: string) => void;
//   onOpenHistory: () => void;
//   onOpenReport: () => void;
// };

// export default function LeadsScreen({ onSelectLead, onOpenHistory, onOpenReport}: Props) {
//   const [leads, setLeads] = useState<Lead[]>([]);
//   const [searchQuery, setSearchQuery] = useState<string>("");

//   useEffect(() => {
//     loadLeads();
//   }, []);

//   const loadLeads = async () => {
//     const saved = await AsyncStorage.getItem("leads");
//     if (saved) {
//       setLeads(JSON.parse(saved));
//       return;
//     }

//     const dummy: Lead[] = [
//       { id: "1", name: "Ali", phone: "03001234567", status: "NEW", assignee: "Umer", source: "fb" },
//       { id: "2", name: "Umer", phone: "03229199459", status: "NEW", assignee: "Umer", source: "web" },
//       { id: "3", name: "Noman", phone: "03003334444", status: "NEW", assignee: "Ali", source: "fb" },
//       { id: "4", name: "Ahmad", phone: "03005556666", status: "OLD", assignee: "Ali", source: "fb" },
//       { id: "5", name: "Sara", phone: "03008889999", status: "NEW", assignee: "Umer", source: "web" },
//       { id: "6", name: "Hassan", phone: "03112223344", status: "OLD", assignee: "Ali", source: "jd" },
//       { id: "7", name: "Adeel", phone: "03221112233", status: "NEW", assignee: "Umer", source: "fb" },
//       { id: "8", name: "Bilal", phone: "03009998877", status: "OLD", assignee: "Ali", source: "web" },
//     ];

//     setLeads(dummy);
//     await AsyncStorage.setItem("leads", JSON.stringify(dummy));
//   };

//   const renderSourceIcon = (source: Lead["source"]) => {
//     switch (source) {
//       case "fb":
//         return <FontAwesome name="facebook" size={20} color="#1877F2" />;
//       case "jd":
//         return <MaterialIcons name="work" size={20} color="#2C3E50" />;
//       case "web":
//         return <MaterialIcons name="public" size={20} color="#27AE60" />;
//       default:
//         return <MaterialIcons name="help-outline" size={20} color="#7f8c8d" />;
//     }
//   };

//   const renderStatusBadge = (status: Lead["status"]) => {
//     let bgColor = "#ecf0f1";
//     let textColor = "#7f8c8d";

//     switch (status) {
//       case "NEW": bgColor = "#1abc9c33"; textColor = "#1abc9c"; break;
//       case "OLD": bgColor = "#e74c3c33"; textColor = "#e74c3c"; break;
//       case "Not Interested": bgColor = "#e74c3c33"; textColor = "#e74c3c"; break;
//       case "Interested": bgColor = "#2ecc7133"; textColor = "#2ecc71"; break;
//       case "Follow Up": bgColor = "#f1c40f33"; textColor = "#f1c40f"; break;
//       default: bgColor = "#bdc3c733"; textColor = "#7f8c8d";
//     }

//     return (
//       <View style={[styles.statusBadge, { backgroundColor: bgColor }]}>
//         <Text style={[styles.statusText, { color: textColor }]} numberOfLines={1} ellipsizeMode="tail">
//           {status}
//         </Text>
//       </View>
//     );
//   };

//   const filteredLeads = leads.filter(
//     (lead) =>
//       lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
//       lead.phone.includes(searchQuery)
//   );

//   return (
//     <View style={styles.container}>
//       {/* HEADER: Professional icon-based History */}
//      <View style={styles.header}>
//   {/* LEFT: Heading */}
//   {/* <Text style={styles.headerTitle}>Leads Management</Text> */}
//    <TouchableOpacity style={styles.iconBtn} onPress={onOpenReport}>
//     <MaterialIcons name="bar-chart" size={24} color="#1abc9c" />
//     <Text style={styles.iconText}>Reports</Text>
//   </TouchableOpacity>

//   {/* RIGHT: History Button */}
//   <TouchableOpacity style={styles.iconBtn} onPress={onOpenHistory}>
//     <MaterialIcons name="history" size={24} color="#1abc9c" />
//     <Text style={styles.iconText}>History</Text>
//   </TouchableOpacity>
// </View>

//       {/* SEARCH BAR */}
//       <View style={styles.searchWrapper}>
//         <TextInput
//           placeholder="Search by name or phone..."
//           placeholderTextColor="#7f8c8d"
//           style={styles.searchBar}
//           value={searchQuery}
//           onChangeText={setSearchQuery}
//         />
//         <MaterialIcons name="search" size={22} color="#7f8c8d" style={styles.searchIcon} />
//       </View>

//       {/* LIST */}
//       <FlatList
//         data={filteredLeads}
//         keyExtractor={(item) => item.id}
//         contentContainerStyle={styles.list}
//         renderItem={({ item }) => (
//           <TouchableOpacity
//             style={styles.card}
//             onPress={() => onSelectLead(item.phone)}
//           >
//             <View style={styles.left}>
//               <View style={styles.nameRow}>
//                 <Text style={styles.name}>{item.name}</Text>
//                 <Text style={styles.separator}>|</Text>
//                 <Text style={styles.source}>{renderSourceIcon(item.source)}</Text>
//               </View>
//               <Text style={styles.phone}>{item.phone}</Text>
//             </View>
//             <View style={styles.center}>{renderStatusBadge(item.status)}</View>
//             <View style={styles.right}>
//               <View style={styles.avatar}>
//                 <MaterialIcons name="person" size={24} color="#fff" />
//               </View>
//               <Text style={styles.assignee}>{item.assignee}</Text>
//             </View>
//           </TouchableOpacity>
//         )}
//       />
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: "#eef5f4" },

//   header: {
//   backgroundColor: "#fff",
//   paddingHorizontal: 16,
//   paddingVertical: 10,
//   flexDirection: "row",
//   justifyContent: "space-between", // left-right spacing
//   alignItems: "center",
//   borderBottomWidth: 1,
//   borderColor: "#e6e6e6",
// },
// headerTitle: {
//   fontSize: 18,
//   fontWeight: "700",
//   color: "#2c3e50",
// },
// iconBtn: {
//   flexDirection: "row",
//   alignItems: "center",
//   gap: 10,
//   backgroundColor: "#e0f7f4",
//   paddingHorizontal: 12,
//   paddingVertical: 6,
//   borderRadius: 8,
//   width:"46%",
// },
// iconText: {
//   fontSize: 14,
//   fontWeight: "600",
//   color: "#1abc9c",
// },

//   searchWrapper: {
//     position: "relative",
//     marginHorizontal: 12,
//     marginVertical: 10,
//   },
//   searchBar: {
//     backgroundColor: "#fff",
//     borderRadius: 12,
//     paddingHorizontal: 16,
//     paddingVertical: 10,
//     fontSize: 14,
//     color: "#2c3e50",
//     paddingRight: 40,
//     shadowColor: "#000",
//     shadowOpacity: 0.05,
//     shadowOffset: { width: 0, height: 2 },
//     shadowRadius: 4,
//     elevation: 2,
//   },
//   searchIcon: {
//     position: "absolute",
//     right: 18,
//     top: 10,
//   },

//   list: { paddingHorizontal: 12, paddingBottom: 32 },

//   card: {
//     flexDirection: "row",
//     backgroundColor: "#fff",
//     paddingHorizontal: 16,
//     paddingVertical: 6,
//     borderRadius: 16,
//     marginBottom: 8,
//     shadowColor: "#000",
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.08,
//     shadowRadius: 6,
//     elevation: 3,
//     alignItems: "center",
//   },
//   left: { flex: 3 },
//   nameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "nowrap" },
//   separator: { fontSize: 14, color: "#7f8c8d", marginHorizontal: 4 },
//   name: { fontSize: 16, fontWeight: "700", color: "#2c3e50" },
//   source: { fontSize: 14 },
//   phone: { fontSize: 14, color: "#7f8c8d", marginTop: 4 },

//   center: { flex: 1, alignItems: "center" },
//   statusBadge: {
//     paddingHorizontal: 12,
//     paddingVertical: 4,
//     borderRadius: 16,
//     alignSelf: "center",
//     minWidth: 80,
//     maxWidth: 120,
//     marginRight: 26,
//     alignItems: "center",
//     justifyContent: "center",
//   },
//   statusText: {
//     fontSize: 12,
//     fontWeight: "700",
//     textAlign: "center",
//     flexShrink: 1,
//   },

//   right: { flex: 1, alignItems: "center" },
//   avatar: {
//     width: 40,
//     height: 40,
//     borderRadius: 20,
//     backgroundColor: "#1abc9c",
//     justifyContent: "center",
//     alignItems: "center",
//     marginBottom: 4,
//   },
//   assignee: { fontSize: 12, color: "#34495e" },
// });




// import React, { useEffect, useState } from "react";
// import {
//   View,
//   Text,
//   FlatList,
//   TouchableOpacity,
//   StyleSheet,
//   TextInput,
// } from "react-native";
// import AsyncStorage from "@react-native-async-storage/async-storage";
// import MaterialIcons from "react-native-vector-icons/MaterialIcons"; // <- add this
// import FontAwesome from "react-native-vector-icons/FontAwesome";


// export type Lead = {
//   id: string;
//   name: string;
//   phone: string;
//   status: "NEW" | "OLD" | "Interested" | "Not Interested" | "Follow Up";
//   assignee: string;
//   source: "fb" | "jd" | "web";
// };

// type Props = {
//   onSelectLead: (phone: string) => void;
//   onOpenDialer: () => void;
//   onOpenHistory: () => void;
// };

// export default function LeadsScreen({ onSelectLead, onOpenDialer, onOpenHistory }: Props) {
//   const [leads, setLeads] = useState<Lead[]>([]);
//   const [searchQuery, setSearchQuery] = useState<string>("");

//   useEffect(() => {
//     loadLeads();
//   }, []);

//   const loadLeads = async () => {
//     const saved = await AsyncStorage.getItem("leads");
//     if (saved) {
//       setLeads(JSON.parse(saved));
//       return;
//     }

//     const dummy: Lead[] = [
//       { id: "1", name: "Ali", phone: "03001234567", status: "NEW", assignee: "Umer", source: "fb" },
//       { id: "2", name: "Umer", phone: "03229199459", status: "NEW", assignee: "Umer", source: "web" },
//       { id: "3", name: "Noman", phone: "03003334444", status: "NEW", assignee: "Ali", source: "fb" },
//       { id: "4", name: "Ahmad", phone: "03005556666", status: "OLD", assignee: "Ali", source: "fb" },
//       { id: "5", name: "Sara", phone: "03008889999", status: "NEW", assignee: "Umer", source: "web" },
//       { id: "6", name: "Hassan", phone: "03112223344", status: "OLD", assignee: "Ali", source: "jd" },
//       { id: "7", name: "Adeel", phone: "03221112233", status: "NEW", assignee: "Umer", source: "fb" },
//       { id: "8", name: "Bilal", phone: "03009998877", status: "OLD", assignee: "Ali", source: "web" },
//     ];

//     setLeads(dummy);
//     await AsyncStorage.setItem("leads", JSON.stringify(dummy));
//   };

//  const renderSourceIcon = (source: Lead["source"]) => {
//   switch (source) {
//     case "fb":
//       return <FontAwesome name="facebook" size={20} color="#1877F2" />;
//     case "jd":
//       return <MaterialIcons name="work" size={20} color="#2C3E50" />;
//     case "web":
//       return <MaterialIcons name="public" size={20} color="#27AE60" />;
//     default:
//       return <MaterialIcons name="help-outline" size={20} color="#7f8c8d" />;
//   }
// };


// const renderStatusBadge = (status: Lead["status"]) => {
//   // Dynamic colors for different statuses
//   let bgColor = "#ecf0f1"; // default light grey
//   let textColor = "#7f8c8d"; // default grey

//   switch (status) {
//     case "NEW":
//       bgColor = "#1abc9c33";
//       textColor = "#1abc9c";
//       break;
//     case "OLD":
//       bgColor = "#e74c3c33";
//       textColor = "#e74c3c";
//       break;
//     case "Not Interested":
//       bgColor = "#e74c3c33";
//       textColor = "#e74c3c";
//       break;
//     case "Interested":
//       bgColor = "#2ecc7133";
//       textColor = "#2ecc71";
//       break;
//     case "Follow Up":
//       bgColor = "#f1c40f33";
//       textColor = "#f1c40f";
//       break;
//     default:
//       bgColor = "#bdc3c733";
//       textColor = "#7f8c8d";
//   }

//   return (
//     <View style={[styles.statusBadge, { backgroundColor: bgColor }]}>
//       <Text style={[styles.statusText, { color: textColor }]} numberOfLines={1} ellipsizeMode="tail">
//         {status}
//       </Text>
//     </View>
//   );
// };


//   const filteredLeads = leads.filter(
//     (lead) =>
//       lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
//       lead.phone.includes(searchQuery)
//   );

//   return (
//     <View style={styles.container}>
//       {/* HEADER: Only buttons */}
//       <View style={styles.header}>
//         <TouchableOpacity style={styles.headerBtn} onPress={onOpenDialer}>
//           <Text style={styles.headerBtnText}>Dialer</Text>
//         </TouchableOpacity>
//         <TouchableOpacity style={styles.headerBtn} onPress={onOpenHistory}>
//           <Text style={styles.headerBtnText}>History</Text>
//         </TouchableOpacity>
//       </View>

//       {/* SEARCH BAR */}
//       <View style={styles.searchWrapper}>
//         <TextInput
//           placeholder="Search by name or phone..."
//           placeholderTextColor="#7f8c8d"
//           style={styles.searchBar}
//           value={searchQuery}
//           onChangeText={setSearchQuery}
//         />
//         <MaterialIcons name="search" size={22} color="#7f8c8d" style={styles.searchIcon} />
//       </View>

//       {/* LIST */}
//       <FlatList
//         data={filteredLeads}
//         keyExtractor={(item) => item.id}
//         contentContainerStyle={styles.list}
//         renderItem={({ item }) => (
//           <TouchableOpacity
//             style={styles.card}
//             onPress={() => onSelectLead(item.phone)}
//           >
//             {/* LEFT: Name, Phone, Source */}
//             <View style={styles.left}>
//               <View style={styles.nameRow}>
//                 <Text style={styles.name}>{item.name}</Text>
//                 <Text style={styles.separator}>|</Text>
//                 <Text style={styles.source}>{renderSourceIcon(item.source)}</Text>
//               </View>
//               <Text style={styles.phone}>{item.phone}</Text>
//             </View>

//             {/* CENTER: Status */}
//             <View style={styles.center}>{renderStatusBadge(item.status)}</View>

//             {/* RIGHT: Avatar & Assignee */}
//             <View style={styles.right}>
//               <View style={styles.avatar}>
//                 <MaterialIcons name="person" size={24} color="#fff" />
//               </View>
//               <Text style={styles.assignee}>{item.assignee}</Text>
//             </View>
//           </TouchableOpacity>
//         )}
//       />
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: "#eef5f4" },

//   header: {
//     backgroundColor: "#ffffff",
//     paddingHorizontal: 16,
//     paddingVertical: 10,
//     flexDirection: "row",
//     justifyContent: "space-around",
//     gap: 10,
//     borderBottomWidth: 1,
//     borderColor: "#e6e6e6",
//   },
//   headerBtn: {
//     backgroundColor: "#1abc9c",
//     width: 100,
//     height: 32,
//     paddingHorizontal: 14,
//     paddingVertical: 6,
//     justifyContent: "center",
//     borderRadius: 6,
//   },
//   headerBtnText: { color: "#fff", textAlign: "center", fontWeight: "600", fontSize: 15 },

//   searchWrapper: {
//     position: "relative",
//     marginHorizontal: 12,
//     marginVertical: 10,
//   },
//   searchBar: {
//     backgroundColor: "#fff",
//     borderRadius: 12,
//     paddingHorizontal: 16,
//     paddingVertical: 10,
//     fontSize: 14,
//     color: "#2c3e50",
//     paddingRight: 40, // space for icon
//     shadowColor: "#000",
//     shadowOpacity: 0.05,
//     shadowOffset: { width: 0, height: 2 },
//     shadowRadius: 4,
//     elevation: 2,
//   },
//   searchIcon: {
//     position: "absolute",
//     right: 18,
//     top: 10,
//   },

//   list: { paddingHorizontal: 12, paddingBottom: 32 },

//   card: {
//     flexDirection: "row",
//     backgroundColor: "#fff",
//     paddingHorizontal: 16,
//     paddingVertical: 6,
//     borderRadius: 16,
//     marginBottom: 8,
//     shadowColor: "#000",
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.08,
//     shadowRadius: 6,
//     elevation: 3,
//     alignItems: "center",
//   },

//   left: { flex: 3 },
// nameRow: { 
//   flexDirection: "row", 
//   alignItems: "center", 
//   gap: 6,
//   flexWrap: "nowrap",
// },
// separator: {
//   fontSize: 14,
//   color: "#7f8c8d",
//   marginHorizontal: 4,
// },
//   name: { fontSize: 16, fontWeight: "700", color: "#2c3e50" },
//   source: { fontSize: 14 },
//   phone: { fontSize: 14, color: "#7f8c8d", marginTop: 4 },

//   center: { flex: 1, alignItems: "center" },
//  statusBadge: {
//   paddingHorizontal: 12,      // enough padding for text
//   paddingVertical: 4,
//   borderRadius: 16,
//   alignSelf: "center",         // centers the badge horizontally in its container
//   minWidth: 80,                // ensures very short text looks good
//   maxWidth: 120,  
//   marginRight:26,           // prevents badge from overflowing on small screens
//   alignItems: "center",
//   justifyContent: "center",
// },
// statusText: {
//   fontSize: 12,
//   fontWeight: "700",
//   textAlign: "center",
//   flexShrink: 1,               // text shrinks slightly if needed
// },


//   right: { flex: 1, alignItems: "center" },
//   avatar: {
//     width: 40,
//     height: 40,
//     borderRadius: 20,
//     backgroundColor: "#1abc9c",
//     justifyContent: "center",
//     alignItems: "center",
//     marginBottom: 4,
//   },
//   assignee: { fontSize: 12, color: "#34495e" },
// });



// import React, { useEffect, useState } from "react";
// import {
//   View,
//   Text,
//   FlatList,
//   TouchableOpacity,
//   StyleSheet,
// } from "react-native";
// import AsyncStorage from "@react-native-async-storage/async-storage";

// export type Lead = {
//   id: string;
//   name: string;
//   phone: string;
//   status: "NEW" | "OLD";
//   assignee: string;
//   source: "fb" | "jd" | "web";
// };

// type Props = {
//   onSelectLead: (phone: string) => void;
// };

// export default function LeadsScreen({ onSelectLead }: Props) {
//   const [leads, setLeads] = useState<Lead[]>([]);

//   useEffect(() => {
//     loadLeads();
//   }, []);

//   const loadLeads = async () => {
//     const saved = await AsyncStorage.getItem("leads");
//     if (saved) {
//       setLeads(JSON.parse(saved));
//       return;
//     }

//     const dummy: Lead[] = [
//       { id: "1", name: "Kishan Jain", phone: "03001234567", status: "NEW", assignee: "Rajat", source: "jd" },
//       { id: "2", name: "Mohit Singh", phone: "03001112222", status: "NEW", assignee: "Amit", source: "web" },
//       { id: "3", name: "Nitin Agarwal", phone: "03003334444", status: "NEW", assignee: "Rajat", source: "fb" },
//       { id: "4", name: "Praksh Rao", phone: "03005556666", status: "NEW", assignee: "Amit", source: "jd" },
//       { id: "5", name: "Priya Kumari", phone: "03007778888", status: "NEW", assignee: "Amit", source: "jd" },
//     ];

//     setLeads(dummy);
//     await AsyncStorage.setItem("leads", JSON.stringify(dummy));
//   };

//   const renderSource = (source: Lead["source"]) => {
//     if (source === "fb") return "f";
//     if (source === "jd") return "Jd";
//     return "🌐";
//   };

//   const renderAvatar = (name: string) => {
//     const initial = name.charAt(0).toUpperCase();
//     return <Text style={styles.avatarText}>{initial}</Text>;
//   };

//   return (
//     <FlatList
//       data={leads}
//       keyExtractor={(item) => item.id}
//       contentContainerStyle={styles.list}
//       renderItem={({ item }) => (
//         <TouchableOpacity
//           style={styles.row}
//           onPress={() => onSelectLead(item.phone)}
//         >
//           {/* LEFT */}
//           <View style={styles.left}>
//             <View style={styles.nameRow}>
//               <Text style={styles.name}>{item.name}</Text>
//               <Text style={styles.source}>{renderSource(item.source)}</Text>
//             </View>

//             <View style={styles.statusRow}>
//               <Text style={styles.statusLabel}>Status :</Text>
//               <Text style={styles.status}> {item.status}</Text>
//             </View>
//           </View>

//           {/* RIGHT */}
//           <View style={styles.right}>
//             <View style={styles.avatar}>
//               {renderAvatar(item.assignee)}
//             </View>
//             <Text style={styles.assignee}>{item.assignee}</Text>
//             <Text style={styles.arrow}>›</Text>
//           </View>
//         </TouchableOpacity>
//       )}
//     />
//   );
// }

// const styles = StyleSheet.create({
//   list: {
//     backgroundColor: "#eef5f4",
//   },

//   row: {
//     flexDirection: "row",
//     backgroundColor: "#fff",
//     paddingVertical: 10,
//     paddingHorizontal: 12,
//     borderBottomWidth: 1,
//     borderColor: "#e6e6e6",
//     alignItems: "center",
//   },

//   left: {
//     flex: 1,
//   },

//   nameRow: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 6,
//   },

//   name: {
//     fontSize: 16,
//     fontWeight: "600",
//     color: "#2c3e50",
//   },

//   source: {
//     fontSize: 13,
//     color: "#f39c12",
//     fontWeight: "700",
//   },

//   statusRow: {
//     flexDirection: "row",
//     marginTop: 4,
//   },

//   statusLabel: {
//     fontSize: 12,
//     color: "#7f8c8d",
//   },

//   status: {
//     fontSize: 12,
//     color: "#e74c3c",
//     fontWeight: "700",
//   },

//   right: {
//     alignItems: "center",
//     width: 80,
//   },

//   avatar: {
//     width: 36,
//     height: 36,
//     borderRadius: 18,
//     backgroundColor: "#1abc9c",
//     justifyContent: "center",
//     alignItems: "center",
//   },

//   avatarText: {
//     color: "#fff",
//     fontWeight: "700",
//   },

//   assignee: {
//     fontSize: 11,
//     marginTop: 4,
//     color: "#34495e",
//   },

//   arrow: {
//     position: "absolute",
//     right: -4,
//     fontSize: 22,
//     color: "#95a5a6",
//   },
// });




// import React, { useEffect, useState } from "react";
// import {
//   View,
//   Text,
//   FlatList,
//   TouchableOpacity,
//   StyleSheet,
//   Alert,
// } from "react-native";
// import AsyncStorage from "@react-native-async-storage/async-storage";

// export type Lead = {
//   id: string;
//   name: string;
//   phone: string;
//   status: "New" | "Old" | "Contacted" | "Pending";
//   assignee: string;
// };

// type Props = {
//   onSelectLead: (phone: string) => void;
// };

// export default function LeadsScreen({ onSelectLead }: Props) {
//   const [leads, setLeads] = useState<Lead[]>([]);

//   useEffect(() => {
//     loadLeads();
//   }, []);

//   const loadLeads = async () => {
//     const saved = await AsyncStorage.getItem("leads");
//     if (saved) {
//       setLeads(JSON.parse(saved));
//     } else {
//       // Dummy leads for first-time load
//       const dummyLeads: Lead[] = [
//         { id: "1", name: "Ali Khan", phone: "03001234567", status: "New", assignee: "Umer" },
//         { id: "2", name: "Sara Ahmed", phone: "03007654321", status: "Old", assignee: "Ayesha" },
//         { id: "3", name: "Hassan Raza", phone: "03009871234", status: "Contacted", assignee: "Ali" },
//         { id: "4", name: "Fatima Noor", phone: "03005551234", status: "Pending", assignee: "Zara" },
//         { id: "5", name: "Ahmed Shah", phone: "03002223344", status: "New", assignee: "Umer" },
//       ];
//       setLeads(dummyLeads);
//       await AsyncStorage.setItem("leads", JSON.stringify(dummyLeads));
//     }
//   };

//   const getStatusColor = (status: Lead["status"]) => {
//     switch (status) {
//       case "New":
//         return "#3498db"; // Blue
//       case "Old":
//         return "#95a5a6"; // Gray
//       case "Contacted":
//         return "#2ecc71"; // Green
//       case "Pending":
//         return "#e67e22"; // Orange
//       default:
//         return "#bdc3c7"; // Light gray
//     }
//   };

//   const handlePress = (phone: string) => {
//     Alert.alert("Call Lead", `Call ${phone}?`, [
//       { text: "Cancel", style: "cancel" },
//       { text: "Call", onPress: () => onSelectLead(phone) },
//     ]);
//   };

//   return (
//     <FlatList
//       data={leads}
//       keyExtractor={(item) => item.id}
//       contentContainerStyle={styles.listContainer}
//       renderItem={({ item }) => (
//         <TouchableOpacity
//           style={styles.leadCard}
//           onPress={() => handlePress(item.phone)}
//         >
//           <View style={styles.cardHeader}>
//             <Text style={styles.leadName}>{item.name}</Text>
//             <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
//               <Text style={styles.statusText}>{item.status}</Text>
//             </View>
//           </View>
//           <Text style={styles.leadPhone}>📞 {item.phone}</Text>
//           <Text style={styles.leadAssignee}>Assignee: {item.assignee}</Text>
//         </TouchableOpacity>
//       )}
//     />
//   );
// }

// const styles = StyleSheet.create({
//   listContainer: {
//     padding: 16,
//     paddingBottom: 32,
//   },
//   leadCard: {
//     backgroundColor: "#fff",
//     padding: 16,
//     borderRadius: 12,
//     marginBottom: 12,
//     shadowColor: "#000",
//     shadowOpacity: 0.05,
//     shadowOffset: { width: 0, height: 2 },
//     elevation: 3,
//   },
//   cardHeader: {
//     flexDirection: "row",
//     justifyContent: "space-between",
//     alignItems: "center",
//   },
//   leadName: {
//     fontSize: 18,
//     fontWeight: "700",
//     color: "#2c3e50",
//   },
//   statusBadge: {
//     paddingHorizontal: 8,
//     paddingVertical: 2,
//     borderRadius: 8,
//   },
//   statusText: {
//     color: "#fff",
//     fontSize: 12,
//     fontWeight: "600",
//   },
//   leadPhone: {
//     fontSize: 16,
//     marginTop: 8,
//     color: "#34495e",
//   },
//   leadAssignee: {
//     fontSize: 14,
//     marginTop: 4,
//     color: "#7f8c8d",
//   },
// });




// import React, { useEffect, useState } from "react";
// import { Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
// import { loadLeads, saveLeads } from "../db/storage";

// export type Lead = {
//   id: number;
//   name: string;
//   phone: string;
//   status: "New" | "Old";
//   assignee: string;
// };

// type Props = {
//   onSelectLead: (phone: string) => void;
// };

// export default function LeadsScreen({ onSelectLead }: Props) {
//   const [leads, setLeads] = useState<Lead[]>([]);

//   useEffect(() => {
//     const init = async () => {
//       let storedLeads = await loadLeads();
//       if (storedLeads.length === 0) {
//         // create dummy leads if nothing is stored
//         storedLeads = [
//           { id: 1, name: "Ali Khan", phone: "03001234567", status: "New", assignee: "Umer" },
//           { id: 2, name: "Sara Ahmed", phone: "03007654321", status: "Old", assignee: "Ayesha" },
//         ];
//         await saveLeads(storedLeads);
//       }
//       setLeads(storedLeads);
//     };
//     init();
//   }, []);

//   return (
//     <FlatList
//       data={leads}
//       keyExtractor={(item) => item.id.toString()}
//       contentContainerStyle={styles.listContainer}
//       renderItem={({ item }) => (
//         <TouchableOpacity
//           style={styles.leadCard}
//           onPress={() => onSelectLead(item.phone)}
//         >
//           <Text style={styles.leadName}>{item.name}</Text>
//           <Text style={styles.leadPhone}>{item.phone}</Text>
//           <Text style={styles.leadStatus}>Status: {item.status}</Text>
//           <Text style={styles.leadAssignee}>Assignee: {item.assignee}</Text>
//         </TouchableOpacity>
//       )}
//     />
//   );
// }

// const styles = StyleSheet.create({
//   listContainer: { padding: 16 },
//   leadCard: {
//     padding: 16,
//     marginBottom: 12,
//     borderRadius: 12,
//     backgroundColor: "#fff",
//     shadowColor: "#000",
//     shadowOpacity: 0.05,
//     shadowOffset: { width: 0, height: 2 },
//     elevation: 3,
//   },
//   leadName: { fontSize: 18, fontWeight: "700", color: "#2f3640" },
//   leadPhone: { fontSize: 16, marginTop: 4, color: "#718093" },
//   leadStatus: { marginTop: 4, fontWeight: "600", color: "#44bd32" },
//   leadAssignee: { marginTop: 2, color: "#718093" },
// });
