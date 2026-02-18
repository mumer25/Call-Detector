import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  FlatList,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAllLeadsWithHistoryAndStatus } from '../db/database';

type TimelineLog = {
  id: string | number;
  number: string;
  type: string;
  duration: number;
  time: string;
  note?: string;
  status?: string;
};

type LeadTimeline = {
  lead: any;
  history: TimelineLog[];
};

type TimelineScreenProps = {
  selectedLeadPhone?: string;
  resetTimeline?: boolean;
};

export default function TimelineScreen({ selectedLeadPhone, resetTimeline }: TimelineScreenProps) {
  const [leadsData, setLeadsData] = useState<LeadTimeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Prefill search if opened from lead or resetTimeline
  useEffect(() => {
    if (selectedLeadPhone) setSearchQuery(selectedLeadPhone);
    else if (resetTimeline) setSearchQuery('');
  }, [selectedLeadPhone, resetTimeline]);

  // Load all leads + history
 const loadTimeline = useCallback(async () => {
  setLoading(true);
  try {
    const data = await getAllLeadsWithHistoryAndStatus();

    // Sort each lead's history by time descending
    const sortedData = data.map(leadItem => ({
      ...leadItem,
      history: leadItem.history.sort(
        (a: TimelineLog, b: TimelineLog) => new Date(b.time).getTime() - new Date(a.time).getTime()
      ),
    }));

    // Sort leads themselves by the latest history time
    sortedData.sort((a, b) => {
      const aTime = a.history.length ? new Date(a.history[0].time).getTime() : 0;
      const bTime = b.history.length ? new Date(b.history[0].time).getTime() : 0;
      return bTime - aTime;
    });

    setLeadsData(sortedData);
  } catch (e) {
    console.error('Failed to load timeline:', e);
  } finally {
    setLoading(false);
  }
}, []);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

// Filtered leads based on debounced search
const filteredLeads = leadsData
  .filter(lead =>
    debouncedSearch.length === 0
      ? true
      : lead.lead.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        lead.lead.phone.includes(debouncedSearch)
  )
  // Sort filtered leads so the most recent log is on top
  .sort((a, b) => {
    const aTime = a.history.length ? new Date(a.history[0].time).getTime() : 0;
    const bTime = b.history.length ? new Date(b.history[0].time).getTime() : 0;
    return bTime - aTime;
  });


  const normalize = (type: any) => String(type || '').trim().toLowerCase();

  const getIcon = (type: any) => {
    const t = normalize(type);
    switch (t) {
      case '1':
      case 'incoming':
        return <Ionicons name="call" size={24} color="#2ecc71" />;
      case '2':
      case 'outgoing':
      case 'call':
      case 'dialed':
        return <Ionicons name="call-outline" size={24} color="#7f8c8d" />;
      case '3':
      case 'missed':
        return <Ionicons name="call-outline" size={24} color="#e74c3c" />;
      case 'whatsapp':
        return <Ionicons name="logo-whatsapp" size={24} color="#25D366" />;
      case 'followup':
      case 'follow-up':
        return <Ionicons name="calendar" size={24} color="#3498db" />;
      case 'interested':
        return <Ionicons name="checkmark-circle" size={24} color="#2ecc71" />;
      case 'not interested':
      case 'not_interested':
        return <Ionicons name="close-circle" size={24} color="#e74c3c" />;
      default:
        return <Ionicons name="calendar-outline" size={24} color="#bdc3c7" />;
    }
  };

  const getBadgeColor = (type: any) => {
    const t = normalize(type);
    switch (t) {
      case '1':
      case 'incoming':
      case 'interested':
      case 'whatsapp':
        return '#2ecc71';
      case '3':
      case 'missed':
      case 'not interested':
      case 'not_interested':
        return '#e74c3c';
      case 'followup':
      case 'follow-up':
        return '#3498db';
      default:
        return '#7f8c8d';
    }
  };

  const getBadgeText = (type: any) => {
    const t = normalize(type);
    if (!t) return 'Unknown';
    const mapping: Record<string, string> = {
      '1': 'Incoming',
      incoming: 'Incoming',
      '2': 'Call',
      outgoing: 'Call',
      call: 'Call',
      dialed: 'Call',
      '3': 'Missed',
      missed: 'Missed',
      whatsapp: 'WhatsApp',
      followup: 'Follow-up',
      'follow-up': 'Follow-up',
      interested: 'Interested',
      'not interested': 'Not Interested',
      not_interested: 'Not Interested',
    };
    return mapping[t] || t.charAt(0).toUpperCase() + t.slice(1);
  };

  const formatDuration = (seconds: number) => `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const formatTime = (time: string) => new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formatDate = (time: string) => new Date(time).toLocaleDateString();

  // Render each lead
  const renderLead = ({ item }: { item: LeadTimeline }) => {
    const { lead, history } = item;
    return (
      <View style={styles.leadSection}>
        <View style={styles.leadHeader}>
          <View style={styles.profileCircle}>
            <Ionicons name="person" size={22} color="#1abc9c" />
          </View>
          <View style={styles.leadTextContainer}>
            <Text style={styles.leadName}>{lead.name}</Text>
            <Text style={styles.leadPhone}>{lead.phone}</Text>
          </View>
        </View>

        {history.map((log, index) => (
          <View key={log.id} style={styles.timelineRow}>
            <View style={styles.leftColumn}>
              <View style={styles.iconCircle}>{getIcon(log.type)}</View>
              {index !== history.length - 1 && <View style={styles.verticalLine} />}
            </View>

            <View style={styles.card}>
              <View style={[styles.statusBadge, { backgroundColor: getBadgeColor(log.type) }]}>
                <Text style={styles.statusBadgeText}>{getBadgeText(log.type)}</Text>
              </View>
              <Text style={styles.timeText}>
                {formatTime(log.time)} | {formatDate(log.time)}
              </Text>
              {log.duration > 0 && <Text style={styles.noteText}>Duration: {formatDuration(log.duration)}</Text>}
            </View>
          </View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* SEARCH HEADER */}
      <View style={styles.searchHeader}>
        <View style={styles.searchContainer}>
          <TextInput
            placeholder="Search lead by name or phone..."
            placeholderTextColor="#888"
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 ? (
            <Ionicons name="close-circle" size={20} color="#888" style={styles.searchIcon} onPress={() => setSearchQuery('')} />
          ) : (
            <Ionicons name="search" size={22} color="#1abc9c" style={styles.searchIcon} />
          )}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#3b5353" style={styles.loader} />
      ) : filteredLeads.length === 0 ? (
        <Text style={styles.emptyText}>No interaction history found.</Text>
      ) : (
        <FlatList
          data={filteredLeads}
          keyExtractor={(item) => item.lead.phone}
          renderItem={renderLead}
          contentContainerStyle={styles.scrollContent}
        />
      )}
    </SafeAreaView>
  );
}

/* ================== STYLES ================== */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#d1e7e7' },
  searchHeader: { paddingVertical: 12, paddingHorizontal: 15 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: '#ccc' },
  searchInput: { flex: 1, height: 40, color: '#000' },
  searchIcon: { marginLeft: 8 },
  scrollContent: { paddingHorizontal: 20 },
  loader: { marginTop: 50 },
  timelineContainer: { padding: 20, paddingTop: 20 },
  timelineRow: { flexDirection: 'row', marginBottom: 30, minHeight: 80 },
  leftColumn: { width: 60, alignItems: 'center' },
  verticalLine: { position: 'absolute', top: 50, bottom: -30, width: 3, backgroundColor: '#3b5353', zIndex: 1 },
  iconCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', elevation: 4, zIndex: 2 },
  card: { flex: 1, backgroundColor: '#fff', marginLeft: 10, borderRadius: 15, paddingHorizontal: 18, paddingVertical: 15, elevation: 3 },
  statusBadge: { marginTop: 6, paddingHorizontal: 8, borderRadius: 6, alignSelf: 'flex-start' },
  statusBadgeText: { fontSize: 11, fontWeight: '600', color: '#fff' },
  timeText: { fontSize: 12, color: '#7f8c8d', marginTop: 4 },
  noteText: { marginTop: 6, color: '#555', fontSize: 14 },
  emptyText: { textAlign: 'center', marginTop: 50, color: '#3b5353', fontSize: 16 },
  leadSection: { marginBottom: 40 },
  leadHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', padding: 12, borderRadius: 14, marginBottom: 20, elevation: 2 },
  profileCircle: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#e8f8f5', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  leadTextContainer: { flex: 1 },
  leadName: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  leadPhone: { fontSize: 13, color: '#64748b', marginTop: 2 },
});




// import React, { useEffect, useState, useCallback } from 'react';
// import {
//   View,
//   Text,
//   StyleSheet,
//   ScrollView,
//   ActivityIndicator,
//   TextInput,
// } from 'react-native';
// import Ionicons from 'react-native-vector-icons/Ionicons';
// import { SafeAreaView } from 'react-native-safe-area-context';

// import { getAllLeadsWithHistoryAndStatus } from '../db/database';

// type TimelineLog = {
//   id: string | number;
//   number: string;
//   type: string;
//   duration: number;
//   time: string;
// };

// type LeadTimeline = {
//   leadName: string;
//   phone: string;
//   logs: TimelineLog[];
// };

// type TimelineScreenProps = {
//   selectedLeadPhone?: string; // optional
//   resetTimeline?: boolean; // optional
// };

// export default function TimelineScreen({
//   selectedLeadPhone,
//   resetTimeline,
// }: TimelineScreenProps) {
//   const [leadsData, setLeadsData] = useState<LeadTimeline[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [searchQuery, setSearchQuery] = useState('');

//   useEffect(() => {
//     if (selectedLeadPhone) {
//       setSearchQuery(selectedLeadPhone); // opened from lead
//     } else if (resetTimeline) {
//       setSearchQuery(''); // opened from bottom tab → clear filter
//     }
//   }, [selectedLeadPhone, resetTimeline]);

//   /* ================= LOAD TIMELINE ================= */
//   const loadTimeline = useCallback(async () => {
//   setLoading(true);
//   try {
//     const data = await getAllLeadsWithHistoryAndStatus();

//     const formatted = data
//       .map((item: any) => {
//         const mappedLogs: TimelineLog[] = (item.history || []).map((log: any) => ({
//           id: log.id,
//           number: log.number,
//           type: log.type,
//           duration: log.duration || 0,
//           time: log.time,
//         }));

//         // Only filter call logs; leave all other status logs
//         const realCallTypes = ['incoming', 'outgoing', 'missed'];
//         const filteredLogs = mappedLogs.filter((log) => {
//           const t = String(log.type || '').toLowerCase().trim();
//           // Include call logs only if they are real calls, or include status logs as-is
//           if (realCallTypes.includes(t)) return true;
//           // Include other logs (interested, not interested, follow-up, whatsapp, etc.)
//           return true;
//         });

//         // Sort by time descending
//         const sortedLogs = filteredLogs.sort(
//           (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
//         );

//         return {
//           leadName: item.lead.name || item.lead.phone,
//           phone: item.lead.phone,
//           logs: sortedLogs,
//         };
//       })
//       .filter((lead: LeadTimeline) => lead.logs.length > 0)
//       .sort((a: LeadTimeline, b: LeadTimeline) => {
//         const aLatest = new Date(a.logs[0].time).getTime();
//         const bLatest = new Date(b.logs[0].time).getTime();
//         return bLatest - aLatest;
//       });

//     setLeadsData(formatted);
//   } catch (e) {
//     console.error('Failed to load timeline:', e);
//   } finally {
//     setLoading(false);
//   }
// }, []);


//   useEffect(() => {
//     loadTimeline();
//   }, [loadTimeline]);

//   /* ================= FILTER ================= */

//   // const filteredLeads = leadsData.filter(
//   //   (lead) =>
//   //     !selectedLeadPhone || // ✅ if no lead selected, show all
//   //     lead.leadName.toLowerCase().includes(searchQuery.toLowerCase()) ||
//   //     lead.phone.includes(searchQuery)
//   // );
//   const filteredLeads = leadsData.filter(lead =>
//     searchQuery.length === 0
//       ? true // no filter if searchQuery empty
//       : lead.leadName.toLowerCase().includes(searchQuery.toLowerCase()) ||
//         lead.phone.includes(searchQuery),
//   );

//   /* ================= HELPERS ================= */

//   const normalize = (type: any) =>
//     String(type || '')
//       .trim()
//       .toLowerCase();

//   const getIcon = (type: any) => {
//     const t = normalize(type);

//     switch (t) {
//       case '1':
//       case 'incoming':
//         return <Ionicons name="call" size={24} color="#2ecc71" />;
//       case '2':
//       case 'outgoing':
//       case 'call':
//       case 'dialed':
//         return <Ionicons name="call-outline" size={24} color="#7f8c8d" />;
//       case '3':
//       case 'missed':
//         return <Ionicons name="call-outline" size={24} color="#e74c3c" />;
//       case 'whatsapp':
//         return <Ionicons name="logo-whatsapp" size={24} color="#25D366" />;
//       case 'followup':
//       case 'follow-up':
//         return <Ionicons name="calendar" size={24} color="#3498db" />;
//       case 'interested':
//         return <Ionicons name="checkmark-circle" size={24} color="#2ecc71" />;
//       case 'not interested':
//       case 'not_interested':
//         return <Ionicons name="close-circle" size={24} color="#e74c3c" />;
//       default:
//         return <Ionicons name="calendar-outline" size={24} color="#bdc3c7" />;
//     }
//   };

//   const getBadgeColor = (type: any) => {
//     const t = normalize(type);

//     switch (t) {
//       case '1':
//       case 'incoming':
//       case 'interested':
//       case 'whatsapp':
//         return '#2ecc71';
//       case '3':
//       case 'missed':
//       case 'not interested':
//       case 'not_interested':
//         return '#e74c3c';
//       case 'followup':
//       case 'follow-up':
//         return '#3498db';
//       default:
//         return '#7f8c8d';
//     }
//   };

//   const getBadgeText = (type: any) => {
//     const t = normalize(type);
//     if (!t) return 'Unknown';

//     const mapping: Record<string, string> = {
//       '1': 'Incoming',
//       incoming: 'Incoming',
//       '2': 'Call',
//       outgoing: 'Call',
//       call: 'Call',
//       dialed: 'Call',
//       '3': 'Missed',
//       missed: 'Missed',
//       whatsapp: 'WhatsApp',
//       followup: 'Follow-up',
//       'follow-up': 'Follow-up',
//       interested: 'Interested',
//       'not interested': 'Not Interested',
//       not_interested: 'Not Interested',
//     };

//     return mapping[t] || t.charAt(0).toUpperCase() + t.slice(1);
//   };

//   const formatDuration = (seconds: number) => {
//     const mins = Math.floor(seconds / 60);
//     const secs = seconds % 60;
//     return `${mins}m ${secs}s`;
//   };

//   const formatTime = (time: string) => {
//     const d = new Date(time);
//     return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
//   };

//   const formatDate = (time: string) => {
//     const d = new Date(time);
//     return d.toLocaleDateString();
//   };

//   /* ================= RENDER ================= */

//   return (
//     <SafeAreaView style={styles.container}>
//       {/* SEARCH HEADER */}
//       <View style={styles.searchHeader}>
//         <View style={styles.searchContainer}>
//           <TextInput
//             placeholder="Search lead by name or phone..."
//             placeholderTextColor="#888"
//             style={styles.searchInput}
//             value={searchQuery}
//             onChangeText={setSearchQuery}
//           />

//           {/* Search or Clear icon */}
//           {searchQuery.length > 0 ? (
//             <Ionicons
//               name="close-circle"
//               size={20}
//               color="#888"
//               style={styles.searchIcon}
//               onPress={() => setSearchQuery('')} // clears the input
//             />
//           ) : (
//             <Ionicons
//               name="search"
//               size={22}
//               color="#1abc9c"
//               style={styles.searchIcon}
//             />
//           )}
//         </View>
//       </View>

//       {loading ? (
//         <ActivityIndicator size="large" color="#3b5353" style={styles.loader} />
//       ) : (
//         <ScrollView contentContainerStyle={styles.scrollContent}>
//           <View style={styles.timelineContainer}>
//             {filteredLeads.length === 0 ? (
//               <Text style={styles.emptyText}>
//                 No interaction history found.
//               </Text>
//             ) : (
//               filteredLeads.map((lead, leadIndex) => (
//                 <View key={leadIndex} style={styles.leadSection}>
//                   <View style={styles.leadHeader}>
//                     <View style={styles.profileCircle}>
//                       <Ionicons name="person" size={22} color="#1abc9c" />
//                     </View>

//                     <View style={styles.leadTextContainer}>
//                       <Text style={styles.leadName}>{lead.leadName}</Text>
//                       <Text style={styles.leadPhone}>{lead.phone}</Text>
//                     </View>
//                   </View>

//                   {lead.logs.map((log, index) => (
//                     <View key={log.id} style={styles.timelineRow}>
//                       <View style={styles.leftColumn}>
//                         <View style={styles.iconCircle}>
//                           {getIcon(log.type)}
//                         </View>
//                         {index !== lead.logs.length - 1 && (
//                           <View style={styles.verticalLine} />
//                         )}
//                       </View>

//                       <View style={styles.card}>
//                         <View
//                           style={[
//                             styles.statusBadge,
//                             { backgroundColor: getBadgeColor(log.type) },
//                           ]}
//                         >
//                           <Text style={styles.statusBadgeText}>
//                             {getBadgeText(log.type)}
//                           </Text>
//                         </View>

//                         <Text style={styles.timeText}>
//                           {formatTime(log.time)} | {formatDate(log.time)}
//                         </Text>

//                         {log.duration > 0 && (
//                           <Text style={styles.noteText}>
//                             Duration: {formatDuration(log.duration)}
//                           </Text>
//                         )}
//                       </View>
//                     </View>
//                   ))}
//                 </View>
//               ))
//             )}
//           </View>
//         </ScrollView>
//       )}
//     </SafeAreaView>
//   );
// }

// /* ================= STYLES ================= */

// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: '#d1e7e7' },

//   searchHeader: {
//     paddingVertical: 12,
//     paddingHorizontal: 15,
//   },

//   searchContainer: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     backgroundColor: '#fff',
//     paddingHorizontal: 10,
//     borderRadius: 12,
//     borderWidth: 1,
//     borderColor: '#ccc',
//   },
//   searchInput: {
//     flex: 1,
//     height: 40,
//     color: '#000',
//   },

//   searchIcon: {
//     marginLeft: 8,
//   },

//   scrollContent: { paddingBottom: 30 },
//   loader: { marginTop: 50 },

//   timelineContainer: { padding: 20, paddingTop: 20 },
//   timelineRow: { flexDirection: 'row', marginBottom: 30, minHeight: 80 },
//   leftColumn: { width: 60, alignItems: 'center' },
//   verticalLine: {
//     position: 'absolute',
//     top: 50,
//     bottom: -30,
//     width: 3,
//     backgroundColor: '#3b5353',
//     zIndex: 1,
//   },
//   iconCircle: {
//     width: 50,
//     height: 50,
//     borderRadius: 25,
//     backgroundColor: '#fff',
//     justifyContent: 'center',
//     alignItems: 'center',
//     elevation: 4,
//     zIndex: 2,
//   },
//   card: {
//     flex: 1,
//     backgroundColor: '#fff',
//     marginLeft: 10,
//     borderRadius: 15,
//     paddingHorizontal: 18,
//     paddingVertical: 15,
//     elevation: 3,
//   },
//   statusBadge: {
//     marginTop: 6,
//     paddingHorizontal: 8,
//     borderRadius: 6,
//     alignSelf: 'flex-start',
//   },
//   statusBadgeText: { fontSize: 11, fontWeight: '600', color: '#fff' },
//   timeText: { fontSize: 12, color: '#7f8c8d', marginTop: 4 },
//   noteText: { marginTop: 6, color: '#555', fontSize: 14 },
//   emptyText: {
//     textAlign: 'center',
//     marginTop: 50,
//     color: '#3b5353',
//     fontSize: 16,
//   },

//   leadSection: { marginBottom: 40 },

//   leadTitle: {
//     fontSize: 20,
//     fontWeight: '700',
//     marginBottom: 18,
//     color: '#1e293b', // modern dark slate color
//     textAlign: 'center',
//     letterSpacing: 0.5,
//     paddingBottom: 6,
//     borderBottomWidth: 2,
//     borderBottomColor: '#1abc9c', // theme accent line
//     alignSelf: 'center',
//     minWidth: '60%',
//   },

//   leadHeader: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     backgroundColor: '#ffffff',
//     padding: 12,
//     borderRadius: 14,
//     marginBottom: 20,
//     elevation: 2,
//   },

//   profileCircle: {
//     width: 45,
//     height: 45,
//     borderRadius: 22.5,
//     backgroundColor: '#e8f8f5',
//     justifyContent: 'center',
//     alignItems: 'center',
//     marginRight: 12,
//   },

//   leadTextContainer: {
//     flex: 1,
//   },

//   leadName: {
//     fontSize: 16,
//     fontWeight: '700',
//     color: '#1e293b',
//   },

//   leadPhone: {
//     fontSize: 13,
//     color: '#64748b',
//     marginTop: 2,
//   },
// });



// import React, { useEffect, useState, useCallback } from 'react';
// import {
//   View,
//   Text,
//   StyleSheet,
//   ScrollView,
//   ActivityIndicator,
//   TextInput,
// } from 'react-native';
// import Ionicons from 'react-native-vector-icons/Ionicons';
// import { SafeAreaView } from 'react-native-safe-area-context';

// import { getAllLeadsWithHistoryAndStatus } from '../db/database';

// type TimelineLog = {
//   id: string | number;
//   number: string;
//   type: string;
//   duration: number;
//   time: string;
// };

// type LeadTimeline = {
//   leadName: string;
//   phone: string;
//   logs: TimelineLog[];
// };

// type TimelineScreenProps = {
//   selectedLeadPhone?: string; // optional
//   resetTimeline?: boolean; // optional
// };

// export default function TimelineScreen({
//   selectedLeadPhone,
//   resetTimeline,
// }: TimelineScreenProps) {
//   const [leadsData, setLeadsData] = useState<LeadTimeline[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [searchQuery, setSearchQuery] = useState('');

//   useEffect(() => {
//     if (selectedLeadPhone) {
//       setSearchQuery(selectedLeadPhone); // opened from lead
//     } else if (resetTimeline) {
//       setSearchQuery(''); // opened from bottom tab → clear filter
//     }
//   }, [selectedLeadPhone, resetTimeline]);

//   /* ================= LOAD TIMELINE ================= */
//   const loadTimeline = useCallback(async () => {
//     setLoading(true);
//     try {
//       const data = await getAllLeadsWithHistoryAndStatus();

//       const formatted = data
//         .map((item: any) => {
//           const mappedLogs = (item.history || []).map((log: any) => ({
//             id: log.id,
//             number: log.number,
//             type: log.type,
//             duration: log.duration || 0,
//             time: log.time,
//           }));

//           const sortedLogs = mappedLogs.sort(
//             (a: any, b: any) =>
//               new Date(b.time).getTime() - new Date(a.time).getTime(),
//           );

//           return {
//             leadName: item.lead.name || item.lead.phone,
//             phone: item.lead.phone,
//             logs: sortedLogs,
//           };
//         })
//         .filter((lead: LeadTimeline) => lead.logs.length > 0)
//         .sort((a: LeadTimeline, b: LeadTimeline) => {
//           const aLatest = new Date(a.logs[0].time).getTime();
//           const bLatest = new Date(b.logs[0].time).getTime();
//           return bLatest - aLatest;
//         });

//       setLeadsData(formatted);
//     } catch (e) {
//       console.error('Failed to load timeline:', e);
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   useEffect(() => {
//     loadTimeline();
//   }, [loadTimeline]);

//   /* ================= FILTER ================= */

//   // const filteredLeads = leadsData.filter(
//   //   (lead) =>
//   //     !selectedLeadPhone || // ✅ if no lead selected, show all
//   //     lead.leadName.toLowerCase().includes(searchQuery.toLowerCase()) ||
//   //     lead.phone.includes(searchQuery)
//   // );
//   const filteredLeads = leadsData.filter(lead =>
//     searchQuery.length === 0
//       ? true // no filter if searchQuery empty
//       : lead.leadName.toLowerCase().includes(searchQuery.toLowerCase()) ||
//         lead.phone.includes(searchQuery),
//   );

//   /* ================= HELPERS ================= */

//   const normalize = (type: any) =>
//     String(type || '')
//       .trim()
//       .toLowerCase();

//   const getIcon = (type: any) => {
//     const t = normalize(type);

//     switch (t) {
//       case '1':
//       case 'incoming':
//         return <Ionicons name="call" size={24} color="#2ecc71" />;
//       case '2':
//       case 'outgoing':
//       case 'call':
//       case 'dialed':
//         return <Ionicons name="call-outline" size={24} color="#7f8c8d" />;
//       case '3':
//       case 'missed':
//         return <Ionicons name="call-outline" size={24} color="#e74c3c" />;
//       case 'whatsapp':
//         return <Ionicons name="logo-whatsapp" size={24} color="#25D366" />;
//       case 'followup':
//       case 'follow-up':
//         return <Ionicons name="calendar" size={24} color="#3498db" />;
//       case 'interested':
//         return <Ionicons name="checkmark-circle" size={24} color="#2ecc71" />;
//       case 'not interested':
//       case 'not_interested':
//         return <Ionicons name="close-circle" size={24} color="#e74c3c" />;
//       default:
//         return <Ionicons name="calendar-outline" size={24} color="#bdc3c7" />;
//     }
//   };

//   const getBadgeColor = (type: any) => {
//     const t = normalize(type);

//     switch (t) {
//       case '1':
//       case 'incoming':
//       case 'interested':
//       case 'whatsapp':
//         return '#2ecc71';
//       case '3':
//       case 'missed':
//       case 'not interested':
//       case 'not_interested':
//         return '#e74c3c';
//       case 'followup':
//       case 'follow-up':
//         return '#3498db';
//       default:
//         return '#7f8c8d';
//     }
//   };

//   const getBadgeText = (type: any) => {
//     const t = normalize(type);
//     if (!t) return 'Unknown';

//     const mapping: Record<string, string> = {
//       '1': 'Incoming',
//       incoming: 'Incoming',
//       '2': 'Call',
//       outgoing: 'Call',
//       call: 'Call',
//       dialed: 'Call',
//       '3': 'Missed',
//       missed: 'Missed',
//       whatsapp: 'WhatsApp',
//       followup: 'Follow-up',
//       'follow-up': 'Follow-up',
//       interested: 'Interested',
//       'not interested': 'Not Interested',
//       not_interested: 'Not Interested',
//     };

//     return mapping[t] || t.charAt(0).toUpperCase() + t.slice(1);
//   };

//   const formatDuration = (seconds: number) => {
//     const mins = Math.floor(seconds / 60);
//     const secs = seconds % 60;
//     return `${mins}m ${secs}s`;
//   };

//   const formatTime = (time: string) => {
//     const d = new Date(time);
//     return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
//   };

//   const formatDate = (time: string) => {
//     const d = new Date(time);
//     return d.toLocaleDateString();
//   };

//   /* ================= RENDER ================= */

//   return (
//     <SafeAreaView style={styles.container}>
//       {/* SEARCH HEADER */}
//       <View style={styles.searchHeader}>
//         <View style={styles.searchContainer}>
//           <TextInput
//             placeholder="Search lead by name or phone..."
//             placeholderTextColor="#888"
//             style={styles.searchInput}
//             value={searchQuery}
//             onChangeText={setSearchQuery}
//           />

//           {/* Search or Clear icon */}
//           {searchQuery.length > 0 ? (
//             <Ionicons
//               name="close-circle"
//               size={20}
//               color="#888"
//               style={styles.searchIcon}
//               onPress={() => setSearchQuery('')} // clears the input
//             />
//           ) : (
//             <Ionicons
//               name="search"
//               size={22}
//               color="#1abc9c"
//               style={styles.searchIcon}
//             />
//           )}
//         </View>
//       </View>

//       {loading ? (
//         <ActivityIndicator size="large" color="#3b5353" style={styles.loader} />
//       ) : (
//         <ScrollView contentContainerStyle={styles.scrollContent}>
//           <View style={styles.timelineContainer}>
//             {filteredLeads.length === 0 ? (
//               <Text style={styles.emptyText}>
//                 No interaction history found.
//               </Text>
//             ) : (
//               filteredLeads.map((lead, leadIndex) => (
//                 <View key={leadIndex} style={styles.leadSection}>
//                   <View style={styles.leadHeader}>
//                     <View style={styles.profileCircle}>
//                       <Ionicons name="person" size={22} color="#1abc9c" />
//                     </View>

//                     <View style={styles.leadTextContainer}>
//                       <Text style={styles.leadName}>{lead.leadName}</Text>
//                       <Text style={styles.leadPhone}>{lead.phone}</Text>
//                     </View>
//                   </View>

//                   {lead.logs.map((log, index) => (
//                     <View key={log.id} style={styles.timelineRow}>
//                       <View style={styles.leftColumn}>
//                         <View style={styles.iconCircle}>
//                           {getIcon(log.type)}
//                         </View>
//                         {index !== lead.logs.length - 1 && (
//                           <View style={styles.verticalLine} />
//                         )}
//                       </View>

//                       <View style={styles.card}>
//                         <View
//                           style={[
//                             styles.statusBadge,
//                             { backgroundColor: getBadgeColor(log.type) },
//                           ]}
//                         >
//                           <Text style={styles.statusBadgeText}>
//                             {getBadgeText(log.type)}
//                           </Text>
//                         </View>

//                         <Text style={styles.timeText}>
//                           {formatTime(log.time)} | {formatDate(log.time)}
//                         </Text>

//                         {log.duration > 0 && (
//                           <Text style={styles.noteText}>
//                             Duration: {formatDuration(log.duration)}
//                           </Text>
//                         )}
//                       </View>
//                     </View>
//                   ))}
//                 </View>
//               ))
//             )}
//           </View>
//         </ScrollView>
//       )}
//     </SafeAreaView>
//   );
// }

// /* ================= STYLES ================= */

// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: '#d1e7e7' },

//   searchHeader: {
//     paddingVertical: 12,
//     paddingHorizontal: 15,
//   },

//   searchContainer: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     backgroundColor: '#fff',
//     paddingHorizontal: 10,
//     borderRadius: 8,
//     borderWidth: 1,
//     borderColor: '#ccc',
//   },
//   searchInput: {
//     flex: 1,
//     height: 40,
//     color: '#000',
//   },

//   searchIcon: {
//     marginLeft: 8,
//   },

//   scrollContent: { paddingBottom: 30 },
//   loader: { marginTop: 50 },

//   timelineContainer: { padding: 20, paddingTop: 20 },
//   timelineRow: { flexDirection: 'row', marginBottom: 30, minHeight: 80 },
//   leftColumn: { width: 60, alignItems: 'center' },
//   verticalLine: {
//     position: 'absolute',
//     top: 50,
//     bottom: -30,
//     width: 3,
//     backgroundColor: '#3b5353',
//     zIndex: 1,
//   },
//   iconCircle: {
//     width: 50,
//     height: 50,
//     borderRadius: 25,
//     backgroundColor: '#fff',
//     justifyContent: 'center',
//     alignItems: 'center',
//     elevation: 4,
//     zIndex: 2,
//   },
//   card: {
//     flex: 1,
//     backgroundColor: '#fff',
//     marginLeft: 10,
//     borderRadius: 15,
//     paddingHorizontal: 18,
//     paddingVertical: 15,
//     elevation: 3,
//   },
//   statusBadge: {
//     marginTop: 6,
//     paddingHorizontal: 8,
//     borderRadius: 6,
//     alignSelf: 'flex-start',
//   },
//   statusBadgeText: { fontSize: 11, fontWeight: '600', color: '#fff' },
//   timeText: { fontSize: 12, color: '#7f8c8d', marginTop: 4 },
//   noteText: { marginTop: 6, color: '#555', fontSize: 14 },
//   emptyText: {
//     textAlign: 'center',
//     marginTop: 50,
//     color: '#3b5353',
//     fontSize: 16,
//   },

//   leadSection: { marginBottom: 40 },

//   leadTitle: {
//     fontSize: 20,
//     fontWeight: '700',
//     marginBottom: 18,
//     color: '#1e293b', // modern dark slate color
//     textAlign: 'center',
//     letterSpacing: 0.5,
//     paddingBottom: 6,
//     borderBottomWidth: 2,
//     borderBottomColor: '#1abc9c', // theme accent line
//     alignSelf: 'center',
//     minWidth: '60%',
//   },

//   leadHeader: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     backgroundColor: '#ffffff',
//     padding: 12,
//     borderRadius: 14,
//     marginBottom: 20,
//     elevation: 2,
//   },

//   profileCircle: {
//     width: 45,
//     height: 45,
//     borderRadius: 22.5,
//     backgroundColor: '#e8f8f5',
//     justifyContent: 'center',
//     alignItems: 'center',
//     marginRight: 12,
//   },

//   leadTextContainer: {
//     flex: 1,
//   },

//   leadName: {
//     fontSize: 16,
//     fontWeight: '700',
//     color: '#1e293b',
//   },

//   leadPhone: {
//     fontSize: 13,
//     color: '#64748b',
//     marginTop: 2,
//   },
// });

// import React, { useEffect, useState, useCallback } from "react";
// import {
//   View,
//   Text,
//   StyleSheet,
//   ScrollView,
//   TouchableOpacity,
//   ActivityIndicator,
// } from "react-native";
// import Ionicons from "react-native-vector-icons/Ionicons";
// import MaterialIcons from "react-native-vector-icons/MaterialIcons";

// import { getLeadWithHistoryAndStatus } from "../db/database";
// import { SafeAreaView } from "react-native-safe-area-context";

// type TimelineLog = {
//   id: string | number;
//   number: string;
//   type:
//     | "incoming"
//     | "outgoing"
//     | "missed"
//     | "whatsapp"
//     | "followup"
//     | "Call"
//     | "Interested"
//     | "Not Interested";
//   duration: number;
//   time: string;
// };

// type Props = {
//   route: { params: { phone: string; leadName?: string } };
//   onBack: () => void;
// };

// export default function TimelineScreen({ route, onBack }: Props) {
//   const { phone } = route.params;
//   const [leadName, setLeadName] = useState<string>(phone);
//   const [logs, setLogs] = useState<TimelineLog[]>([]);
//   const [loading, setLoading] = useState(true);

//   /* ================= LOAD TIMELINE ================= */
//   const loadTimeline = useCallback(async () => {
//     setLoading(true);
//     try {
//       const data = await getLeadWithHistoryAndStatus(phone);
//       if (data) {
//         setLeadName(data.lead.name || phone);

//         const mappedLogs = data.history.map((log: any) => ({
//           id: log.id,
//           number: log.number,
//           type: log.type,
//           duration: log.duration || 0,
//           time: log.time,
//         }));

//         setLogs(
//           mappedLogs.sort(
//             (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
//           )
//         );
//       }
//     } catch (e) {
//       console.error("Failed to load timeline:", e);
//     } finally {
//       setLoading(false);
//     }
//   }, [phone]);

//   useEffect(() => {
//     loadTimeline();
//   }, [loadTimeline]);

//   /* ================= HELPERS ================= */
// /* ================= HELPERS (REVISED) ================= */

// const normalize = (type: any) => String(type || "").trim().toLowerCase();

// const getIcon = (type: any) => {
//   const t = normalize(type);

//   switch (t) {
//     case "1":
//     case "incoming":
//       return <Ionicons name="call" size={24} color="#2ecc71" />;
//     case "2":
//     case "outgoing":
//     case "call":
//     case "dialed": // Added to match your DB default
//       return <Ionicons name="call-outline" size={24} color="#7f8c8d" />;
//     case "3":
//     case "missed":
//       return <Ionicons name="call-outline" size={24} color="#e74c3c" />;
//     case "whatsapp":
//       return <Ionicons name="logo-whatsapp" size={24} color="#25D366" />;
//     case "followup":
//     case "follow-up":
//       return <Ionicons name="calendar" size={24} color="#3498db" />;
//     case "interested":
//       return <Ionicons name="checkmark-circle" size={24} color="#2ecc71" />;
//     case "not interested":
//     case "not_interested":
//       return <Ionicons name="close-circle" size={24} color="#e74c3c" />;
//     default:
//       return <Ionicons name="calendar-outline" size={24} color="#bdc3c7" />;
//   }
// };

// const getBadgeColor = (type: any) => {
//   const t = normalize(type); // CRITICAL: Added normalization here

//   switch (t) {
//     case "1":
//     case "incoming":
//     case "interested":
//     case "whatsapp":
//       return "#2ecc71";
//     case "3":
//     case "missed":
//     case "not interested":
//     case "not_interested":
//       return "#e74c3c";
//     case "followup":
//     case "follow-up":
//       return "#3498db";
//     default:
//       return "#7f8c8d";
//   }
// };

// const getBadgeText = (type: any) => {
//   const t = normalize(type);
//   if (!t) return "Unknown";

//   // Custom mapping for clean display text
//   const mapping: Record<string, string> = {
//     "1": "Incoming",
//     "incoming": "Incoming",
//     "2": "Call",
//     "outgoing": "Call",
//     "call": "Call",
//     "dialed": "Call",
//     "3": "Missed",
//     "missed": "Missed",
//     "whatsapp": "WhatsApp",
//     "followup": "Follow-up",
//     "follow-up": "Follow-up",
//     "interested": "Interested",
//     "not interested": "Not Interested",
//     "not_interested": "Not Interested"
//   };

//   return mapping[t] || (t.charAt(0).toUpperCase() + t.slice(1));
// };

//   const formatDuration = (seconds: number) => {
//     const mins = Math.floor(seconds / 60);
//     const secs = seconds % 60;
//     return `${mins}m ${secs}s`;
//   };

//   const formatTime = (time: string) => {
//     const d = new Date(time);
//     return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
//   };

//   const formatDate = (time: string) => {
//     const d = new Date(time);
//     return d.toLocaleDateString();
//   };

//   /* ================= RENDER ================= */
//   return (
//     <SafeAreaView style={styles.container}>
//       {/* HEADER */}
//       <View style={styles.header}>
//         <TouchableOpacity onPress={onBack}>
//           <MaterialIcons name="arrow-back" size={28} color="#fff" />
//         </TouchableOpacity>
//         <Text style={styles.headerTitle}>{leadName}</Text>
//       </View>

//       {loading ? (
//         <ActivityIndicator size="large" color="#3b5353" style={styles.loader} />
//       ) : (
//         <ScrollView contentContainerStyle={styles.scrollContent}>
//           {/* TIMELINE */}
//           <View style={styles.timelineContainer}>
//             {logs.length === 0 ? (
//               <Text style={styles.emptyText}>No interaction history found.</Text>
//             ) : (
//               logs.map((log, index) => (
//                 <View key={log.id} style={styles.timelineRow}>
//                   <View style={styles.leftColumn}>
//                     <View style={styles.iconCircle}>{getIcon(log.type)}</View>
//                     {index !== logs.length - 1 && <View style={styles.verticalLine} />}
//                   </View>
//                   <View style={styles.card}>
//                     <View
//                       style={[styles.statusBadge, { backgroundColor: getBadgeColor(log.type) }]}
//                     >
//                       <Text style={styles.statusBadgeText}>{getBadgeText(log.type)}</Text>
//                     </View>
//                     <Text style={styles.timeText}>
//                       {formatTime(log.time)} | {formatDate(log.time)}
//                     </Text>
//                     {log.duration > 0 && (
//                       <Text style={styles.noteText}>Duration: {formatDuration(log.duration)}</Text>
//                     )}
//                   </View>
//                 </View>
//               ))
//             )}
//           </View>
//         </ScrollView>
//       )}
//     </SafeAreaView>
//   );
// }

// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: "#d1e7e7" },
//   header: {
//     backgroundColor: "#1abc9c",
//     paddingVertical: 15,
//     paddingHorizontal: 15,
//     flexDirection: "row",
//     alignItems: "center",
//   },
//   headerTitle: { fontSize: 20, fontWeight: "bold", color: "#fff",textAlign: "center", flex: 1 },

//   scrollContent: { paddingBottom: 30 },
//   loader: { marginTop: 50 },

//   timelineContainer: { padding: 20, paddingTop: 20 },
//   timelineRow: { flexDirection: "row", marginBottom: 30, minHeight: 80 },
//   leftColumn: { width: 60, alignItems: "center" },
//   verticalLine: {
//     position: "absolute",
//     top: 50,
//     bottom: -30,
//     width: 3,
//     backgroundColor: "#3b5353",
//     zIndex: 1,
//   },
//   iconCircle: {
//     width: 50,
//     height: 50,
//     borderRadius: 25,
//     backgroundColor: "#fff",
//     justifyContent: "center",
//     alignItems: "center",
//     elevation: 4,
//     zIndex: 2,
//   },
//   card: {
//     flex: 1,
//     backgroundColor: "#fff",
//     marginLeft: 10,
//     borderRadius: 15,
//     paddingHorizontal: 18,
//     paddingVertical: 15,
//     elevation: 3,
//   },
//   statusBadge: {
//     marginTop: 6,
//     paddingHorizontal: 8,
//     borderRadius: 6,
//     alignSelf: "flex-start",
//   },
//   statusBadgeText: { fontSize: 11, fontWeight: "600", color: "#fff" },
//   timeText: { fontSize: 12, color: "#7f8c8d", marginTop: 4 },
//   noteText: { marginTop: 6, color: "#555", fontSize: 14 },
//   emptyText: { textAlign: "center", marginTop: 50, color: "#3b5353", fontSize: 16 },
// });
