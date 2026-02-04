import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from "react-native-vector-icons/MaterialIcons"; 
import FontAwesome from "react-native-vector-icons/FontAwesome";

export type Lead = {
  id: string;
  name: string;
  phone: string;
  status: "NEW" | "OLD" | "Interested" | "Not Interested" | "Follow Up";
  assignee: string;
  source: "fb" | "jd" | "web";
};

type Props = {
  onSelectLead: (phone: string) => void;
  onOpenHistory: () => void;
  onOpenReport: () => void;
};

export default function LeadsScreen({ onSelectLead}: Props) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    const saved = await AsyncStorage.getItem("leads");
    if (saved) {
      setLeads(JSON.parse(saved));
      return;
    }

    const dummy: Lead[] = [
      { id: "1", name: "Ali", phone: "03001234567", status: "NEW", assignee: "Umer", source: "fb" },
      { id: "2", name: "Umer", phone: "03229199459", status: "NEW", assignee: "Umer", source: "web" },
      { id: "3", name: "Noman", phone: "03003334444", status: "NEW", assignee: "Ali", source: "fb" },
      { id: "4", name: "Ahmad", phone: "03005556666", status: "OLD", assignee: "Ali", source: "fb" },
      { id: "5", name: "Sara", phone: "03008889999", status: "NEW", assignee: "Umer", source: "web" },
      { id: "6", name: "Hassan", phone: "03112223344", status: "OLD", assignee: "Ali", source: "jd" },
      { id: "7", name: "Adeel", phone: "03221112233", status: "NEW", assignee: "Umer", source: "fb" },
      { id: "8", name: "Bilal", phone: "03009998877", status: "OLD", assignee: "Ali", source: "web" },
    ];

    setLeads(dummy);
    await AsyncStorage.setItem("leads", JSON.stringify(dummy));
  };

  const renderSourceIcon = (source: Lead["source"]) => {
    switch (source) {
      case "fb":
        return <FontAwesome name="facebook" size={20} color="#1877F2" />;
      case "jd":
        return <MaterialIcons name="work" size={20} color="#2C3E50" />;
      case "web":
        return <MaterialIcons name="public" size={20} color="#27AE60" />;
      default:
        return <MaterialIcons name="help-outline" size={20} color="#7f8c8d" />;
    }
  };

  const renderStatusBadge = (status: Lead["status"]) => {
    let bgColor = "#ecf0f1";
    let textColor = "#7f8c8d";

    switch (status) {
      case "NEW": bgColor = "#1abc9c33"; textColor = "#1abc9c"; break;
      case "OLD": bgColor = "#e74c3c33"; textColor = "#e74c3c"; break;
      case "Not Interested": bgColor = "#e74c3c33"; textColor = "#e74c3c"; break;
      case "Interested": bgColor = "#2ecc7133"; textColor = "#2ecc71"; break;
      case "Follow Up": bgColor = "#f1c40f33"; textColor = "#f1c40f"; break;
      default: bgColor = "#bdc3c733"; textColor = "#7f8c8d";
    }

    return (
      <View style={[styles.statusBadge, { backgroundColor: bgColor }]}>
        <Text style={[styles.statusText, { color: textColor }]} numberOfLines={1} ellipsizeMode="tail">
          {status}
        </Text>
      </View>
    );
  };

  const filteredLeads = leads.filter(
    (lead) =>
      lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.phone.includes(searchQuery)
  );

  return (
    <View style={styles.container}>
      {/* SEARCH BAR */}
      <View style={styles.searchWrapper}>
        <TextInput
          placeholder="Search by name or phone..."
          placeholderTextColor="#7f8c8d"
          style={styles.searchBar}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <MaterialIcons name="search" size={22} color="#7f8c8d" style={styles.searchIcon} />
      </View>

      {/* LIST */}
      <FlatList
        data={filteredLeads}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => onSelectLead(item.phone)}
          >
            <View style={styles.left}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.separator}>|</Text>
                <Text style={styles.source}>{renderSourceIcon(item.source)}</Text>
              </View>
              <Text style={styles.phone}>{item.phone}</Text>
            </View>
            <View style={styles.center}>{renderStatusBadge(item.status)}</View>
            <View style={styles.right}>
              <View style={styles.avatar}>
                <MaterialIcons name="person" size={24} color="#fff" />
              </View>
              <Text style={styles.assignee}>{item.assignee}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#eef5f4" },

  header: {
  backgroundColor: "#fff",
  paddingHorizontal: 16,
  paddingVertical: 10,
  flexDirection: "row",
  justifyContent: "space-between", // left-right spacing
  alignItems: "center",
  borderBottomWidth: 1,
  borderColor: "#e6e6e6",
},
headerTitle: {
  fontSize: 18,
  fontWeight: "700",
  color: "#2c3e50",
},
iconBtn: {
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
  backgroundColor: "#e0f7f4",
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 8,
  width:"46%",
},
iconText: {
  fontSize: 14,
  fontWeight: "600",
  color: "#1abc9c",
},

  searchWrapper: {
    position: "relative",
    marginHorizontal: 12,
    marginVertical: 10,
  },
  searchBar: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: "#2c3e50",
    paddingRight: 40,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    position: "absolute",
    right: 18,
    top: 10,
  },

  list: { paddingHorizontal: 12, paddingBottom: 32 },

  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    alignItems: "center",
  },
  left: { flex: 3 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "nowrap" },
  separator: { fontSize: 14, color: "#7f8c8d", marginHorizontal: 4 },
  name: { fontSize: 16, fontWeight: "700", color: "#2c3e50" },
  source: { fontSize: 14 },
  phone: { fontSize: 14, color: "#7f8c8d", marginTop: 4 },

  center: { flex: 1, alignItems: "center" },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    alignSelf: "center",
    minWidth: 80,
    maxWidth: 120,
    marginRight: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    flexShrink: 1,
  },

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
});




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
