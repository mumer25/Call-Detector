import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Linking,
  Alert,
  ScrollView,
  Modal,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { getLeads, insertHistory, getHistory, updateLeadStatusDB } from "../db/database";

/* ================= TYPES ================= */
type LeadStatus =
  | "New"
  | "Wrong Number"
  | "Not Interested"
  | "Interested:Warm"
  | "Interested:Hot"
  | `Follow Up: ${string}`;

export type Lead = {
  name?: string;
  phone: string;
  status?: LeadStatus;
  note?: string;
};

export type DialerCallLog = {
  id: number;
  number: string;
  type: "incoming" | "outgoing" | "missed" | "dialed";
  status?: LeadStatus;
  note?: string;
  duration?: number;
  time: string;
};


type Props = {
  phone: string;
  leads: Lead[];
  onSelectLead: (phone: string) => void;
  onOpenTimeline?: () => void;
};

/* ================= SCREEN ================= */
export default function DialerScreen({ phone, leads, onSelectLead, onOpenTimeline }: Props) {
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<LeadStatus>("New");
  const [leadName, setLeadName] = useState<string>("");
  const [leadLogs, setLeadLogs] = useState<DialerCallLog[]>([]);
  const [showTick, setShowTick] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<LeadStatus | null>(null);

  const [showInterestModal, setShowInterestModal] = useState(false);
  const [selectedInterest, setSelectedInterest] = useState<"Warm" | "Hot" | null>(null);

  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpDate, setFollowUpDate] = useState<Date | null>(new Date());
  const [followUpMode, setFollowUpMode] = useState<"date" | "time">("date");

  const normalize = (num: string) => num.replace(/\D/g, "");

  /* ================= LOAD LEAD ================= */
  const loadLead = useCallback(async () => {
    try {
      const dbLeads = await getLeads();
      const found = dbLeads.find((l) => normalize(l.phone) === normalize(phone));
      if (found) {
        setLeadName(found.name || phone);
        setStatus(found.status || "New");
      } else {
        setLeadName(phone);
      }
    } catch (e) {
      console.error("Failed to load lead:", e);
      setLeadName(phone);
    }
  }, [phone]);

 const loadLeadLogs = useCallback(async () => {
  try {
    const logs = await getHistory();

    // const mapped: DialerCallLog[] = logs
    //   .filter((l) => normalize(l.number) === normalize(phone))
    //   .map((l) => ({
    //     id: Number(l.id),                 // ✅ FIX: string → number
    //     number: l.number,
    //     type: l.type ?? "dialed",
    //     duration: l.duration ?? 0,
    //     time: l.time,
    //   }));

    const mapped: DialerCallLog[] = logs
  .filter((l) => normalize(l.number) === normalize(phone))
  .map((l) => {
    // Force type into allowed values
    let type: DialerCallLog["type"] = "dialed"; // default
    if (l.type === "incoming" || l.type === "outgoing" || l.type === "missed") {
      type = l.type;
    }

    return {
      id: Number(l.id),                 // string → number
      number: l.number,
      type,
      duration: l.duration ?? 0,
      time: l.time,
    };
  });

    setLeadLogs(mapped);
  } catch (e) {
    console.error("Failed to load history:", e);
  }
}, [phone]);


  useEffect(() => {
    loadLead();
    loadLeadLogs();
  }, [loadLead, loadLeadLogs]);

  /* ================= HELPERS ================= */
  const getWhatsAppNumber = () => {
    const digits = normalize(phone);
    return digits.length > 10 ? digits : `91${digits}`;
  };

  const updateLeadStatusHandler = async (newStatus: LeadStatus) => {
    setStatus(newStatus);
    try {
      await updateLeadStatusDB(phone, newStatus);
      setShowTick(false);
      setPendingStatus(null);
    } catch (e) {
      console.error("Failed to update lead status:", e);
    }
  };


  const makeCall = async () => {
  try {
    const dialUrl = `tel:${phone}`;
    await Linking.openURL(dialUrl);
    // Do NOT insert call log here
  } catch {
    Alert.alert("Dialer Error", "Unable to open phone dialer on this device.");
  }
};


  // const makeCall = async () => {
  //   try {
  //     const dialUrl = `tel:${phone}`;
  //     await Linking.openURL(dialUrl);

  //     await insertHistory(null, phone, new Date().toISOString(), 0);
  //     loadLeadLogs();
  //   } catch {
  //     Alert.alert("Dialer Error", "Unable to open phone dialer on this device.");
  //   }
  // };

  // const openWhatsAppFollowUp = async () => {
  //   const message = note
  //     ? `Hi ${leadName}, ${note}`
  //     : `Hi ${leadName}, just following up regarding our conversation.`;

  //   const whatsappUrl = `whatsapp://send?phone=${getWhatsAppNumber()}&text=${encodeURIComponent(
  //     message
  //   )}`;

  //   try {
  //     await Linking.openURL(whatsappUrl);
  //   } catch {
  //     Alert.alert(
  //       "WhatsApp not available",
  //       "Please install WhatsApp or check the phone number format."
  //     );
  //   }
  // };

  const openWhatsAppFollowUp = async () => {
  const message = note
    ? `Hi ${leadName}, ${note}`
    : `Hi ${leadName}, just following up regarding our conversation.`;

  const whatsappUrl = `whatsapp://send?phone=${getWhatsAppNumber()}&text=${encodeURIComponent(
    message
  )}`;

  try {
    await Linking.openURL(whatsappUrl);

    // Insert WhatsApp log (optional, immediately)
    await insertHistory(null, phone, new Date().toISOString(), 0, "whatsapp");

    // Instead of updating status immediately, set as pending
    const updatedStatus: LeadStatus = `Follow Up: ${new Date().toLocaleString()}`;
    setPendingStatus(updatedStatus);
    setShowTick(true);

    // Reload logs to show the WhatsApp entry
    loadLeadLogs();
  } catch {
    Alert.alert(
      "WhatsApp not available",
      "Please install WhatsApp or check the phone number format."
    );
  }
};

//   const openWhatsAppFollowUp = async () => {
//   const message = note
//     ? `Hi ${leadName}, ${note}`
//     : `Hi ${leadName}, just following up regarding our conversation.`;

//   const whatsappUrl = `whatsapp://send?phone=${getWhatsAppNumber()}&text=${encodeURIComponent(
//     message
//   )}`;

//   try {
//     await Linking.openURL(whatsappUrl);

//     // Insert WhatsApp log
//     await insertHistory(null, phone, new Date().toISOString(), 0, "whatsapp");

//     // Automatically update lead status
//   const updatedStatus: LeadStatus = `Follow Up: ${new Date().toLocaleString()}`;
// setStatus(updatedStatus);
// await updateLeadStatusDB(phone, updatedStatus);

//     // Reload logs
//     loadLeadLogs();
//   } catch {
//     Alert.alert(
//       "WhatsApp not available",
//       "Please install WhatsApp or check the phone number format."
//     );
//   }
// };


  const handleActionClick = (
    action: "Wrong Number" | "Not Interested" | "Interested" | "Follow Up"
  ) => {
    if (action === "Interested") {
      setShowInterestModal(true);
    } else if (action === "Follow Up") {
      setShowFollowUpModal(true);
    } else {
      setPendingStatus(action);
      setShowTick(true);
    }
  };

  const confirmTick = () => {
    if (pendingStatus) updateLeadStatusHandler(pendingStatus);
  };

  const selectInterestLevel = (level: "Warm" | "Hot") => {
    setSelectedInterest(level);
    setPendingStatus(`Interested:${level}`);
    setShowInterestModal(false);
    setShowTick(true);
  };

 const goToNextLead = () => {
  if (!leads.length) return;

  const currentIndex = leads.findIndex(
    (l) => normalize(l.phone) === normalize(phone)
  );

  if (currentIndex === -1) {
    console.warn("Current lead not found in leads list");
    return;
  }

  const nextIndex = (currentIndex + 1) % leads.length;
  onSelectLead(leads[nextIndex].phone);
};

const goToPreviousLead = () => {
  if (!leads.length) return;

  const currentIndex = leads.findIndex(
    (l) => normalize(l.phone) === normalize(phone)
  );

  if (currentIndex === -1) {
    console.warn("Current lead not found in leads list");
    return;
  }

  const prevIndex =
    (currentIndex - 1 + leads.length) % leads.length;

  onSelectLead(leads[prevIndex].phone);
};


  const totalDuration = leadLogs.reduce((sum, l) => sum + (l.duration || 0), 0);
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  /* ================= UI ================= */
  return (
    <View style={styles.mainContainer}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* LEAD CARD */}
        <View style={styles.leadCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{leadName.charAt(0)}</Text>
          </View>

          <View style={styles.leadInfo}>
            <Text style={styles.leadName}>{leadName}</Text>
            <Text style={styles.leadPhone}>{phone}</Text>

            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>{status.toUpperCase()}</Text>
            </View>

            {leadLogs.length > 0 && (
              <View style={styles.historySummary}>
                {/* <Text style={styles.historyText}>Total Calls: {leadLogs.length}</Text> */}
                <Text style={styles.historyText}>
                  Call Duration: {formatDuration(totalDuration)}
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.callButton} onPress={makeCall}>
            <Ionicons name="call" size={26} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* ACTION BUTTONS */}
        <View style={styles.actionsRow}>
          <ActionButton
            label="Wrong Number"
            icon="close-circle"
            color="#e74c3c"
            onPress={() => handleActionClick("Wrong Number")}
          />
          <ActionButton
            label="Not Interested"
            icon="thumbs-down"
            color="#f33412"
            onPress={() => handleActionClick("Not Interested")}
          />
          <ActionButton
            label="Interested"
            icon="thumbs-up"
            color="#2ecc71"
            onPress={() => handleActionClick("Interested")}
          />
          <ActionButton
            label="Follow Up"
            icon="calendar"
            color="#3498db"
            onPress={() => handleActionClick("Follow Up")}
          />

          <ActionButton
            label="Whatsapp"
            icon="logo-whatsapp"
            color="#25D366"
            onPress={openWhatsAppFollowUp}
          />
        </View>

        {/* NOTE INPUT */}
        <TextInput
          placeholder="Add note..."
          value={note}
          onChangeText={setNote}
          multiline
          style={styles.noteBox}
        />

        {/* TICK MARK */}
        {showTick && (
          <View style={styles.tickContainer}>
            <TouchableOpacity style={styles.tickCircle} onPress={confirmTick}>
              <Ionicons name="checkmark" size={36} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* FIXED PREVIOUS/NEXT BUTTONS */}
     <View style={styles.fixedBottom}>
  {/* Previous Lead */}
<TouchableOpacity style={styles.prevNextButton} onPress={goToPreviousLead}>
  <View style={styles.iconContainer}>
    <Ionicons name="chevron-back" size={24} color="#fff" />
  </View>
  <View style={styles.textContainer}>
    <Text style={styles.prevNextText}>Previous Lead</Text>
  </View>
</TouchableOpacity>

  {/* Timeline */}
  <TouchableOpacity
    style={styles.timelineButton}
    onPress={() => onOpenTimeline && onOpenTimeline()}
  >
    <Ionicons name="time" size={36} color="#038ba0" />
  </TouchableOpacity>

  {/* Next Lead */}
 <TouchableOpacity style={styles.prevNextButton} onPress={goToNextLead}>
  <View style={styles.textContainer}>
    <Text style={styles.prevNextText}>Next Lead</Text>
  </View>
  <View style={styles.iconContainer}>
    <Ionicons name="chevron-forward" size={24} color="#fff" />
  </View>
</TouchableOpacity>
</View>


      {/* INTEREST MODAL */}
      <Modal transparent visible={showInterestModal} animationType="fade">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Interest Level</Text>

            {["Warm", "Hot"].map((level) => (
              <TouchableOpacity
                key={level}
                style={[
                  styles.optionRow,
                  selectedInterest === level ? styles.modalButtonSelected : null,
                ]}
                onPress={() => setSelectedInterest(level as "Warm" | "Hot")}
              >
                <View style={styles.radioCircle}>
                  {selectedInterest === level && <View style={styles.checkedCircle} />}
                </View>
                <Text style={styles.optionText}>{level}</Text>
              </TouchableOpacity>
            ))}

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={() => {
                  if (selectedInterest) selectInterestLevel(selectedInterest);
                }}
              >
                <Text style={styles.modalButtonText}>Confirm</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowInterestModal(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* FOLLOW-UP MODAL */}
      {showFollowUpModal && (
        <Modal transparent animationType="fade">
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select Follow-Up Date & Time</Text>

              <DateTimePicker
                value={followUpDate || new Date()}
                mode={followUpMode}
                display="default"
                onChange={(event: DateTimePickerEvent, selected?: Date) => {
                  if (event.type === "set" && selected) {
                    const updated = new Date(followUpDate || new Date());
                    if (followUpMode === "date") {
                      updated.setFullYear(selected.getFullYear());
                      updated.setMonth(selected.getMonth());
                      updated.setDate(selected.getDate());
                      setFollowUpDate(updated);
                      setFollowUpMode("time");
                    } else {
                      updated.setHours(selected.getHours());
                      updated.setMinutes(selected.getMinutes());
                      setFollowUpDate(updated);
                      setPendingStatus(`Follow Up: ${updated.toLocaleString()}`);
                      setShowTick(true);
                      setFollowUpMode("date");
                      setShowFollowUpModal(false);
                    }
                  } else if (event.type === "dismissed") {
                    setShowFollowUpModal(false);
                    setFollowUpMode("date");
                  }
                }}
                style={styles.dateTimePicker}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

/* ================= ACTION BUTTON ================= */
function ActionButton({
  label,
  icon,
  color,
  onPress,
}: {
  label: string;
  icon: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.actionItem} onPress={onPress}>
      <Ionicons name={icon} size={40} color={color} />
      <Text style={styles.actionText}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ================= STYLES ================= */
const styles = StyleSheet.create({
  mainContainer: { flex: 1 },
  container: { flex: 1, backgroundColor: "#eef5f4", padding: 16 },
  scrollContent: { paddingBottom: 100 },
  leadCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 10,
    alignItems: "center",
    elevation: 4,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#16a085",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 20, fontWeight: "700" },
  leadInfo: { flex: 1, marginLeft: 12 },
  leadName: { fontSize: 18, fontWeight: "700", color: "#2c3e50" },
  leadPhone: { fontSize: 14, color: "#555", marginTop: 2 },
  statusBadge: {
    marginTop: 6,
    backgroundColor: "#ecf0f1",
    paddingHorizontal: 4,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  statusBadgeText: { fontSize: 10, fontWeight: "600", color: "#555" },
  historySummary: { marginTop: 2, paddingHorizontal: 2, paddingVertical: 4, borderRadius: 6 },
  historyText: { fontSize: 10, color: "#34495e" },
  callButton: {
    backgroundColor: "#2ecc71",
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  actionsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 20 },
  actionItem: { flex: 1, alignItems: "center", marginHorizontal: 4 },
  actionText: { fontSize: 11, marginTop: 6, textAlign: "center" },
  noteBox: {
    backgroundColor: "#fff",
    marginTop: 20,
    borderRadius: 12,
    padding: 12,
    height: 200,
    textAlignVertical: "top",
  },
  tickContainer: { alignItems: "center", marginTop: 10 },
  tickCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#2ecc71", alignItems: "center", justifyContent: "center", elevation: 4 },
  fixedBottom: {
  position: "absolute",
  bottom: 12,
  left: 12,
  right: 12,
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
},

// Make both buttons same width
prevNextButton: {
  flex: 1,
  flexDirection: "row",
  alignItems: "center",
  backgroundColor: "#1abc9c",
  paddingVertical: 12,
  borderRadius: 12,
  marginHorizontal: 2,
},

iconContainer: {
  width: 18,              // fixed width for icon
  alignItems: "center",   // center icon in its container
},
textContainer: {
  flex: 0.9,                 // takes remaining space
  alignItems: "center",    // center text
},

prevNextText: {
  color: "#fff",
  fontWeight: "700",
  fontSize: 12,
  textAlign: "center",
},

timelineButton: {
  width: 60,
  height: 60,
  borderRadius: 30,
  backgroundColor: "#fff",
  alignItems: "center",
  justifyContent: "center",
  marginHorizontal: 4,
  elevation: 4,
},
  modalContainer: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  modalContent: { backgroundColor: "#fff", padding: 20, borderRadius: 14, width: "80%", alignItems: "center" },
  modalTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  modalButtonSelected: { backgroundColor: "#bcedd0" },
  optionRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 8, width: "100%", borderRadius: 10, borderWidth: 1, borderColor: "#ecf0f1", marginVertical: 6 },
  radioCircle: { height: 24, width: 24, borderRadius: 12, borderWidth: 2, borderColor: "#2ecc71", alignItems: "center", justifyContent: "center", marginRight: 12 },
  checkedCircle: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#90e3b2" },
  optionText: { fontSize: 16, color: "#2c3e50" },
  modalButtonsRow: { flexDirection: "row", justifyContent: "space-between", gap: 20, marginTop: 20 },
  modalConfirmButton: { width: 90, backgroundColor: "#2ecc71", paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  modalCancelButton: { width: 90, backgroundColor: "#e74c3c", paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  dateTimePicker: { width: "100%", marginVertical: 6 },
  modalButtonText: { color: "#fff", fontWeight: "700", fontSize: 14, textAlign: "center" },
});



// /* ================= Updated DB Storage Storing Data in DB ================= *
// import React, { useEffect, useState, useCallback } from "react";
// import {
//   View,
//   Text,
//   TouchableOpacity,
//   StyleSheet,
//   TextInput,
//   Linking,
//   Alert,
//   ScrollView,
//   Modal
// } from "react-native";
// import AsyncStorage from "@react-native-async-storage/async-storage";
// import Ionicons from "react-native-vector-icons/Ionicons";
// import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";

// /* ================= TYPES ================= */
// type LeadStatus =
//   | "New"
//   | "Wrong Number"
//   | "Not Interested"
//   | "Interested:Warm"
//   | "Interested:Hot"
//   | `Follow Up: ${string}`;

// export type Lead = {
//   name?: string;
//   phone: string;
//   status?: LeadStatus;
//   note?: string;
// };

// export type CallLog = {
//   id: string;
//   number: string;
//   type: "incoming" | "outgoing" | "missed" | "dialed";
//   status?: LeadStatus;
//   note?: string;
//   duration?: number;
//   time: string;
// };

// type Props = {
//   phone: string;
//   leads: Lead[];
//   onSelectLead: (phone: string) => void;
// };

// /* ================= SCREEN ================= */
// export default function DialerScreen({ phone, leads, onSelectLead }: Props) {
//   const [note, setNote] = useState("");
//   const [status, setStatus] = useState<LeadStatus>("New");
//   const [leadName, setLeadName] = useState<string>("");
//   const [leadLogs, setLeadLogs] = useState<CallLog[]>([]);
//   const [showTick, setShowTick] = useState(false);
//   const [pendingStatus, setPendingStatus] = useState<LeadStatus | null>(null);

//   const [showInterestModal, setShowInterestModal] = useState(false);
//   const [selectedInterest, setSelectedInterest] = useState<"Warm" | "Hot" | null>(null);

//   const [showFollowUpModal, setShowFollowUpModal] = useState(false);
//   const [followUpDate, setFollowUpDate] = useState<Date | null>(new Date());

//   const [followUpMode, setFollowUpMode] = useState<"date" | "time">("date");


//   const normalize = (num: string) => num.replace(/\D/g, "");

//   /* ================= LOAD LEAD ================= */
//   const loadLead = useCallback(async () => {
//     try {
//       const savedLeads = await AsyncStorage.getItem("leads");
//       if (!savedLeads) {
//         setLeadName(phone);
//         return;
//       }
//       const parsedLeads: Lead[] = JSON.parse(savedLeads);
//       const found = parsedLeads.find(
//         (l) => normalize(l.phone) === normalize(phone)
//       );
//       if (found) {
//         setLeadName(found.name || phone);
//         setStatus(found.status || "New");
//       } else {
//         setLeadName(phone);
//       }
//     } catch {
//       setLeadName(phone);
//     }
//   }, [phone]);

//   const loadLeadLogs = useCallback(async () => {
//     try {
//       const savedLogs = await AsyncStorage.getItem("logs");
//       if (!savedLogs) return setLeadLogs([]);
//       const parsedLogs: CallLog[] = JSON.parse(savedLogs);
//       const filteredLogs = parsedLogs.filter(
//         (l) =>
//           normalize(l.number) === normalize(phone) &&
//           ["incoming", "outgoing", "missed"].includes(l.type)
//       );
//       setLeadLogs(filteredLogs);
//     } catch (e) {
//       console.error("Failed to load logs", e);
//     }
//   }, [phone]);

//   useEffect(() => {
//     loadLead();
//     loadLeadLogs();
//   }, [loadLead, loadLeadLogs]);

//   /* ================= HELPERS ================= */
//   const getWhatsAppNumber = () => {
//     const digits = normalize(phone);
//     if (digits.length > 10) return digits;
//     return `91${digits}`;
//   };

//   const updateLeadStatus = async (newStatus: LeadStatus) => {
//     setStatus(newStatus);
//     try {
//       const savedLeads = await AsyncStorage.getItem("leads");
//       if (!savedLeads) return;

//       const parsedLeads: Lead[] = JSON.parse(savedLeads);
//       const updatedLeads = parsedLeads.map((l) =>
//         normalize(l.phone) === normalize(phone) ? { ...l, status: newStatus } : l
//       );

//       await AsyncStorage.setItem("leads", JSON.stringify(updatedLeads));
//       setShowTick(false);
//       setPendingStatus(null);
//     } catch (e) {
//       console.error("Failed to update lead status", e);
//     }
//   };

// const makeCall = async () => {
//   try {
//     const dialUrl = `tel:${phone}`;

//     // Do NOT block with canOpenURL on Android
//     await Linking.openURL(dialUrl);

//     // Save log after opening dialer
//     const savedLogs = await AsyncStorage.getItem("logs");
//     const logs: CallLog[] = savedLogs ? JSON.parse(savedLogs) : [];

//     const newLog: CallLog = {
//       id: Date.now().toString(),
//       number: phone,
//       type: "outgoing",
//       status,
//       note,
//       duration: 0, // real duration not available without CallLog permission
//       time: new Date().toLocaleString(),
//     };

//     logs.unshift(newLog);
//     await AsyncStorage.setItem("logs", JSON.stringify(logs));

//     setLeadLogs(
//       logs.filter(
//         (l) =>
//           normalize(l.number) === normalize(phone) &&
//           ["incoming", "outgoing", "missed"].includes(l.type)
//       )
//     );
//   } catch  {
//     Alert.alert(
//       "Dialer Error",
//       "Unable to open phone dialer on this device."
//     );
//   }
// };


//   // const makeCall = async () => {
//   //   const url = `tel:${phone}`;
//   //   if (await Linking.canOpenURL(url)) Linking.openURL(url);

//   //   try {
//   //     const savedLogs = await AsyncStorage.getItem("logs");
//   //     const logs: CallLog[] = savedLogs ? JSON.parse(savedLogs) : [];

//   //     const newLog: CallLog = {
//   //       id: Date.now().toString(),
//   //       number: phone,
//   //       type: "outgoing",
//   //       status,
//   //       note,
//   //       duration: Math.floor(Math.random() * 300),
//   //       time: new Date().toLocaleString(),
//   //     };

//   //     logs.unshift(newLog);
//   //     await AsyncStorage.setItem("logs", JSON.stringify(logs));

//   //     const filteredLogs = logs.filter(
//   //       (l) =>
//   //         normalize(l.number) === normalize(phone) &&
//   //         ["incoming", "outgoing", "missed"].includes(l.type)
//   //     );
//   //     setLeadLogs(filteredLogs);
//   //   } catch {}
//   // };

//   const openWhatsAppFollowUp = async () => {
//     const message = note
//       ? `Hi ${leadName}, ${note}`
//       : `Hi ${leadName}, just following up regarding our conversation.`;

//     const whatsappUrl = `whatsapp://send?phone=${getWhatsAppNumber()}&text=${encodeURIComponent(
//       message
//     )}`;

//     try {
//       await Linking.openURL(whatsappUrl);
//     } catch {
//       Alert.alert(
//         "WhatsApp not available",
//         "Please install WhatsApp or check the phone number format."
//       );
//     }
//   };

//   const handleActionClick = (
//     action: "Wrong Number" | "Not Interested" | "Interested" | "Follow Up"
//   ) => {
//     if (action === "Interested") {
//       setShowInterestModal(true);
//     } else if (action === "Follow Up") {
//       setShowFollowUpModal(true);
//     } else {
//       setPendingStatus(action);
//       setShowTick(true);
//     }
//   };

//   const confirmTick = () => {
//     if (pendingStatus) updateLeadStatus(pendingStatus);
//   };

//   const selectInterestLevel = (level: "Warm" | "Hot") => {
//     setSelectedInterest(level);
//     setPendingStatus(`Interested:${level}`);
//     setShowInterestModal(false);
//     setShowTick(true);
//   };

//   const goToNextLead = () => {
//     if (!leads || leads.length === 0) return;
//     const currentIndex = leads.findIndex(
//       (l) => normalize(l.phone) === normalize(phone)
//     );
//     const nextIndex = (currentIndex + 1) % leads.length;
//     const nextLead = leads[nextIndex];
//     if (nextLead) onSelectLead(nextLead.phone);
//   };

//   const goToPreviousLead = () => {
//     if (!leads || leads.length === 0) return;
//     const currentIndex = leads.findIndex(
//       (l) => normalize(l.phone) === normalize(phone)
//     );
//     const prevIndex = (currentIndex - 1 + leads.length) % leads.length;
//     const prevLead = leads[prevIndex];
//     if (prevLead) onSelectLead(prevLead.phone);
//   };

//   const totalDuration = leadLogs.reduce((sum, l) => sum + (l.duration || 0), 0);
//   const formatDuration = (seconds: number) => {
//     const mins = Math.floor(seconds / 60);
//     const secs = seconds % 60;
//     return `${mins}m ${secs}s`;
//   };

//   /* ================= UI ================= */
//   return (
//     <View style={styles.mainContainer}>
//       <ScrollView
//         style={styles.container}
//         contentContainerStyle={styles.scrollContent}
//       >
//         {/* LEAD CARD */}
//         <View style={styles.leadCard}>
//           <View style={styles.avatar}>
//             <Text style={styles.avatarText}>{leadName.charAt(0)}</Text>
//           </View>

//           <View style={styles.leadInfo}>
//             <Text style={styles.leadName}>{leadName}</Text>
//             <Text style={styles.leadPhone}>{phone}</Text>

//             <View style={styles.statusBadge}>
//               <Text style={styles.statusBadgeText}>{status.toUpperCase()}</Text>
//             </View>

//             {leadLogs.length > 0 && (
//               <View style={styles.historySummary}>
//                 <Text style={styles.historyText}>
//                   Total Calls: {leadLogs.length}
//                 </Text>
//                 <Text style={styles.historyText}>
//                   Total Duration: {formatDuration(totalDuration)}
//                 </Text>
//               </View>
//             )}
//           </View>

//           <TouchableOpacity style={styles.callButton} onPress={makeCall}>
//             <Ionicons name="call" size={26} color="#fff" />
//           </TouchableOpacity>
//         </View>

//         {/* ACTION BUTTONS */}
//         <View style={styles.actionsRow}>
//           <ActionButton
//             label="Wrong Number"
//             icon="close-circle"
//             color="#e74c3c"
//             onPress={() => handleActionClick("Wrong Number")}
//           />
//           <ActionButton
//             label="Not Interested"
//             icon="thumbs-down"
//             color="#f33412"
//             onPress={() => handleActionClick("Not Interested")}
//           />
//           <ActionButton
//             label="Interested"
//             icon="thumbs-up"
//             color="#2ecc71"
//             onPress={() => handleActionClick("Interested")}
//           />
//           <ActionButton
//             label="Follow Up"
//             icon="calendar"
//             color="#3498db"
//             onPress={() => handleActionClick("Follow Up")}
//           />

//           <ActionButton
//             label="Whatsapp"
//             icon="logo-whatsapp"
//             color="#25D366"
//             onPress={openWhatsAppFollowUp}
//           />
//         </View>

//         {/* NOTE INPUT */}
//         <TextInput
//           placeholder="Add note..."
//           value={note}
//           onChangeText={setNote}
//           multiline
//           style={styles.noteBox}
//         />

//         {/* TICK MARK */}
//         {showTick && (
//           <View style={styles.tickContainer}>
//             <TouchableOpacity style={styles.tickCircle} onPress={confirmTick}>
//               <Ionicons name="checkmark" size={36} color="#fff" />
//             </TouchableOpacity>
//           </View>
//         )}
//       </ScrollView>

//       {/* FIXED PREVIOUS/NEXT BUTTONS */}
//       <View style={styles.fixedBottom}>
//         <TouchableOpacity style={styles.prevNextButton} onPress={goToPreviousLead}>
//           <Ionicons name="chevron-back" size={24} color="#fff" />
//           <Text style={styles.prevNextText}>Previous Lead</Text>
//         </TouchableOpacity>

//         <TouchableOpacity style={styles.prevNextButton} onPress={goToNextLead}>
//           <Text style={styles.prevNextText}>Next Lead</Text>
//           <Ionicons name="chevron-forward" size={24} color="#fff" />
//         </TouchableOpacity>
//       </View>

//       {/* INTEREST MODAL */}
//       <Modal transparent visible={showInterestModal} animationType="fade">
//         <View style={styles.modalContainer}>
//           <View style={styles.modalContent}>
//             <Text style={styles.modalTitle}>Select Interest Level</Text>

//             {["Warm", "Hot"].map((level) => (
//               <TouchableOpacity
//                 key={level}
//                 style={[
//                   styles.optionRow,
//                   selectedInterest === level ? styles.modalButtonSelected : null,
//                 ]}
//                 onPress={() => setSelectedInterest(level as "Warm" | "Hot")}
//               >
//                 <View style={styles.radioCircle}>
//                   {selectedInterest === level && <View style={styles.checkedCircle} />}
//                 </View>
//                 <Text style={styles.optionText}>{level}</Text>
//               </TouchableOpacity>
//             ))}

//             <View style={styles.modalButtonsRow}>
//               <TouchableOpacity
//                 style={styles.modalConfirmButton}
//                 onPress={() => {
//                   if (selectedInterest) selectInterestLevel(selectedInterest);
//                 }}
//               >
//                 <Text style={styles.modalButtonText}>Confirm</Text>
//               </TouchableOpacity>

//               <TouchableOpacity
//                 style={styles.modalCancelButton}
//                 onPress={() => setShowInterestModal(false)}
//               >
//                 <Text style={styles.modalButtonText}>Cancel</Text>
//               </TouchableOpacity>
//             </View>
//           </View>
//         </View>
//       </Modal>

//       {/* FOLLOW-UP MODAL */}
//      {showFollowUpModal && (
//   <Modal transparent animationType="fade">
//     <View style={styles.modalContainer}>
//       <View style={styles.modalContent}>
//         <Text style={styles.modalTitle}>Select Follow-Up Date & Time</Text>

//         <DateTimePicker
//           value={followUpDate || new Date()}
//           mode={followUpMode}
//           display="default"
//           onChange={(event: DateTimePickerEvent, selected?: Date) => {
//             if (event.type === "set" && selected) {
//               if (followUpMode === "date") {
//                 // Save selected date
//                 const updated = new Date(followUpDate || new Date());
//                 updated.setFullYear(selected.getFullYear());
//                 updated.setMonth(selected.getMonth());
//                 updated.setDate(selected.getDate());
//                 setFollowUpDate(updated);

//                 // Switch to time picker
//                 setFollowUpMode("time");
//               } else if (followUpMode === "time") {
//                 // Save selected time
//                 const updated = new Date(followUpDate || new Date());
//                 updated.setHours(selected.getHours());
//                 updated.setMinutes(selected.getMinutes());
//                 setFollowUpDate(updated);

//                 // Close modal
//                 setShowFollowUpModal(false);
//                 setPendingStatus(`Follow Up: ${updated.toLocaleString()}`);
//                 setShowTick(true);
//                 // Reset mode for next time
//                 setFollowUpMode("date");
//               }
//             } else if (event.type === "dismissed") {
//               // User cancelled: close modal and reset mode
//               setShowFollowUpModal(false);
//               setFollowUpMode("date");
//             }
//           }}
//           style={styles.dateTimePicker}
//         />
//       </View>
//     </View>
//   </Modal>
// )}

//     </View>
//   );
// }

// /* ================= ACTION BUTTON ================= */
// function ActionButton({
//   label,
//   icon,
//   color,
//   onPress,
// }: {
//   label: string;
//   icon: string;
//   color: string;
//   onPress: () => void;
// }) {
//   return (
//     <TouchableOpacity style={styles.actionItem} onPress={onPress}>
//       <Ionicons name={icon} size={40} color={color} />
//       <Text style={styles.actionText}>{label}</Text>
//     </TouchableOpacity>
//   );
// }

// /* ================= STYLES ================= */
// const styles = StyleSheet.create({
//   mainContainer: { flex: 1 },
//   container: { flex: 1, backgroundColor: "#eef5f4", padding: 16 },
//   scrollContent: { paddingBottom: 100 },
//   leadCard: {
//     flexDirection: "row",
//     backgroundColor: "#fff",
//     borderRadius: 14,
//     padding: 10,
//     alignItems: "center",
//     elevation: 4,
//   },
//   avatar: {
//     width: 50,
//     height: 50,
//     borderRadius: 25,
//     backgroundColor: "#16a085",
//     alignItems: "center",
//     justifyContent: "center",
//   },
//   avatarText: { color: "#fff", fontSize: 20, fontWeight: "700" },
//   leadInfo: { flex: 1, marginLeft: 12 },
//   leadName: { fontSize: 18, fontWeight: "700", color: "#2c3e50" },
//   leadPhone: { fontSize: 14, color: "#555", marginTop: 2 },
//   statusBadge: {
//     marginTop: 6,
//     backgroundColor: "#ecf0f1",
//     paddingHorizontal: 8,
//     borderRadius: 6,
//     alignSelf: "flex-start",
//   },
//   statusBadgeText: { fontSize: 11, fontWeight: "600", color: "#555" },
//   historySummary: { marginTop: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
//   historyText: { fontSize: 10, color: "#34495e" },
//   callButton: {
//     backgroundColor: "#2ecc71",
//     width: 56,
//     height: 56,
//     borderRadius: 28,
//     alignItems: "center",
//     justifyContent: "center",
//   },
//  actionsRow: {
//   flexDirection: "row",
//   justifyContent: "space-between", // space between buttons
//   marginTop: 20,
// },

// actionItem: {
//   flex: 1,                  // each button grows equally to fit
//   alignItems: "center",
//   marginHorizontal: 4,      // small spacing between buttons
// },

//   actionText: { fontSize: 11, marginTop: 6, textAlign: "center" },
//   noteBox: { backgroundColor: "#fff", marginTop: 20, borderRadius: 12, padding: 12, height: 200, textAlignVertical: "top" },
//   tickContainer: { alignItems: "center", marginTop: 10 },
//   tickCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#2ecc71", alignItems: "center", justifyContent: "center", elevation: 4 },
//   fixedBottom: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", padding: 12 },
//   prevNextButton: { flex: 0.48, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#1abc9c", paddingVertical: 12, borderRadius: 10, gap: 6 },
//   prevNextText: { color: "#fff", fontWeight: "700", fontSize: 14 },
//   modalContainer: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
//   modalContent: { backgroundColor: "#fff", padding: 20, borderRadius: 14, width: "80%", alignItems: "center" },
//   modalTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
//   modalButtonSelected: { backgroundColor: "#bcedd0" },
//   optionRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 8, width: "100%", borderRadius: 10, borderWidth: 1, borderColor: "#ecf0f1", marginVertical: 6 },
//   radioCircle: { height: 24, width: 24, borderRadius: 12, borderWidth: 2, borderColor: "#2ecc71", alignItems: "center", justifyContent: "center", marginRight: 12 },
//   checkedCircle: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#90e3b2" },
//   optionText: { fontSize: 16, color: "#2c3e50" },
//   modalButtonsRow: { flexDirection: "row", justifyContent: "space-between", gap: 20, marginTop: 20 },
//   modalConfirmButton: { width: 90, backgroundColor: "#2ecc71", paddingVertical: 12, borderRadius: 10, alignItems: "center" },
//   modalCancelButton: { width: 90, backgroundColor: "#e74c3c", paddingVertical: 12, borderRadius: 10, alignItems: "center" },
//   dateTimePicker: { width: "100%", marginVertical: 6 },
//   modalButtonText: {
//   color: "#fff",
//   fontWeight: "700",
//   fontSize: 14,
//   textAlign: "center",
// },

// });




// import React, { useEffect, useState, useCallback } from "react";
// import {
//   View,
//   Text,
//   TouchableOpacity,
//   StyleSheet,
//   TextInput,
//   Linking,
//   Alert,
//   ScrollView,
//   Modal,
// } from "react-native";
// import AsyncStorage from "@react-native-async-storage/async-storage";
// import Ionicons from "react-native-vector-icons/Ionicons";
// import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";



// /* ================= TYPES ================= */
// type LeadStatus =
//   | "New"
//   | "Wrong Number"
//   | "Not Interested"
//   | "Interested:Warm"
//   | "Interested:Hot"
//   | `Follow Up: ${string}`;

// export type Lead = {
//   name?: string;
//   phone: string;
//   status?: LeadStatus;
//   note?: string;
// };

// export type CallLog = {
//   id: string;
//   number: string;
//   type: "incoming" | "outgoing" | "missed" | "dialed";
//   status?: LeadStatus;
//   note?: string;
//   duration?: number;
//   time: string;
// };

// type Props = {
//   phone: string;
//   leads: Lead[];
//   onSelectLead: (phone: string) => void;
// };

// /* ================= SCREEN ================= */
// export default function DialerScreen({ phone, leads, onSelectLead }: Props) {
//   const [note, setNote] = useState("");
//   const [status, setStatus] = useState<LeadStatus>("New");
//   const [leadName, setLeadName] = useState<string>("");
//   const [leadLogs, setLeadLogs] = useState<CallLog[]>([]);
//   const [showTick, setShowTick] = useState(false);
//   const [pendingStatus, setPendingStatus] = useState<LeadStatus | null>(null);
//   const [showInterestModal, setShowInterestModal] = useState(false);
//   const [selectedInterest, setSelectedInterest] = useState<"Warm" | "Hot" | null>(null);

//   const [showFollowUpModal, setShowFollowUpModal] = useState(false);
// const [followUpDate, setFollowUpDate] = useState<Date | null>(null);



//   const normalize = (num: string) => num.replace(/\D/g, "");

//   /* ================= LOAD LEAD ================= */
//   const loadLead = useCallback(async () => {
//     try {
//       const savedLeads = await AsyncStorage.getItem("leads");
//       if (!savedLeads) {
//         setLeadName(phone);
//         return;
//       }
//       const parsedLeads: Lead[] = JSON.parse(savedLeads);
//       const found = parsedLeads.find(
//         (l) => normalize(l.phone) === normalize(phone)
//       );
//       if (found) {
//         setLeadName(found.name || phone);
//         setStatus(found.status || "New");
//       } else {
//         setLeadName(phone);
//       }
//     } catch {
//       setLeadName(phone);
//     }
//   }, [phone]);

//   const loadLeadLogs = useCallback(async () => {
//     try {
//       const savedLogs = await AsyncStorage.getItem("logs");
//       if (!savedLogs) return setLeadLogs([]);
//       const parsedLogs: CallLog[] = JSON.parse(savedLogs);
//       const filteredLogs = parsedLogs.filter(
//         (l) =>
//           normalize(l.number) === normalize(phone) &&
//           ["incoming", "outgoing", "missed"].includes(l.type)
//       );
//       setLeadLogs(filteredLogs);
//     } catch (e) {
//       console.error("Failed to load logs", e);
//     }
//   }, [phone]);

//   useEffect(() => {
//     loadLead();
//     loadLeadLogs();
//   }, [loadLead, loadLeadLogs]);

//   /* ================= HELPERS ================= */
//   const getWhatsAppNumber = () => {
//     const digits = normalize(phone);
//     if (digits.length > 10) return digits;
//     return `91${digits}`;
//   };

//   const updateLeadStatus = async (newStatus: LeadStatus) => {
//     setStatus(newStatus);
//     try {
//       const savedLeads = await AsyncStorage.getItem("leads");
//       if (!savedLeads) return;

//       const parsedLeads: Lead[] = JSON.parse(savedLeads);
//       const updatedLeads = parsedLeads.map((l) =>
//         normalize(l.phone) === normalize(phone) ? { ...l, status: newStatus } : l
//       );

//       await AsyncStorage.setItem("leads", JSON.stringify(updatedLeads));
//       setShowTick(false);
//       setPendingStatus(null);
//     } catch (e) {
//       console.error("Failed to update lead status", e);
//     }
//   };

//   const makeCall = async () => {
//     const url = `tel:${phone}`;
//     if (await Linking.canOpenURL(url)) Linking.openURL(url);

//     try {
//       const savedLogs = await AsyncStorage.getItem("logs");
//       const logs: CallLog[] = savedLogs ? JSON.parse(savedLogs) : [];

//       const newLog: CallLog = {
//         id: Date.now().toString(),
//         number: phone,
//         type: "outgoing",
//         status,
//         note,
//         duration: Math.floor(Math.random() * 300),
//         time: new Date().toLocaleString(),
//       };

//       logs.unshift(newLog);
//       await AsyncStorage.setItem("logs", JSON.stringify(logs));

//       const filteredLogs = logs.filter(
//         (l) =>
//           normalize(l.number) === normalize(phone) &&
//           ["incoming", "outgoing", "missed"].includes(l.type)
//       );
//       setLeadLogs(filteredLogs);
//     } catch {}
//   };

//   const openWhatsAppFollowUp = async () => {
//     const message = note
//       ? `Hi ${leadName}, ${note}`
//       : `Hi ${leadName}, just following up regarding our conversation.`;

//     const whatsappUrl = `whatsapp://send?phone=${getWhatsAppNumber()}&text=${encodeURIComponent(
//       message
//     )}`;

//     try {
//       await Linking.openURL(whatsappUrl);
//     } catch {
//       Alert.alert(
//         "WhatsApp not available",
//         "Please install WhatsApp or check the phone number format."
//       );
//     }
//   };

//   const handleActionClick = (action: "Wrong Number" | "Not Interested" | "Interested" | "Follow Up") => {
//     if (action === "Interested") {
//       setShowInterestModal(true);
//     }
//     else if (action === "Follow Up") {
//     setShowFollowUpModal(true);
//   } 
//     else {
//       setPendingStatus(action);
//       setShowTick(true);
//     }
//   };

//   const confirmTick = () => {
//     if (pendingStatus) {
//       updateLeadStatus(pendingStatus);
//     }
//   };

//   const selectInterestLevel = (level: "Warm" | "Hot") => {
//     setSelectedInterest(level);
//     setPendingStatus(`Interested:${level}`);
//     setShowInterestModal(false);
//     setShowTick(true);
//   };

//   const goToNextLead = () => {
//     if (!leads || leads.length === 0) return;
//     const currentIndex = leads.findIndex((l) => normalize(l.phone) === normalize(phone));
//     const nextIndex = (currentIndex + 1) % leads.length;
//     const nextLead = leads[nextIndex];
//     if (nextLead) onSelectLead(nextLead.phone);
//   };

//   const goToPreviousLead = () => {
//     if (!leads || leads.length === 0) return;
//     const currentIndex = leads.findIndex((l) => normalize(l.phone) === normalize(phone));
//     const prevIndex = (currentIndex - 1 + leads.length) % leads.length;
//     const prevLead = leads[prevIndex];
//     if (prevLead) onSelectLead(prevLead.phone);
//   };

//   const totalDuration = leadLogs.reduce((sum, l) => sum + (l.duration || 0), 0);
//   const formatDuration = (seconds: number) => {
//     const mins = Math.floor(seconds / 60);
//     const secs = seconds % 60;
//     return `${mins}m ${secs}s`;
//   };

//   /* ================= UI ================= */
//   return (
//     <View style={styles.mainContainer}>
//       <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
//         {/* LEAD CARD */}
//         <View style={styles.leadCard}>
//           <View style={styles.avatar}>
//             <Text style={styles.avatarText}>{leadName.charAt(0)}</Text>
//           </View>

//           <View style={styles.leadInfo}>
//             <Text style={styles.leadName}>{leadName}</Text>
//             <Text style={styles.leadPhone}>{phone}</Text>

//             <View style={styles.statusBadge}>
//               <Text style={styles.statusBadgeText}>{status.toUpperCase()}</Text>
//             </View>

//             {leadLogs.length > 0 && (
//               <View style={styles.historySummary}>
//                 <Text style={styles.historyText}>Total Calls: {leadLogs.length}</Text>
//                 <Text style={styles.historyText}>
//                   Total Duration: {formatDuration(totalDuration)}
//                 </Text>
//               </View>
//             )}
//           </View>

//           <TouchableOpacity style={styles.callButton} onPress={makeCall}>
//             <Ionicons name="call" size={26} color="#fff" />
//           </TouchableOpacity>
//         </View>

//         {/* ACTION BUTTONS */}
//         <View style={styles.actionsRow}>
//           <ActionButton
//             label="Wrong Number"
//             icon="close-circle"
//             color="#e74c3c"
//             onPress={() => handleActionClick("Wrong Number")}
//           />
//           <ActionButton
//             label="Not Interested"
//             icon="thumbs-down"
//             color="#f33412"
//             onPress={() => handleActionClick("Not Interested")}
//           />
//           <ActionButton
//             label="Interested"
//             icon="thumbs-up"
//             color="#2ecc71"
//             onPress={() => handleActionClick("Interested")}
//           />
//           <ActionButton
//   label="Follow Up"
//   icon="calendar"
//   color="#3498db"
//   onPress={() => handleActionClick("Follow Up")}
// />

//           <ActionButton
//             label="Whatsapp"
//             icon="logo-whatsapp"
//             color="#25D366"
//             onPress={openWhatsAppFollowUp}
//           />
//         </View>

//         {/* NOTE INPUT */}
//         <TextInput
//           placeholder="Add note..."
//           value={note}
//           onChangeText={setNote}
//           multiline
//           style={styles.noteBox}
//         />

//         {/* TICK MARK */}
//         {showTick && (
//           <View style={styles.tickContainer}>
//             <TouchableOpacity style={styles.tickCircle} onPress={confirmTick}>
//               <Ionicons name="checkmark" size={36} color="#fff" />
//             </TouchableOpacity>
//           </View>
//         )}
//       </ScrollView>

//       {/* FIXED PREVIOUS/NEXT BUTTONS */}
//       <View style={styles.fixedBottom}>
//         <TouchableOpacity style={styles.prevNextButton} onPress={goToPreviousLead}>
//           <Ionicons name="chevron-back" size={24} color="#fff" />
//           <Text style={styles.prevNextText}>Previous Lead</Text>
//         </TouchableOpacity>

//         <TouchableOpacity style={styles.prevNextButton} onPress={goToNextLead}>
//           <Text style={styles.prevNextText}>Next Lead</Text>
//           <Ionicons name="chevron-forward" size={24} color="#fff" />
//         </TouchableOpacity>
//       </View>

//       {/* INTEREST MODAL */}
//      {/* INTEREST MODAL */}
// <Modal transparent visible={showInterestModal} animationType="fade">
//   <View style={styles.modalContainer}>
//     <View style={styles.modalContent}>
//       <Text style={styles.modalTitle}>Select Interest Level</Text>

//       {["Warm", "Hot"].map((level) => (
//         <TouchableOpacity
//           key={level}
//           style={[
//             styles.optionRow,
//             selectedInterest === level ? styles.modalButtonSelected : null,
//           ]}
//           onPress={() => setSelectedInterest(level as "Warm" | "Hot")}
//         >
//           <View style={styles.radioCircle}>
//             {selectedInterest === level && <View style={styles.checkedCircle} />}
//           </View>
//           <Text style={styles.optionText}>{level}</Text>
//         </TouchableOpacity>
//       ))}

//       <View style={styles.modalButtonsRow}>
//         <TouchableOpacity
//           style={styles.modalConfirmButton}
//           onPress={() => {
//             if (selectedInterest) selectInterestLevel(selectedInterest);
//           }}
//         >
//           <Text style={styles.modalButtonText}>Confirm</Text>
//         </TouchableOpacity>

//         <TouchableOpacity
//           style={styles.modalCancelButton}
//           onPress={() => setShowInterestModal(false)}
//         >
//           <Text style={styles.modalButtonText}>Cancel</Text>
//         </TouchableOpacity>
//       </View>
//     </View>
//   </View>
// </Modal>
// {showFollowUpModal && (
//   <Modal transparent animationType="fade">
//     <View style={styles.modalContainer}>
//       <View style={styles.modalContent}>
//         <Text style={styles.modalTitle}>Select Follow-Up Date & Time</Text>

//         <DateTimePicker
//           value={followUpDate || new Date()}
//           mode="date"
//           display="default"
//           onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
//             if (event.type === "set" && selectedDate) {
//               setFollowUpDate(selectedDate);
//             }
//           }}
//           style={styles.dateTimePicker}
//         />

//         <DateTimePicker
//           value={followUpDate || new Date()}
//           mode="time"
//           display="spinner"
//           onChange={(event: DateTimePickerEvent, selectedTime?: Date) => {
//             if (event.type === "set" && selectedTime) {
//               const updated = new Date(followUpDate || new Date());
//               updated.setHours(selectedTime.getHours());
//               updated.setMinutes(selectedTime.getMinutes());
//               setFollowUpDate(updated);
//             }
//           }}
//           style={styles.dateTimePicker}
//         />

//         <View style={styles.modalButtonsRow}>
//           <TouchableOpacity
//             style={styles.modalConfirmButton}
//             onPress={() => {
//               if (followUpDate) {
//                 setPendingStatus(`Follow Up: ${followUpDate.toLocaleString()}`);
//                 setShowFollowUpModal(false); // Close modal
//                 setShowTick(true); // Show tick
//               }
//             }}
//           >
//             <Text style={styles.modalButtonText}>Confirm</Text>
//           </TouchableOpacity>

//           <TouchableOpacity
//             style={styles.modalCancelButton}
//             onPress={() => setShowFollowUpModal(false)}
//           >
//             <Text style={styles.modalButtonText}>Cancel</Text>
//           </TouchableOpacity>
//         </View>
//       </View>
//     </View>
//   </Modal>
// )}




//     </View>
//   );
// }

// /* ================= ACTION BUTTON ================= */
// function ActionButton({
//   label,
//   icon,
//   color,
//   onPress,
// }: {
//   label: string;
//   icon: string;
//   color: string;
//   onPress: () => void;
// }) {
//   return (
//     <TouchableOpacity style={styles.actionItem} onPress={onPress}>
//       <Ionicons name={icon} size={40} color={color} />
//       <Text style={styles.actionText}>{label}</Text>
//     </TouchableOpacity>
//   );
// }

// /* ================= STYLES ================= */
// const styles = StyleSheet.create({
//   mainContainer: { flex: 1 },
//   container: { flex: 1, backgroundColor: "#eef5f4", padding: 16 },
//   scrollContent: { paddingBottom: 100 }, // extra space for fixed bottom
//   leadCard: {
//     flexDirection: "row",
//     backgroundColor: "#fff",
//     borderRadius: 14,
//     padding: 10,
//     alignItems: "center",
//     elevation: 4,
//   },
//   avatar: {
//     width: 50,
//     height: 50,
//     borderRadius: 25,
//     backgroundColor: "#16a085",
//     alignItems: "center",
//     justifyContent: "center",
//   },
//   avatarText: { color: "#fff", fontSize: 20, fontWeight: "700" },
//   leadInfo: { flex: 1, marginLeft: 12 },
//   leadName: { fontSize: 18, fontWeight: "700", color: "#2c3e50" },
//   leadPhone: { fontSize: 14, color: "#555", marginTop: 2 },
//   statusBadge: {
//     marginTop: 6,
//     backgroundColor: "#ecf0f1",
//     paddingHorizontal: 8,
//     borderRadius: 6,
//     alignSelf: "flex-start",
//   },
//   statusBadgeText: { fontSize: 11, fontWeight: "600", color: "#555" },
//   historySummary: {
//     marginTop: 6,
//     // backgroundColor: "#f1f2f6",
//     paddingHorizontal: 8,
//     paddingVertical: 4,
//     borderRadius: 6,
//   },
//   historyText: { fontSize: 10, color: "#34495e" },
//   callButton: {
//     backgroundColor: "#2ecc71",
//     width: 56,
//     height: 56,
//     borderRadius: 28,
//     alignItems: "center",
//     justifyContent: "center",
//   },
//   actionsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 20 },
//   actionItem: { alignItems: "center", width: "23%" },
//   actionText: { fontSize: 11, marginTop: 6, textAlign: "center" },
//   noteBox: {
//     backgroundColor: "#fff",
//     marginTop: 20,
//     borderRadius: 12,
//     padding: 12,
//     height: 200,
//     textAlignVertical: "top",
//   },
//   tickContainer: { alignItems: "center", marginTop: 20 },
//   tickCircle: {
//     width: 60,
//     height: 60,
//     borderRadius: 30,
//     backgroundColor: "#2ecc71",
//     alignItems: "center",
//     justifyContent: "center",
//     elevation: 4,
//   },
//   fixedBottom: {
//     position: "absolute",
//     bottom: 0,
//     left: 0,
//     right: 0,
//     flexDirection: "row",
//     justifyContent: "space-between",
//     padding: 12,
//   },
//   prevNextButton: {
//     flex: 0.48,
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "center",
//     backgroundColor: "#1abc9c",
//     paddingVertical: 12,
//     borderRadius: 10,
//     gap: 6,
//   },
//   prevNextText: { color: "#fff", fontWeight: "700", fontSize: 14 },
//   modalContainer: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
//   modalContent: { backgroundColor: "#fff", padding: 20, borderRadius: 14, width: "80%", alignItems: "center" },
//   modalTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
//   modalButton: { backgroundColor: "#2ecc71", paddingVertical: 10, paddingHorizontal: 30, borderRadius: 10, marginVertical: 6 },
//   modalButtonCancel: { backgroundColor: "#ccc", paddingVertical: 10, paddingHorizontal: 30, borderRadius: 10, marginVertical: 6 },
//   modalButtonText: { color: "#fff", fontWeight: "700" },

//    modalButtonSelected: {
//     backgroundColor: "#bcedd0",
//   },
//   // Option row with radio
// optionRow: {
//   flexDirection: "row",
//   alignItems: "center",
//   paddingVertical: 12,
//   paddingHorizontal: 8,
//   width: "100%",
//   borderRadius: 10,
//   borderWidth: 1,
//   borderColor: "#ecf0f1",
//   marginVertical: 6,
// },

// radioCircle: {
//   height: 24,
//   width: 24,
//   borderRadius: 12,
//   borderWidth: 2,
//   borderColor: "#2ecc71",
//   alignItems: "center",
//   justifyContent: "center",
//   marginRight: 12,
// },

// checkedCircle: {
//   width: 12,
//   height: 12,
//   borderRadius: 6,
//   backgroundColor: "#90e3b2",
// },

// optionText: {
//   fontSize: 16,
//   color: "#2c3e50",
// },

// modalButtonsRow: {
//   flexDirection: "row",
//   justifyContent: "space-between",
//   gap: 20,
//   marginTop: 20,
// },

// modalConfirmButton: {
//   width: 90, // fixed width
//   backgroundColor: "#2ecc71",
//   paddingVertical: 12,
//   borderRadius: 10,
//   alignItems: "center",
// },

// modalCancelButton: {
//   width: 90, // fixed width
//   backgroundColor: "#e74c3c",
//   paddingVertical: 12,
//   borderRadius: 10,
//   alignItems: "center",
// },

// dateTimeButton: {
//   width: "100%",
//   paddingVertical: 12,
//   paddingHorizontal: 16,
//   borderRadius: 10,
//   borderWidth: 1,
//   borderColor: "#2ecc71",
//   marginVertical: 6,
//   alignItems: "center",
// },
// dateTimeText: {
//   fontSize: 16,
//   color: "#2c3e50",
// },
// dateTimePicker: {
//   width: "100%",
//   marginVertical: 6,
// },


// });



// import React, { useEffect, useState, useCallback } from "react";
// import {
//   View,
//   Text,
//   TouchableOpacity,
//   StyleSheet,
//   TextInput,
//   Linking,
//   Alert,
// } from "react-native";
// import AsyncStorage from "@react-native-async-storage/async-storage";
// import Ionicons from "react-native-vector-icons/Ionicons";

// /* ================= TYPES ================= */

// type LeadStatus = "New" | "Wrong Number" | "Not Interested" | "Interested";

// export type Lead = {
//   name?: string;
//   phone: string;
//   status?: LeadStatus;
// };

// type Props = {
//   phone: string;
//   leads: Lead[]; // Full leads list
//   onSelectLead: (phone: string) => void; // Function to switch to next lead
// };

// /* ================= SCREEN ================= */

// export default function DialerScreen({ phone, leads, onSelectLead }: Props) {
//   const [note, setNote] = useState("");
//   const [status, setStatus] = useState<LeadStatus>("New");
//   const [leadName, setLeadName] = useState<string>("");

//   /* ================= LOAD LEAD ================= */

//   const normalize = (num: string) => num.replace(/\D/g, "");

//   const loadLead = useCallback(async () => {
//     try {
//       const savedLeads = await AsyncStorage.getItem("leads");
//       if (!savedLeads) {
//         setLeadName(phone);
//         return;
//       }

//       const parsedLeads: Lead[] = JSON.parse(savedLeads);
//       const found = parsedLeads.find(
//         (l) => normalize(l.phone) === normalize(phone)
//       );

//       if (found) {
//         setLeadName(found.name || phone);
//         setStatus(found.status || "New");
//       } else {
//         setLeadName(phone);
//       }
//     } catch {
//       setLeadName(phone);
//     }
//   }, [phone]);

//   useEffect(() => {
//     loadLead();
//   }, [loadLead]);

//   /* ================= HELPERS ================= */

//   const getWhatsAppNumber = () => {
//     const digits = normalize(phone);
//     if (digits.length > 10) return digits;
//     return `91${digits}`; // Default country code
//   };

//   const updateLeadStatus = async (newStatus: LeadStatus) => {
//     setStatus(newStatus);

//     try {
//       const savedLeads = await AsyncStorage.getItem("leads");
//       if (!savedLeads) return;

//       const parsedLeads: Lead[] = JSON.parse(savedLeads);
//       const updatedLeads = parsedLeads.map((l) =>
//         normalize(l.phone) === normalize(phone) ? { ...l, status: newStatus } : l
//       );

//       await AsyncStorage.setItem("leads", JSON.stringify(updatedLeads));
//     } catch {}
//   };

//   const makeCall = async () => {
//     const url = `tel:${phone}`;
//     if (await Linking.canOpenURL(url)) Linking.openURL(url);

//     try {
//       const savedLogs = await AsyncStorage.getItem("logs");
//       const logs = savedLogs ? JSON.parse(savedLogs) : [];

//       logs.unshift({
//         id: Date.now().toString(),
//         name: leadName,
//         number: phone,
//         status,
//         note,
//         time: new Date().toLocaleString(),
//       });

//       await AsyncStorage.setItem("logs", JSON.stringify(logs));
//     } catch {}
//   };

//   const openWhatsAppFollowUp = async () => {
//     const message = note
//       ? `Hi ${leadName}, ${note}`
//       : `Hi ${leadName}, just following up regarding our conversation.`;

//     const whatsappUrl = `whatsapp://send?phone=${getWhatsAppNumber()}&text=${encodeURIComponent(
//       message
//     )}`;

//     try {
//       await Linking.openURL(whatsappUrl);
//     } catch {
//       Alert.alert(
//         "WhatsApp not available",
//         "Please install WhatsApp or check the phone number format."
//       );
//     }
//   };

//   /* ================= NEXT LEAD ================= */

//   const goToNextLead = () => {
//     if (!leads || leads.length === 0) return;

//     const currentIndex = leads.findIndex((l) => normalize(l.phone) === normalize(phone));
//     const nextIndex = (currentIndex + 1) % leads.length; // loop back to first
//     const nextLead = leads[nextIndex];

//     if (nextLead) onSelectLead(nextLead.phone);
//   };

//   /* ================= PREVIOUS & NEXT LEAD ================= */

// const goToPreviousLead = () => {
//   if (!leads || leads.length === 0) return;

//   const currentIndex = leads.findIndex((l) => normalize(l.phone) === normalize(phone));
//   const prevIndex = (currentIndex - 1 + leads.length) % leads.length; // loop back
//   const prevLead = leads[prevIndex];

//   if (prevLead) onSelectLead(prevLead.phone);
// };


//   /* ================= UI ================= */

//   return (
//     <View style={styles.container}>
//       {/* LEAD CARD */}
//       <View style={styles.leadCard}>
//         <View style={styles.avatar}>
//           <Text style={styles.avatarText}>{leadName.charAt(0)}</Text>
//         </View>

//         <View style={styles.leadInfo}>
//           <Text style={styles.leadName}>{leadName}</Text>
//           <Text style={styles.leadPhone}>{phone}</Text>

//           <View style={styles.statusBadge}>
//             <Text style={styles.statusBadgeText}>{status.toUpperCase()}</Text>
//           </View>
//         </View>

//         <TouchableOpacity style={styles.callButton} onPress={makeCall}>
//           <Ionicons name="call" size={26} color="#fff" />
//         </TouchableOpacity>
//       </View>

//       {/* ACTION BUTTONS */}
//       <View style={styles.actionsRow}>
//         <ActionButton
//           label="Wrong Number"
//           icon="close-circle"
//           color="#e74c3c"
//           onPress={() => updateLeadStatus("Wrong Number")}
//         />
//         <ActionButton
//           label="Not Interested"
//           icon="thumbs-down"
//           color="#f33412"
//           onPress={() => updateLeadStatus("Not Interested")}
//         />
//         <ActionButton
//           label="Interested"
//           icon="thumbs-up"
//           color="#2ecc71"
//           onPress={() => updateLeadStatus("Interested")}
//         />
//         <ActionButton
//           label="Follow Up"
//           icon="logo-whatsapp"
//           color="#25D366"
//           onPress={openWhatsAppFollowUp}
//         />
//       </View>

//       {/* NOTE */}
//       <TextInput
//         placeholder="Add note..."
//         value={note}
//         onChangeText={setNote}
//         multiline
//         style={styles.noteBox}
//       />

//      {/* PREVIOUS & NEXT LEAD BUTTONS */}
// {/* PREVIOUS & NEXT LEAD BUTTONS */}
// <View style={styles.prevNextRow}>
//   <TouchableOpacity style={styles.prevNextButton} onPress={goToPreviousLead}>
//     <Ionicons name="chevron-back" size={24} color="#fff" />
//     <Text style={styles.prevNextText}>Previous Lead</Text>
//   </TouchableOpacity>

//   <TouchableOpacity style={styles.prevNextButton} onPress={goToNextLead}>
//     <Text style={styles.prevNextText}>Next Lead</Text>
//     <Ionicons name="chevron-forward" size={24} color="#fff" />
//   </TouchableOpacity>
// </View>


//     </View>
//   );
// }

// /* ================= ACTION BUTTON ================= */

// function ActionButton({
//   label,
//   icon,
//   color,
//   onPress,
// }: {
//   label: string;
//   icon: string;
//   color: string;
//   onPress: () => void;
// }) {
//   return (
//     <TouchableOpacity style={styles.actionItem} onPress={onPress}>
//       <Ionicons name={icon} size={40} color={color} />
//       <Text style={styles.actionText}>{label}</Text>
//     </TouchableOpacity>
//   );
// }

// /* ================= STYLES ================= */

// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: "#eef5f4", padding: 16 },

//   leadCard: {
//     flexDirection: "row",
//     backgroundColor: "#fff",
//     borderRadius: 14,
//     padding: 16,
//     alignItems: "center",
//     elevation: 4,
//   },

//   avatar: {
//     width: 50,
//     height: 50,
//     borderRadius: 25,
//     backgroundColor: "#16a085",
//     alignItems: "center",
//     justifyContent: "center",
//   },
//   avatarText: { color: "#fff", fontSize: 20, fontWeight: "700" },

//   leadInfo: { flex: 1, marginLeft: 12 },
//   leadName: { fontSize: 18, fontWeight: "700", color: "#2c3e50" },
//   leadPhone: { fontSize: 14, color: "#555", marginTop: 2 },

//   statusBadge: {
//     marginTop: 6,
//     backgroundColor: "#ecf0f1",
//     paddingHorizontal: 8,
//     borderRadius: 6,
//     alignSelf: "flex-start",
//   },
//   statusBadgeText: { fontSize: 11, fontWeight: "600", color: "#555" },

//   callButton: {
//     backgroundColor: "#2ecc71",
//     width: 56,
//     height: 56,
//     borderRadius: 28,
//     alignItems: "center",
//     justifyContent: "center",
//   },

//   actionsRow: {
//     flexDirection: "row",
//     justifyContent: "space-between",
//     marginTop: 20,
//   },
//   actionItem: { alignItems: "center", width: "23%" },
//   actionText: { fontSize: 11, marginTop: 6, textAlign: "center" },

//   noteBox: {
//     backgroundColor: "#fff",
//     marginTop: 20,
//     borderRadius: 12,
//     padding: 12,
//     height: 200,
//     textAlignVertical: "top",
//   },

//   nextLeadButton: {
//     backgroundColor: "#1abc9c",
//     paddingVertical: 14,
//     borderRadius: 10,
//     marginTop: 20,
//     alignItems: "center",
//     justifyContent: "center",
//   },
//   nextLeadButtonText: {
//     color: "#fff",
//     fontWeight: "700",
//     fontSize: 16,
//   },

//   prevNextRow: {
//   flexDirection: "row",
//   justifyContent: "space-between",
//   marginTop: 20,
// },

// prevNextButton: {
//   flex: 0.48,
//   backgroundColor: "#1abc9c",
//   paddingVertical: 12,
//   borderRadius: 10,
//   flexDirection: "row",
//   alignItems: "center",
//   justifyContent: "center",
//   gap: 6, // spacing between icon and text
// },

// prevNextText: {
//   color: "#fff",
//   fontWeight: "700",
//   fontSize: 14,
// },


// });






// import React, { useState } from "react";
// import { View, Text, TouchableOpacity, StyleSheet, Linking } from "react-native";
// import AsyncStorage from "@react-native-async-storage/async-storage";

// type Props = { phone?: string };

// export default function DialerScreen({ phone = "" }: Props) {
//   const [dialNumber, setDialNumber] = useState(phone);
//   const MAX_NUMBER_LENGTH = 18;

//   const handleKeyPress = (key: string) => setDialNumber(prev => (prev.length >= MAX_NUMBER_LENGTH ? prev : prev + key));
//   const handleBackspace = () => setDialNumber(prev => prev.slice(0, -1));

//   const makeCall = async () => {
//     if (!dialNumber) return;
//     const url = `tel:${dialNumber}`;
//     Linking.canOpenURL(url).then(supported => supported && Linking.openURL(url));

//     // Save immediately with duration 0
//     try {
//       const saved = await AsyncStorage.getItem("logs");
//       const logs = saved ? JSON.parse(saved) : [];
//       logs.unshift({
//         id: Date.now().toString(),
//         number: dialNumber,
//         duration: 0,
//         time: new Date().toLocaleString(),
//       });
//       await AsyncStorage.setItem("logs", JSON.stringify(logs));
//     } catch (e) {
//       console.warn("Failed to save call log:", e);
//     }

//     setDialNumber("");
//   };

//   const keypad = [
//     ["1", "2", "3"],
//     ["4", "5", "6"],
//     ["7", "8", "9"],
//     ["*", "0", "#"],
//   ];

//   return (
//     <View style={styles.container}>
//       <Text style={styles.dialerNumber}>{dialNumber || "Enter number"}</Text>
//       {keypad.map((row, idx) => (
//         <View key={idx} style={styles.keyRow}>
//           {row.map(key => (
//             <TouchableOpacity key={key} style={styles.key} onPress={() => handleKeyPress(key)}>
//               <Text style={styles.keyText}>{key}</Text>
//             </TouchableOpacity>
//           ))}
//         </View>
//       ))}
//       <View style={styles.keyRow}>
//         <TouchableOpacity style={styles.key} onPress={handleBackspace}>
//           <Text style={styles.keyText}>⌫</Text>
//         </TouchableOpacity>
//         <TouchableOpacity style={[styles.key, styles.callKey]} onPress={makeCall}>
//           <Text style={styles.keyText}>📞</Text>
//         </TouchableOpacity>
//       </View>
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 16 },
//   dialerNumber: { fontSize: 32, fontWeight: "700", marginBottom: 20, color: "#2f3640" },
//   keyRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: 15 },
//   key: { flex: 1, marginHorizontal: 5, paddingVertical: 20, borderRadius: 12, backgroundColor: "#fff", justifyContent: "center", alignItems: "center" },
//   callKey: { backgroundColor: "#44bd32" },
//   keyText: { fontSize: 20, fontWeight: "700", color: "#2f3640" },
// });
