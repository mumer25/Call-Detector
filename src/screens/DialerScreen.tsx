import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Linking,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "react-native-vector-icons/Ionicons";

/* ================= TYPES ================= */

type LeadStatus = "New" | "Wrong Number" | "Not Interested" | "Interested";

export type Lead = {
  name?: string;
  phone: string;
  status?: LeadStatus;
};

type Props = {
  phone: string;
  leads: Lead[]; // Full leads list
  onSelectLead: (phone: string) => void; // Function to switch to next lead
};

/* ================= SCREEN ================= */

export default function DialerScreen({ phone, leads, onSelectLead }: Props) {
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<LeadStatus>("New");
  const [leadName, setLeadName] = useState<string>("");

  /* ================= LOAD LEAD ================= */

  const normalize = (num: string) => num.replace(/\D/g, "");

  const loadLead = useCallback(async () => {
    try {
      const savedLeads = await AsyncStorage.getItem("leads");
      if (!savedLeads) {
        setLeadName(phone);
        return;
      }

      const parsedLeads: Lead[] = JSON.parse(savedLeads);
      const found = parsedLeads.find(
        (l) => normalize(l.phone) === normalize(phone)
      );

      if (found) {
        setLeadName(found.name || phone);
        setStatus(found.status || "New");
      } else {
        setLeadName(phone);
      }
    } catch {
      setLeadName(phone);
    }
  }, [phone]);

  useEffect(() => {
    loadLead();
  }, [loadLead]);

  /* ================= HELPERS ================= */

  const getWhatsAppNumber = () => {
    const digits = normalize(phone);
    if (digits.length > 10) return digits;
    return `91${digits}`; // Default country code
  };

  const updateLeadStatus = async (newStatus: LeadStatus) => {
    setStatus(newStatus);

    try {
      const savedLeads = await AsyncStorage.getItem("leads");
      if (!savedLeads) return;

      const parsedLeads: Lead[] = JSON.parse(savedLeads);
      const updatedLeads = parsedLeads.map((l) =>
        normalize(l.phone) === normalize(phone) ? { ...l, status: newStatus } : l
      );

      await AsyncStorage.setItem("leads", JSON.stringify(updatedLeads));
    } catch {}
  };

  const makeCall = async () => {
    const url = `tel:${phone}`;
    if (await Linking.canOpenURL(url)) Linking.openURL(url);

    try {
      const savedLogs = await AsyncStorage.getItem("logs");
      const logs = savedLogs ? JSON.parse(savedLogs) : [];

      logs.unshift({
        id: Date.now().toString(),
        name: leadName,
        number: phone,
        status,
        note,
        time: new Date().toLocaleString(),
      });

      await AsyncStorage.setItem("logs", JSON.stringify(logs));
    } catch {}
  };

  const openWhatsAppFollowUp = async () => {
    const message = note
      ? `Hi ${leadName}, ${note}`
      : `Hi ${leadName}, just following up regarding our conversation.`;

    const whatsappUrl = `whatsapp://send?phone=${getWhatsAppNumber()}&text=${encodeURIComponent(
      message
    )}`;

    try {
      await Linking.openURL(whatsappUrl);
    } catch {
      Alert.alert(
        "WhatsApp not available",
        "Please install WhatsApp or check the phone number format."
      );
    }
  };

  /* ================= NEXT LEAD ================= */

  const goToNextLead = () => {
    if (!leads || leads.length === 0) return;

    const currentIndex = leads.findIndex((l) => normalize(l.phone) === normalize(phone));
    const nextIndex = (currentIndex + 1) % leads.length; // loop back to first
    const nextLead = leads[nextIndex];

    if (nextLead) onSelectLead(nextLead.phone);
  };

  /* ================= PREVIOUS & NEXT LEAD ================= */

const goToPreviousLead = () => {
  if (!leads || leads.length === 0) return;

  const currentIndex = leads.findIndex((l) => normalize(l.phone) === normalize(phone));
  const prevIndex = (currentIndex - 1 + leads.length) % leads.length; // loop back
  const prevLead = leads[prevIndex];

  if (prevLead) onSelectLead(prevLead.phone);
};


  /* ================= UI ================= */

  return (
    <View style={styles.container}>
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
          onPress={() => updateLeadStatus("Wrong Number")}
        />
        <ActionButton
          label="Not Interested"
          icon="thumbs-down"
          color="#f33412"
          onPress={() => updateLeadStatus("Not Interested")}
        />
        <ActionButton
          label="Interested"
          icon="thumbs-up"
          color="#2ecc71"
          onPress={() => updateLeadStatus("Interested")}
        />
        <ActionButton
          label="Follow Up"
          icon="logo-whatsapp"
          color="#25D366"
          onPress={openWhatsAppFollowUp}
        />
      </View>

      {/* NOTE */}
      <TextInput
        placeholder="Add note..."
        value={note}
        onChangeText={setNote}
        multiline
        style={styles.noteBox}
      />

     {/* PREVIOUS & NEXT LEAD BUTTONS */}
{/* PREVIOUS & NEXT LEAD BUTTONS */}
<View style={styles.prevNextRow}>
  <TouchableOpacity style={styles.prevNextButton} onPress={goToPreviousLead}>
    <Ionicons name="chevron-back" size={24} color="#fff" />
    <Text style={styles.prevNextText}>Previous Lead</Text>
  </TouchableOpacity>

  <TouchableOpacity style={styles.prevNextButton} onPress={goToNextLead}>
    <Text style={styles.prevNextText}>Next Lead</Text>
    <Ionicons name="chevron-forward" size={24} color="#fff" />
  </TouchableOpacity>
</View>


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
  container: { flex: 1, backgroundColor: "#eef5f4", padding: 16 },

  leadCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
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
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  statusBadgeText: { fontSize: 11, fontWeight: "600", color: "#555" },

  callButton: {
    backgroundColor: "#2ecc71",
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },

  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  actionItem: { alignItems: "center", width: "23%" },
  actionText: { fontSize: 11, marginTop: 6, textAlign: "center" },

  noteBox: {
    backgroundColor: "#fff",
    marginTop: 20,
    borderRadius: 12,
    padding: 12,
    height: 200,
    textAlignVertical: "top",
  },

  nextLeadButton: {
    backgroundColor: "#1abc9c",
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  nextLeadButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },

  prevNextRow: {
  flexDirection: "row",
  justifyContent: "space-between",
  marginTop: 20,
},

prevNextButton: {
  flex: 0.48,
  backgroundColor: "#1abc9c",
  paddingVertical: 12,
  borderRadius: 10,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 6, // spacing between icon and text
},

prevNextText: {
  color: "#fff",
  fontWeight: "700",
  fontSize: 14,
},


});






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
