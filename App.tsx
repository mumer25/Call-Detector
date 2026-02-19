import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  BackHandler,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

import LeadsScreen from './src/screens/LeadsScreen';
import DialerScreen, { Lead } from './src/screens/DialerScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import TimelineScreen from './src/screens/TimelineScreen';
import SplashScreen from './src/screens/SplashScreen'; // ✅ direct, shows every launch
import LoginScreen from './src/screens/LoginScreen';

import {
  initDB,
  getLeads,
  getLoggedInUser,
  clearLoggedInUser,
} from './src/db/database';
import { startCallSyncListener } from './src/utils/CallRecorder';

type Tab = 'leads' | 'dialer' | 'history' | 'reports' | 'timeline';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('leads');
  const [selectedPhone, setSelectedPhone] = useState<string>('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [resetTimeline, setResetTimeline] = useState(false);
  const [username, setUsername] = useState<string>('');

  // ✅ Two independent gates: splash animation + DB init must BOTH finish
  const splashAnimDone = useRef(false);
  const dbInitDone = useRef(false);

  const tryHideSplash = useCallback(() => {
    if (splashAnimDone.current && dbInitDone.current) {
      setShowSplash(false);
    }
  }, []);

  const handleSplashFinish = useCallback(() => {
    splashAnimDone.current = true;
    tryHideSplash();
  }, [tryHideSplash]);

  // -------------------- INIT APP --------------------
  useEffect(() => {
    const initializeApp = async () => {
      try {
        await initDB();

        const user = await getLoggedInUser();
        if (user) {
          setLoggedIn(true);
          setUsername(user.user_name || 'User');
        }

        await startCallSyncListener();

        const dbLeads = await getLeads();
        setLeads(dbLeads);
      } catch (e) {
        console.warn('Initialization error:', e);
      } finally {
        dbInitDone.current = true;
        tryHideSplash(); // ✅ only hides if splash anim is also done
      }
    };

    initializeApp();
  }, [tryHideSplash]);

  // -------------------- ANDROID BACK BUTTON --------------------
  useEffect(() => {
    const backAction = () => {
      if (activeTab !== 'leads') {
        setActiveTab('leads');
        return true;
      }
      return false;
    };
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );
    return () => backHandler.remove();
  }, [activeTab]);

  // -------------------- HANDLERS --------------------
  const handleSelectLead = useCallback((phone: string) => {
    const normalizedPhone = phone.replace(/\D/g, '');
    setSelectedPhone(normalizedPhone);
    setActiveTab('dialer');
  }, []);

  const handleLogout = useCallback(() => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await clearLoggedInUser();
          setLoggedIn(false);
          setUsername('');
          setActiveTab('leads');
        },
      },
    ]);
  }, []);

  const handleLoginSuccess = useCallback(async () => {
    setLoggedIn(true);
    const user = await getLoggedInUser();
    setUsername(user?.user_name || 'User');
  }, []);

  // ✅ Single handler — no more double toggle
  const handleTimelineTabPress = useCallback(() => {
    setActiveTab('timeline');
    setSelectedPhone('');
    setResetTimeline(prev => !prev);
  }, []);

  // -------------------- RENDER --------------------
  if (showSplash) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  if (!loggedIn) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* ---------------- HEADER ---------------- */}
      <View style={styles.header}>
        {activeTab === 'leads' ? (
          <>
            <View style={styles.profileContainer}>
              <View style={styles.profileIcon}>
                <MaterialIcons name="person" size={28} color="#fff" />
              </View>
              <View style={styles.welcomeContainer}>
                <Text style={styles.welcomeText}>Welcome</Text>
                <Text style={styles.usernameText}>{username}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleLogout}>
              <MaterialIcons name="logout" size={28} color="#e74c3c" />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => setActiveTab('leads')}
            >
              <MaterialIcons name="arrow-back-ios" size={20} color="#1abc9c" />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>

            <Text style={styles.title}>
              {activeTab === 'dialer' && 'Dialer'}
              {activeTab === 'history' && 'Call History'}
              {activeTab === 'reports' && 'Reports'}
              {activeTab === 'timeline' && 'Lead Timeline'}
            </Text>

            <View style={styles.headerRightPlaceholder} />
          </>
        )}
      </View>

      {/* ---------------- MAIN CONTENT ---------------- */}
      <View style={styles.content}>
        {activeTab === 'leads' && (
          <LeadsScreen
            onSelectLead={handleSelectLead}
            onOpenReport={() => setActiveTab('reports')}
            onOpenHistory={() => setActiveTab('history')}
          />
        )}
        {activeTab === 'dialer' && (
          <DialerScreen
            phone={selectedPhone}
            leads={leads}
            onSelectLead={handleSelectLead}
            onOpenTimeline={() => setActiveTab('timeline')}
          />
        )}
        {activeTab === 'timeline' && (
          <TimelineScreen
            selectedLeadPhone={selectedPhone}
            resetTimeline={resetTimeline}
          />
        )}
        {activeTab === 'history' && <HistoryScreen />}
        {activeTab === 'reports' && <ReportsScreen />}
      </View>

      {/* ---------------- BOTTOM TABS ---------------- */}
      <BottomTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onTimelineTabPress={handleTimelineTabPress}
      />
    </SafeAreaView>
  );
}

// -------------------- BOTTOM TABS --------------------
type BottomTabProps = {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  onTimelineTabPress: () => void;
};

const BottomTabs: React.FC<BottomTabProps> = ({
  activeTab,
  setActiveTab,
  onTimelineTabPress,
}) => (
  <View style={styles.bottomTabs}>
    <TouchableOpacity
      style={[styles.tabButton, activeTab === 'leads' && styles.tabActive]}
      onPress={() => setActiveTab('leads')}
    >
      <MaterialIcons name="home" size={24} color={activeTab === 'leads' ? '#1abc9c' : '#7f8c8d'} />
      <Text style={[styles.tabText, activeTab === 'leads' && styles.tabTextActive]}>Home</Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={[styles.tabButton, activeTab === 'reports' && styles.tabActive]}
      onPress={() => setActiveTab('reports')}
    >
      <MaterialIcons name="bar-chart" size={24} color={activeTab === 'reports' ? '#1abc9c' : '#7f8c8d'} />
      <Text style={[styles.tabText, activeTab === 'reports' && styles.tabTextActive]}>Reports</Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={[styles.tabButton, activeTab === 'timeline' && styles.tabActive]}
      onPress={onTimelineTabPress}
    >
      <MaterialIcons name="timeline" size={24} color={activeTab === 'timeline' ? '#1abc9c' : '#7f8c8d'} />
      <Text style={[styles.tabText, activeTab === 'timeline' && styles.tabTextActive]}>Timeline</Text>
    </TouchableOpacity>
  </View>
);

// -------------------- STYLES --------------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f7' },
  header: {
    height: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  profileContainer: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  profileIcon: {
    width: 46, height: 46, borderRadius: 25,
    backgroundColor: '#1abc9c',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  welcomeContainer: { flex: 1 },
  welcomeText: { fontSize: 14, color: '#7f8c8d' },
  usernameText: { fontSize: 16, fontWeight: '700', color: '#2c3e50' },
  content: { flex: 1 },
  bottomTabs: {
    height: 60, flexDirection: 'row',
    justifyContent: 'space-around', alignItems: 'center',
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e0e0e0',
    shadowColor: '#000', shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: -2 }, shadowRadius: 4, elevation: 5,
  },
  backBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 8, backgroundColor: '#e0f7f4', gap: 4,
  },
  backText: { fontSize: 16, fontWeight: '600', color: '#1abc9c' },
  title: { flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '700', color: '#2c3e50' },
  headerRightPlaceholder: { width: 60 },
  tabButton: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 8 },
  tabActive: { backgroundColor: '#e0f7f4', borderRadius: 8 },
  tabText: { fontSize: 12, color: '#7f8c8d', marginTop: 2 },
  tabTextActive: { color: '#1abc9c', fontWeight: '700' },
});


// import React, { useEffect, useState, useCallback } from 'react';
// import {
//   View,
//   Text,
//   TouchableOpacity,
//   StyleSheet,
//   StatusBar,
//   BackHandler,
//   Alert,
// } from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';
// import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

// import LeadsScreen from './src/screens/LeadsScreen';
// import DialerScreen, { Lead } from './src/screens/DialerScreen';
// import HistoryScreen from './src/screens/HistoryScreen';
// import ReportsScreen from './src/screens/ReportsScreen';
// import TimelineScreen from './src/screens/TimelineScreen';
// import SplashScreen from './src/screens/SplashScreen';
// import LoginScreen from './src/screens/LoginScreen';

// import {
//   initDB,
//   getLeads,
//   getLoggedInUser,
//   clearLoggedInUser,
// } from './src/db/database';
// import { startCallSyncListener } from './src/utils/CallRecorder';

// type Tab = 'leads' | 'dialer' | 'history' | 'reports' | 'timeline';

// export default function App() {
//   const [isLoading, setIsLoading] = useState(true);
//   const [loggedIn, setLoggedIn] = useState(false);
//   const [activeTab, setActiveTab] = useState<Tab>('leads');
//   const [selectedPhone, setSelectedPhone] = useState<string>('');
//   const [leads, setLeads] = useState<Lead[]>([]);
//   const [resetTimeline, setResetTimeline] = useState(false);
//   const [username, setUsername] = useState<string>('');

//   const handleSplashFinish = useCallback(() => setIsLoading(false), []);

//   // -------------------- INIT APP --------------------
//   useEffect(() => {
//     const initializeApp = async () => {
//       try {
//         await initDB();

//         // Check if user is already logged in
//         const user = await getLoggedInUser();
//         if (user) {
//           setLoggedIn(true);
//           setUsername(user.user_name || 'User'); // ⚡ correct column
//         }

//         // Start call listener
//         await startCallSyncListener();

//         // Load leads
//         const dbLeads = await getLeads();
//         setLeads(dbLeads);
//       } catch (e) {
//         console.warn('Initialization error:', e);
//       } finally {
//         setIsLoading(false);
//       }
//     };

//     initializeApp();
//   }, []);

//   // -------------------- TIMELINE RESET --------------------
//   useEffect(() => {
//     if (activeTab === 'timeline') {
//       setResetTimeline(prev => !prev);
//     }
//   }, [activeTab]);

//   // -------------------- ANDROID BACK BUTTON --------------------
//   useEffect(() => {
//     const backAction = () => {
//       if (activeTab !== 'leads') {
//         setActiveTab('leads');
//         return true;
//       }
//       return false;
//     };
//     const backHandler = BackHandler.addEventListener(
//       'hardwareBackPress',
//       backAction
//     );
//     return () => backHandler.remove();
//   }, [activeTab]);

//   // -------------------- LEAD SELECTION --------------------
//   const handleSelectLead = (phone: string) => {
//     const normalizedPhone = phone.replace(/\D/g, '');
//     setSelectedPhone(normalizedPhone);
//     setActiveTab('dialer');
//   };

//   // -------------------- LOGOUT --------------------
//   const handleLogout = async () => {
//     Alert.alert('Logout', 'Are you sure you want to logout?', [
//       { text: 'Cancel', style: 'cancel' },
//       {
//         text: 'Logout',
//         style: 'destructive',
//         onPress: async () => {
//           await clearLoggedInUser();
//           setLoggedIn(false);
//           setUsername('');
//           setActiveTab('leads');
//         },
//       },
//     ]);
//   };

//   // -------------------- RENDER --------------------
//   if (isLoading) return <SplashScreen onFinish={handleSplashFinish} />;

//   if (!loggedIn) {
//     return (
//       <LoginScreen
//         onLoginSuccess={async () => {
//           setLoggedIn(true);

//           // Fetch username after login
//           const user = await getLoggedInUser();
//           setUsername(user?.user_name || 'User');
//         }}
//       />
//     );
//   }

//   return (
//     <SafeAreaView style={styles.container}>
//       <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

// {/* ---------------- HEADER ---------------- */}
// <View style={styles.header}>
//   {activeTab === 'leads' ? (
//     // 🔹 HOME HEADER (Username + Logout)
//     <>
//       <View style={styles.profileContainer}>
//         <View style={styles.profileIcon}>
//           <MaterialIcons name="person" size={28} color="#fff" />
//         </View>
//         <View style={styles.welcomeContainer}>
//           <Text style={styles.welcomeText}>Welcome</Text>
//           <Text style={styles.usernameText}>{username}</Text>
//         </View>
//       </View>

//       <TouchableOpacity onPress={handleLogout}>
//         <MaterialIcons name="logout" size={28} color="#e74c3c" />
//       </TouchableOpacity>
//     </>
//   ) : (
//     // 🔹 OTHER SCREENS HEADER (Back + Title)
//     <>
//       <TouchableOpacity
//         style={styles.backBtn}
//         onPress={() => setActiveTab('leads')}
//       >
//         <MaterialIcons name="arrow-back-ios" size={20} color="#1abc9c" />
//         <Text style={styles.backText}>Back</Text>
//       </TouchableOpacity>

//       <Text style={styles.title}>
//         {activeTab === 'dialer' && 'Dialer'}
//         {activeTab === 'history' && 'Call History'}
//         {activeTab === 'reports' && 'Reports'}
//         {activeTab === 'timeline' && 'Lead Timeline'}
//       </Text>

//       <View style={styles.headerRightPlaceholder} /> 
//     </>
//   )}
// </View>


//       {/* ---------------- MAIN CONTENT ---------------- */}
//       <View style={styles.content}>
//         {activeTab === 'leads' && (
//           <LeadsScreen
//             onSelectLead={handleSelectLead}
//             onOpenReport={() => setActiveTab('reports')}
//             onOpenHistory={() => setActiveTab('history')}
//           />
//         )}
//         {activeTab === 'dialer' && (
//           <DialerScreen
//             phone={selectedPhone}
//             leads={leads}
//             onSelectLead={handleSelectLead}
//             onOpenTimeline={() => setActiveTab('timeline')}
//           />
//         )}
//         {activeTab === 'timeline' && (
//           <TimelineScreen
//             selectedLeadPhone={selectedPhone}
//             resetTimeline={resetTimeline}
//           />
//         )}
//         {activeTab === 'history' && <HistoryScreen />}
//         {activeTab === 'reports' && <ReportsScreen />}
//       </View>

//       {/* ---------------- BOTTOM TABS ---------------- */}
//       <BottomTabs
//         activeTab={activeTab}
//         setActiveTab={setActiveTab}
//         onTimelineTabPress={() => {
//           setSelectedPhone('');
//           setResetTimeline(prev => !prev);
//         }}
//       />
//     </SafeAreaView>
//   );
// }

// // -------------------- BOTTOM TABS --------------------
// type BottomTabProps = {
//   activeTab: Tab;
//   setActiveTab: (tab: Tab) => void;
//   onTimelineTabPress: () => void;
// };

// const BottomTabs: React.FC<BottomTabProps> = ({
//   activeTab,
//   setActiveTab,
//   onTimelineTabPress,
// }) => (
//   <View style={styles.bottomTabs}>
//     <TouchableOpacity
//       style={[styles.tabButton, activeTab === 'leads' && styles.tabActive]}
//       onPress={() => setActiveTab('leads')}
//     >
//       <MaterialIcons
//         name="home"
//         size={24}
//         color={activeTab === 'leads' ? '#1abc9c' : '#7f8c8d'}
//       />
//       <Text
//         style={[styles.tabText, activeTab === 'leads' && styles.tabTextActive]}
//       >
//         Home
//       </Text>
//     </TouchableOpacity>

//     {/* <TouchableOpacity
//       style={[styles.tabButton, activeTab === 'history' && styles.tabActive]}
//       onPress={() => setActiveTab('history')}
//     >
//       <MaterialIcons
//         name="history"
//         size={24}
//         color={activeTab === 'history' ? '#1abc9c' : '#7f8c8d'}
//       />
//       <Text
//         style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}
//       >
//         History
//       </Text>
//     </TouchableOpacity> */}

//     <TouchableOpacity
//       style={[styles.tabButton, activeTab === 'reports' && styles.tabActive]}
//       onPress={() => setActiveTab('reports')}
//     >
//       <MaterialIcons
//         name="bar-chart"
//         size={24}
//         color={activeTab === 'reports' ? '#1abc9c' : '#7f8c8d'}
//       />
//       <Text
//         style={[styles.tabText, activeTab === 'reports' && styles.tabTextActive]}
//       >
//         Reports
//       </Text>
//     </TouchableOpacity>

//     <TouchableOpacity
//       style={[styles.tabButton, activeTab === 'timeline' && styles.tabActive]}
//       onPress={() => {
//         setActiveTab('timeline');
//         onTimelineTabPress();
//       }}
//     >
//       <MaterialIcons
//         name="timeline"
//         size={24}
//         color={activeTab === 'timeline' ? '#1abc9c' : '#7f8c8d'}
//       />
//       <Text
//         style={[styles.tabText, activeTab === 'timeline' && styles.tabTextActive]}
//       >
//         Timeline
//       </Text>
//     </TouchableOpacity>
//   </View>
// );

// // -------------------- STYLES --------------------
// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: '#f0f4f7' },
//   header: {
//     height: 80,
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//     paddingHorizontal: 16,
//     backgroundColor: '#fff',
//     borderBottomWidth: 1,
//     borderBottomColor: '#e0e0e0',
//     shadowColor: '#000',
//     shadowOpacity: 0.05,
//     shadowOffset: { width: 0, height: 2 },
//     shadowRadius: 4,
//     elevation: 2,
//   },
//  profileContainer: {
//   flexDirection: 'row',
//   alignItems: 'center',
//   flex: 1,
// },
// profileIcon: {
//   width: 46,
//   height: 46,
//   borderRadius: 25,
//   backgroundColor: '#1abc9c',
//   justifyContent: 'center',
//   alignItems: 'center',
//   marginRight: 12,
// },
// welcomeContainer: {
//   flex: 1,
// },
// welcomeText: { fontSize: 14, color: '#7f8c8d' },
// usernameText: { fontSize: 16, fontWeight: '700', color: '#2c3e50' },
//   content: { flex: 1 },
//   bottomTabs: {
//     height: 60,
//     flexDirection: 'row',
//     justifyContent: 'space-around',
//     alignItems: 'center',
//     backgroundColor: '#fff',
//     borderTopWidth: 1,
//     borderTopColor: '#e0e0e0',
//     shadowColor: '#000',
//     shadowOpacity: 0.05,
//     shadowOffset: { width: 0, height: -2 },
//     shadowRadius: 4,
//     elevation: 5,
//   },
//   backBtn: {
//   flexDirection: 'row',
//   alignItems: 'center',
//   paddingVertical: 8,
//   paddingHorizontal: 12,
//   borderRadius: 8,
//   backgroundColor: '#e0f7f4',
//   gap: 4,
// },
// backText: {
//   fontSize: 16,
//   fontWeight: '600',
//   color: '#1abc9c',
// },
// title: {
//   flex: 1,
//   textAlign: 'center',
//   fontSize: 20,
//   fontWeight: '700',
//   color: '#2c3e50',
// },
// headerRightPlaceholder: {
//   width: 60,
// },

//   tabButton: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     paddingVertical: 8,
//   },
//   tabActive: { backgroundColor: '#e0f7f4', borderRadius: 8 },
//   tabText: { fontSize: 12, color: '#7f8c8d', marginTop: 2 },
//   tabTextActive: { color: '#1abc9c', fontWeight: '700' },
// });




// import React, { useEffect, useState, useCallback } from 'react';
// import {
//   View,
//   Text,
//   TouchableOpacity,
//   StyleSheet,
//   StatusBar,
//   BackHandler,
// } from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';
// import { initDB, getLeads } from './src/db/database';

// import LeadsScreen from './src/screens/LeadsScreen';
// import DialerScreen, { Lead } from './src/screens/DialerScreen';
// import HistoryScreen from './src/screens/HistoryScreen';
// import ReportsScreen from './src/screens/ReportsScreen';
// import TimelineScreen from './src/screens/TimelineScreen';
// import SplashScreen from './src/screens/SplashScreen';
// import LoginScreen from './src/screens/LoginScreen'; // new

// import { startCallSyncListener  } from './src/utils/CallRecorder';
// import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

// type Tab = 'leads' | 'dialer' | 'history' | 'reports' | 'timeline';

// export default function App() {
//   const [isLoading, setIsLoading] = useState(true); // splash
//   const [loggedIn, setLoggedIn] = useState(false); // login status
//   const [activeTab, setActiveTab] = useState<Tab>('leads');
//   const [selectedPhone, setSelectedPhone] = useState<string>('');
//   const [leads, setLeads] = useState<Lead[]>([]);
//   const [resetTimeline, setResetTimeline] = useState(false);
//   const leadsTitle = 'Home';

//   const handleSplashFinish = useCallback(() => {
//     setIsLoading(false);
//   }, []);


//   useEffect(() => {
//     if (activeTab === 'timeline') {
//       setResetTimeline(prev => !prev); // toggle to trigger effect
//     }
//   }, [activeTab]);

//   // Handle Android back button
//   useEffect(() => {
//     const backAction = () => {
//       if (activeTab !== 'leads') {
//         setActiveTab('leads');
//         return true;
//       }
//       return false;
//     };
//     const backHandler = BackHandler.addEventListener(
//       'hardwareBackPress',
//       backAction,
//     );
//     return () => backHandler.remove();
//   }, [activeTab]);

//   // Load leads and start call listener
//   useEffect(() => {
//   const initializeApp = async () => {
//     try {
//       await initDB();
//       await startCallSyncListener();

//       const dbLeads = await getLeads();
//       setLeads(dbLeads);
//     } catch (e) {
//       console.warn('Initialization error:', e);
//     }
//   };

//   initializeApp();
// }, []);


//   const handleSelectLead = (phone: string) => {
//     const normalizedPhone = phone.replace(/\D/g, '');
//     setSelectedPhone(normalizedPhone);
//     setActiveTab('dialer');
//   };

//   const getTitle = () => {
//     switch (activeTab) {
//       case 'dialer':
//         return 'Dialer';
//       case 'history':
//         return 'Call History';
//       case 'reports':
//         return 'Reports';
//       case 'timeline':
//         return 'Lead Timeline';
//       default:
//         return leadsTitle;
//     }
//   };

//   // -------------------- RENDER --------------------
//   if (isLoading) {
//     return <SplashScreen onFinish={handleSplashFinish} />;
//   }

//   if (!loggedIn) {
//     return <LoginScreen onLoginSuccess={() => setLoggedIn(true)} />;
//   }

//   return (
//     <SafeAreaView style={styles.container}>
//       <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

//       {/* HEADER */}
//       <View style={styles.header}>
//         {activeTab !== 'leads' ? (
//           <TouchableOpacity
//             style={styles.backBtn}
//             onPress={() => setActiveTab('leads')}
//           >
//             <MaterialIcons name="arrow-back-ios" size={20} color="#1abc9c" />
//             <Text style={styles.backText}>Back</Text>
//           </TouchableOpacity>
//         ) : (
//           <View style={styles.backPlaceholder} />
//         )}

//         <Text style={styles.title}>{getTitle()}</Text>
//         <View style={styles.backPlaceholder} />
//       </View>

//       {/* MAIN CONTENT */}
//       <View style={styles.content}>
//         {activeTab === 'leads' && (
//           <LeadsScreen
//             onSelectLead={handleSelectLead}
//             onOpenReport={() => setActiveTab('reports')}
//             onOpenHistory={() => setActiveTab('history')}
//           />
//         )}

//         {activeTab === 'dialer' && (
//           <DialerScreen
//             phone={selectedPhone}
//             leads={leads}
//             onSelectLead={handleSelectLead}
//             onOpenTimeline={() => setActiveTab('timeline')}
//           />
//         )}

//         {activeTab === 'timeline' && (
//           <TimelineScreen
//             selectedLeadPhone={selectedPhone}
//             resetTimeline={resetTimeline}
//           />
//         )}

//         {activeTab === 'history' && <HistoryScreen />}
//         {activeTab === 'reports' && <ReportsScreen />}
//       </View>

//       {/* BOTTOM TABS */}
//       {/* <BottomTabs activeTab={activeTab} setActiveTab={setActiveTab} /> */}
//       <BottomTabs
//         activeTab={activeTab}
//         setActiveTab={setActiveTab}
//         onTimelineTabPress={() => {
//           setSelectedPhone(''); // clear selected phone
//           setResetTimeline(prev => !prev); // toggle to reset TimelineScreen
//         }}
//       />
//     </SafeAreaView>
//   );
// }

// // -------------------- BOTTOM TABS --------------------
// type BottomTabProps = {
//   activeTab: Tab;
//   setActiveTab: (tab: Tab) => void;
//   onTimelineTabPress: () => void;
// };

// const BottomTabs: React.FC<BottomTabProps> = ({
//   activeTab,
//   setActiveTab,
//   onTimelineTabPress,
// }) => (
//   <View style={styles.bottomTabs}>
//     <TouchableOpacity
//       style={[styles.tabButton, activeTab === 'leads' && styles.tabActive]}
//       onPress={() => setActiveTab('leads')}
//     >
//       <MaterialIcons
//         name="home"
//         size={24}
//         color={activeTab === 'leads' ? '#1abc9c' : '#7f8c8d'}
//       />
//       <Text
//         style={[styles.tabText, activeTab === 'leads' && styles.tabTextActive]}
//       >
//         Home
//       </Text>
//     </TouchableOpacity>

//     <TouchableOpacity
//       style={[styles.tabButton, activeTab === 'history' && styles.tabActive]}
//       onPress={() => setActiveTab('history')}
//     >
//       <MaterialIcons
//         name="history"
//         size={24}
//         color={activeTab === 'history' ? '#1abc9c' : '#7f8c8d'}
//       />
//       <Text
//         style={[
//           styles.tabText,
//           activeTab === 'history' && styles.tabTextActive,
//         ]}
//       >
//         History
//       </Text>
//     </TouchableOpacity>

//     <TouchableOpacity
//       style={[styles.tabButton, activeTab === 'reports' && styles.tabActive]}
//       onPress={() => setActiveTab('reports')}
//     >
//       <MaterialIcons
//         name="bar-chart"
//         size={24}
//         color={activeTab === 'reports' ? '#1abc9c' : '#7f8c8d'}
//       />
//       <Text
//         style={[
//           styles.tabText,
//           activeTab === 'reports' && styles.tabTextActive,
//         ]}
//       >
//         Reports
//       </Text>
//     </TouchableOpacity>

//     <TouchableOpacity
//       style={[styles.tabButton, activeTab === 'timeline' && styles.tabActive]}
//       onPress={() => {
//         setActiveTab('timeline');
//         onTimelineTabPress(); // call the handler to reset Timeline
//       }}
//     >
//       <MaterialIcons
//         name="timeline"
//         size={24}
//         color={activeTab === 'timeline' ? '#1abc9c' : '#7f8c8d'}
//       />
//       <Text
//         style={[
//           styles.tabText,
//           activeTab === 'timeline' && styles.tabTextActive,
//         ]}
//       >
//         Timeline
//       </Text>
//     </TouchableOpacity>
//   </View>
// );

// // -------------------- STYLES --------------------
// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: '#f0f4f7' },
//   header: {
//     height: 64,
//     backgroundColor: '#ffffff',
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//     paddingHorizontal: 16,
//     borderBottomWidth: 1,
//     borderBottomColor: '#e0e0e0',
//     shadowColor: '#000',
//     shadowOpacity: 0.05,
//     shadowOffset: { width: 0, height: 2 },
//     shadowRadius: 4,
//     elevation: 2,
//   },
//   backBtn: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     paddingVertical: 8,
//     paddingHorizontal: 12,
//     borderRadius: 8,
//     backgroundColor: '#e0f7f4',
//     gap: 4,
//   },
//   backText: { fontSize: 16, fontWeight: '600', color: '#1abc9c' },
//   backPlaceholder: { width: 68 },
//   title: {
//     flex: 1,
//     textAlign: 'center',
//     fontSize: 20,
//     fontWeight: '700',
//     color: '#2c3e50',
//   },
//   content: { flex: 1 },
//   bottomTabs: {
//     height: 60,
//     flexDirection: 'row',
//     justifyContent: 'space-around',
//     alignItems: 'center',
//     backgroundColor: '#fff',
//     borderTopWidth: 1,
//     borderTopColor: '#e0e0e0',
//     shadowColor: '#000',
//     shadowOpacity: 0.05,
//     shadowOffset: { width: 0, height: -2 },
//     shadowRadius: 4,
//     elevation: 5,
//   },
//   tabButton: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     paddingVertical: 8,
//   },
//   tabActive: { backgroundColor: '#e0f7f4', borderRadius: 8 },
//   tabText: { fontSize: 12, color: '#7f8c8d', marginTop: 2 },
//   tabTextActive: { color: '#1abc9c', fontWeight: '700' },
// });

// import React, { useEffect, useState, useCallback  } from "react";
// import { View, Text, TouchableOpacity, StyleSheet, StatusBar, BackHandler } from "react-native";
// import { SafeAreaView } from "react-native-safe-area-context";
// import { initDB, getLeads } from "./src/db/database";

// import LeadsScreen from "./src/screens/LeadsScreen";
// import DialerScreen, { Lead } from "./src/screens/DialerScreen";
// import HistoryScreen from "./src/screens/HistoryScreen";
// import ReportsScreen from "./src/screens/ReportsScreen";
// import { startCallListener } from "./src/utils/CallRecorder";
// import MaterialIcons from "react-native-vector-icons/MaterialIcons";
// import TimelineScreen from "./src/screens/TimelineScreen";
// import SplashScreen from "./src/screens/SplashScreen";

// // type Tab = "leads" | "dialer" | "history" | "reports" | "timeline";
// type Tab = "leads" | "dialer" | "history" | "reports" | "timeline";

// export default function App() {
//   const [isLoading, setIsLoading] = useState(true);
//   const [activeTab, setActiveTab] = useState<Tab>("leads");
//   const [selectedPhone, setSelectedPhone] = useState<string>("");
//   const [leads, setLeads] = useState<Lead[]>([]);
//   const leadsTitle = "Home";

// const handleSplashFinish = useCallback(() => {
//     setIsLoading(false);
//   }, []);

//   // Handle Android back button
//   useEffect(() => {
//     const backAction = () => {
//       if (activeTab !== "leads") {
//         setActiveTab("leads");
//         return true;
//       }
//       return false;
//     };

//     const backHandler = BackHandler.addEventListener(
//       "hardwareBackPress",
//       backAction
//     );

//     return () => backHandler.remove();
//   }, [activeTab]);

//   // Load leads and start call listener
//   useEffect(() => {
//   startCallListener();

//   const loadLeads = async () => {
//     try {
//       await initDB(); // initialize SQLite DB
//       const dbLeads = await getLeads(); // fetch all leads from DB
//       setLeads(dbLeads);
//     } catch (e) {
//       console.warn("Failed to load leads from DB:", e);
//     }
//   };

//   loadLeads();
// }, []);

// const handleSelectLead = (phone: string) => {
//   const normalizedPhone = phone.replace(/\D/g, "");
//   setSelectedPhone(normalizedPhone);
//   setActiveTab("dialer");
// };

//   const getTitle = () => {
//     switch (activeTab) {
//       case "dialer":
//         return "Dialer";
//       case "history":
//         return "Call History";
//       case "reports":
//         return "Reports";
//       case "timeline":
//       return "Lead Timeline";
//       default:
//         return leadsTitle;
//     }
//   };

//   return (
//        <SafeAreaView style={styles.container}>
//       {isLoading ? (
//         <SplashScreen onFinish={handleSplashFinish} />
//       ) : (
//         <>
//           <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

//           {/* HEADER */}
//           <View style={styles.header}>
//             {activeTab !== "leads" ? (
//               <TouchableOpacity
//                 style={styles.backBtn}
//                 onPress={() => setActiveTab("leads")}
//               >
//                 <MaterialIcons
//                   name="arrow-back-ios"
//                   size={20}
//                   color="#1abc9c"
//                 />
//                 <Text style={styles.backText}>Back</Text>
//               </TouchableOpacity>
//             ) : (
//               <View style={styles.backPlaceholder} />
//             )}

//             <Text style={styles.title}>{getTitle()}</Text>
//             <View style={styles.backPlaceholder} />
//           </View>

//           {/* MAIN CONTENT */}
//           <View style={styles.content}>
//             {activeTab === "leads" && (
//               <LeadsScreen
//                 onSelectLead={handleSelectLead}
//                 onOpenReport={() => setActiveTab("reports")}
//                 onOpenHistory={() => setActiveTab("history")}
//               />
//             )}

//             {activeTab === "dialer" && (
//               <DialerScreen
//                 phone={selectedPhone}
//                 leads={leads}
//                 onSelectLead={handleSelectLead}
//                 onOpenTimeline={() => setActiveTab("timeline")}
//               />
//             )}

//             {activeTab === "timeline" && (
//               <TimelineScreen selectedLeadPhone={selectedPhone} />
//             )}

//             {activeTab === "history" && <HistoryScreen />}
//             {activeTab === "reports" && <ReportsScreen />}
//           </View>

//           {/* BOTTOM TABS */}
//           <BottomTabs activeTab={activeTab} setActiveTab={setActiveTab} />
//         </>
//       )}
//     </SafeAreaView>
//   );
// }

// // Bottom Tabs Component
// type BottomTabProps = {
//   activeTab: Tab;
//   setActiveTab: (tab: Tab) => void;
// };

// const BottomTabs: React.FC<BottomTabProps> = ({ activeTab, setActiveTab }) => {
//   return (
//     <View style={styles.bottomTabs}>
//       <TouchableOpacity
//         style={[styles.tabButton, activeTab === "leads" && styles.tabActive]}
//         onPress={() => setActiveTab("leads")}
//       >
//         <MaterialIcons
//           name="home"
//           size={24}
//           color={activeTab === "leads" ? "#1abc9c" : "#7f8c8d"}
//         />
//         <Text style={[styles.tabText, activeTab === "leads" && styles.tabTextActive]}>
//           Leads
//         </Text>
//       </TouchableOpacity>

//       <TouchableOpacity
//         style={[styles.tabButton, activeTab === "history" && styles.tabActive]}
//         onPress={() => setActiveTab("history")}
//       >
//         <MaterialIcons
//           name="history"
//           size={24}
//           color={activeTab === "history" ? "#1abc9c" : "#7f8c8d"}
//         />
//         <Text style={[styles.tabText, activeTab === "history" && styles.tabTextActive]}>
//           History
//         </Text>
//       </TouchableOpacity>

//       <TouchableOpacity
//         style={[styles.tabButton, activeTab === "reports" && styles.tabActive]}
//         onPress={() => setActiveTab("reports")}
//       >
//         <MaterialIcons
//           name="bar-chart"
//           size={24}
//           color={activeTab === "reports" ? "#1abc9c" : "#7f8c8d"}
//         />
//         <Text style={[styles.tabText, activeTab === "reports" && styles.tabTextActive]}>
//           Reports
//         </Text>
//       </TouchableOpacity>

//       <TouchableOpacity
//   style={[styles.tabButton, activeTab === "timeline" && styles.tabActive]}
//   onPress={() => setActiveTab("timeline")}
// >
//   <MaterialIcons
//     name="timeline"
//     size={24}
//     color={activeTab === "timeline" ? "#1abc9c" : "#7f8c8d"}
//   />
//   <Text style={[styles.tabText, activeTab === "timeline" && styles.tabTextActive]}>
//     Timeline
//   </Text>
// </TouchableOpacity>

//     </View>
//   );
// };

// // STYLES
// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: "#f0f4f7",
//   },

//   header: {
//     height: 64,
//     backgroundColor: "#ffffff",
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "space-between",
//     paddingHorizontal: 16,
//     borderBottomWidth: 1,
//     borderBottomColor: "#e0e0e0",
//     shadowColor: "#000",
//     shadowOpacity: 0.05,
//     shadowOffset: { width: 0, height: 2 },
//     shadowRadius: 4,
//     elevation: 2,
//   },

//   backBtn: {
//     flexDirection: "row",
//     alignItems: "center",
//     paddingVertical: 8,
//     paddingHorizontal: 12,
//     borderRadius: 8,
//     backgroundColor: "#e0f7f4",
//     gap: 4,
//   },

//   backText: {
//     fontSize: 16,
//     fontWeight: "600",
//     color: "#1abc9c",
//   },

//   backPlaceholder: { width: 68 },

//   title: {
//     flex: 1,
//     textAlign: "center",
//     fontSize: 20,
//     fontWeight: "700",
//     color: "#2c3e50",
//   },

//   content: {
//     flex: 1,
//   },

//   bottomTabs: {
//     height: 60,
//     flexDirection: "row",
//     justifyContent: "space-around",
//     alignItems: "center",
//     backgroundColor: "#fff",
//     borderTopWidth: 1,
//     borderTopColor: "#e0e0e0",
//     shadowColor: "#000",
//     shadowOpacity: 0.05,
//     shadowOffset: { width: 0, height: -2 },
//     shadowRadius: 4,
//     elevation: 5,
//   },

//   tabButton: {
//     flex: 1,
//     justifyContent: "center",
//     alignItems: "center",
//     paddingVertical: 8,
//   },

//   tabActive: {
//     backgroundColor: "#e0f7f4",
//     borderRadius: 8,
//   },

//   tabText: {
//     fontSize: 12,
//     color: "#7f8c8d",
//     marginTop: 2,
//   },

//   tabTextActive: {
//     color: "#1abc9c",
//     fontWeight: "700",
//   },

//   modalButtonSelected: {
//   backgroundColor: "#d0f0e0", // light green highlight when selected
//   borderRadius: 8,
// }

// });

// import React, { useEffect, useState } from "react";
// import { View, Text, TouchableOpacity, StyleSheet, StatusBar, BackHandler } from "react-native";
// import { SafeAreaView } from "react-native-safe-area-context";
// import AsyncStorage from "@react-native-async-storage/async-storage";

// import LeadsScreen from "./src/screens/LeadsScreen";
// import DialerScreen, { Lead } from "./src/screens/DialerScreen";
// import HistoryScreen from "./src/screens/HistoryScreen";
// import ReportsScreen from "./src/screens/ReportsScreen";
// import { startCallListener } from "./src/utils/CallRecorder";
// import MaterialIcons from "react-native-vector-icons/MaterialIcons";

// type Tab = "leads" | "dialer" | "history" | "reports";

// export default function App() {
//   const [activeTab, setActiveTab] = useState<Tab>("leads");
//   const [selectedPhone, setSelectedPhone] = useState<string>("");
//   const [leads, setLeads] = useState<Lead[]>([]);
//   const leadsTitle = "CRM Dashboard";

//   // Handle Android back button
//   useEffect(() => {
//     const backAction = () => {
//       if (activeTab !== "leads") {
//         setActiveTab("leads");
//         return true;
//       }
//       return false;
//     };

//     const backHandler = BackHandler.addEventListener(
//       "hardwareBackPress",
//       backAction
//     );

//     return () => backHandler.remove();
//   }, [activeTab]);

//   // Load leads and start call listener
//   useEffect(() => {
//     startCallListener();

//     const loadLeads = async () => {
//       try {
//         const saved = await AsyncStorage.getItem("leads");
//         if (saved) setLeads(JSON.parse(saved));
//       } catch (e) {
//         console.warn("Failed to load leads:", e);
//       }
//     };

//     loadLeads();
//   }, []);

//   const handleSelectLead = (phone: string) => {
//     setSelectedPhone(phone);
//     setActiveTab("dialer");
//   };

//   const getTitle = () => {
//     switch (activeTab) {
//       case "dialer":
//         return "Dialer";
//       case "history":
//         return "Call History";
//       case "reports":
//         return "Reports";
//       default:
//         return leadsTitle;
//     }
//   };

//   return (
//     <SafeAreaView style={styles.container}>
//       <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

//       {/* HEADER */}
//       <View style={styles.header}>
//         {activeTab !== "leads" ? (
//           <TouchableOpacity style={styles.backBtn} onPress={() => setActiveTab("leads")}>
//             <MaterialIcons name="arrow-back-ios" size={20} color="#1abc9c" />
//             <Text style={styles.backText}>Back</Text>
//           </TouchableOpacity>
//         ) : (
//           <View style={styles.backPlaceholder} />
//         )}

//         <Text style={styles.title}>{getTitle()}</Text>
//         <View style={styles.backPlaceholder} />
//       </View>

//       {/* MAIN CONTENT */}
//       <View style={styles.content}>
//         {activeTab === "leads" && (
//           <LeadsScreen
//             onSelectLead={handleSelectLead}
//             onOpenReport={() => setActiveTab("reports")}
//             onOpenHistory={() => setActiveTab("history")}
//           />
//         )}

//         {activeTab === "dialer" && (
//           <DialerScreen
//             phone={selectedPhone}
//             leads={leads}
//             onSelectLead={handleSelectLead}
//           />
//         )}

//         {activeTab === "history" && <HistoryScreen />}
//         {activeTab === "reports" && <ReportsScreen />}
//       </View>

//       {/* BOTTOM TABS - always visible */}
//       <BottomTabs activeTab={activeTab} setActiveTab={setActiveTab} />
//     </SafeAreaView>
//   );
// }

// // Bottom Tabs Component
// type BottomTabProps = {
//   activeTab: Tab;
//   setActiveTab: (tab: Tab) => void;
// };

// const BottomTabs: React.FC<BottomTabProps> = ({ activeTab, setActiveTab }) => {
//   return (
//     <View style={styles.bottomTabs}>
//       <TouchableOpacity
//         style={[styles.tabButton, activeTab === "leads" && styles.tabActive]}
//         onPress={() => setActiveTab("leads")}
//       >
//         <MaterialIcons
//           name="home"
//           size={24}
//           color={activeTab === "leads" ? "#1abc9c" : "#7f8c8d"}
//         />
//         <Text style={[styles.tabText, activeTab === "leads" && styles.tabTextActive]}>
//           Leads
//         </Text>
//       </TouchableOpacity>

//       <TouchableOpacity
//         style={[styles.tabButton, activeTab === "history" && styles.tabActive]}
//         onPress={() => setActiveTab("history")}
//       >
//         <MaterialIcons
//           name="history"
//           size={24}
//           color={activeTab === "history" ? "#1abc9c" : "#7f8c8d"}
//         />
//         <Text style={[styles.tabText, activeTab === "history" && styles.tabTextActive]}>
//           History
//         </Text>
//       </TouchableOpacity>

//       <TouchableOpacity
//         style={[styles.tabButton, activeTab === "reports" && styles.tabActive]}
//         onPress={() => setActiveTab("reports")}
//       >
//         <MaterialIcons
//           name="bar-chart"
//           size={24}
//           color={activeTab === "reports" ? "#1abc9c" : "#7f8c8d"}
//         />
//         <Text style={[styles.tabText, activeTab === "reports" && styles.tabTextActive]}>
//           Reports
//         </Text>
//       </TouchableOpacity>
//     </View>
//   );
// };

// // STYLES
// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: "#f0f4f7",
//   },

//   header: {
//     height: 64,
//     backgroundColor: "#ffffff",
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "space-between",
//     paddingHorizontal: 16,
//     borderBottomWidth: 1,
//     borderBottomColor: "#e0e0e0",
//     shadowColor: "#000",
//     shadowOpacity: 0.05,
//     shadowOffset: { width: 0, height: 2 },
//     shadowRadius: 4,
//     elevation: 2,
//   },

//   backBtn: {
//     flexDirection: "row",
//     alignItems: "center",
//     paddingVertical: 8,
//     paddingHorizontal: 12,
//     borderRadius: 8,
//     backgroundColor: "#e0f7f4",
//     gap: 4,
//   },

//   backText: {
//     fontSize: 16,
//     fontWeight: "600",
//     color: "#1abc9c",
//   },

//   backPlaceholder: { width: 68 },

//   title: {
//     flex: 1,
//     textAlign: "center",
//     fontSize: 20,
//     fontWeight: "700",
//     color: "#2c3e50",
//   },

//   content: {
//     flex: 1,
//   },

//   bottomTabs: {
//     height: 60,
//     flexDirection: "row",
//     justifyContent: "space-around",
//     alignItems: "center",
//     backgroundColor: "#fff",
//     borderTopWidth: 1,
//     borderTopColor: "#e0e0e0",
//     shadowColor: "#000",
//     shadowOpacity: 0.05,
//     shadowOffset: { width: 0, height: -2 },
//     shadowRadius: 4,
//     elevation: 5,
//   },

//   tabButton: {
//     flex: 1,
//     justifyContent: "center",
//     alignItems: "center",
//     paddingVertical: 8,
//   },

//   tabActive: {
//     backgroundColor: "#e0f7f4",
//     borderRadius: 8,
//   },

//   tabText: {
//     fontSize: 12,
//     color: "#7f8c8d",
//     marginTop: 2,
//   },

//   tabTextActive: {
//     color: "#1abc9c",
//     fontWeight: "700",
//   },
// });

// import React, { useEffect, useState } from "react";
// import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from "react-native";
// import { BackHandler } from "react-native";
// import { SafeAreaView } from "react-native-safe-area-context";
// import AsyncStorage from "@react-native-async-storage/async-storage"; // ✅ Import AsyncStorage

// import LeadsScreen from "./src/screens/LeadsScreen";
// import DialerScreen, { Lead } from "./src/screens/DialerScreen"; // Import Lead type
// import HistoryScreen from "./src/screens/HistoryScreen";
// import { startCallListener } from "./src/utils/CallRecorder";
// import MaterialIcons from "react-native-vector-icons/MaterialIcons";
// import ReportsScreen from "./src/screens/ReportsScreen";

// type Tab = "leads" | "dialer" | "history" | "reports";

// export default function App() {
//   const [activeTab, setActiveTab] = useState<Tab>("leads");
//   const [selectedPhone, setSelectedPhone] = useState<string>("");
//   const [leads, setLeads] = useState<Lead[]>([]); // store leads globally
//   const leadsTitle = "CRM Dashboard";

//   useEffect(() => {
//   const backAction = () => {
//     if (activeTab !== "leads") {
//       setActiveTab("leads"); // Go back to leads tab
//       return true; // Prevent default behavior (exit app)
//     }
//     return false; // Allow default behavior (exit app)
//   };

//   const backHandler = BackHandler.addEventListener(
//     "hardwareBackPress",
//     backAction
//   );

//   return () => backHandler.remove(); // Clean up
// }, [activeTab]);

//   useEffect(() => {
//     startCallListener(); // Start listening to native call events

//     // Load leads from AsyncStorage on app start
//     const loadLeads = async () => {
//       try {
//         const saved = await AsyncStorage.getItem("leads");
//         if (saved) setLeads(JSON.parse(saved));
//       } catch {}
//     };

//     loadLeads();
//   }, []);

//   const handleSelectLead = (phone: string) => {
//     setSelectedPhone(phone);
//     setActiveTab("dialer");
//   };

// const getTitle = () => {
//   switch (activeTab) {
//     case "dialer":
//       return "Dialer";
//     case "history":
//       return "Call History";
//       case "reports":
//       return "Reports";
//     default:
//       return leadsTitle;
//   }
// };

//   return (
//     <SafeAreaView style={styles.container}>
//       <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

//       {/* HEADER */}
//       <View style={styles.header}>
//         {activeTab !== "leads" ? (
//          <TouchableOpacity style={styles.backBtn} onPress={() => setActiveTab("leads")}>
//   <MaterialIcons name="arrow-back-ios" size={20} color="#1abc9c" />
//   <Text style={styles.backText}>Back</Text>
// </TouchableOpacity>
//         ) : (
//           <View style={styles.backPlaceholder} />
//         )}

//         <Text style={styles.title}>{getTitle()}</Text>
//         <View style={styles.backPlaceholder} />
//       </View>

//       {/* MAIN CONTENT */}
//       <View style={styles.content}>
//         {activeTab === "leads" && (
//           <LeadsScreen
//             onSelectLead={handleSelectLead}
//             onOpenReport={() => setActiveTab("reports")}
//             onOpenHistory={() => setActiveTab("history")}
//             // ✅ Only pass props that LeadsScreen expects
//             // If your LeadsScreen type doesn't include leads/setLeads, don't pass them
//           />
//         )}

//         {activeTab === "dialer" && (
//           <DialerScreen
//             phone={selectedPhone}
//             leads={leads}               // pass full leads
//             onSelectLead={handleSelectLead} // pass handler to switch leads
//           />
//         )}

//         {activeTab === "history" && <HistoryScreen />}
//         {activeTab === "reports" && <ReportsScreen />}
//       </View>
//     </SafeAreaView>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: "#f0f4f7",
//   },

//   header: {
//     height: 64,
//     backgroundColor: "#ffffff",
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "space-between",
//     paddingHorizontal: 16,
//     borderBottomWidth: 1,
//     borderBottomColor: "#e0e0e0",
//     shadowColor: "#000",
//     shadowOpacity: 0.05,
//     shadowOffset: { width: 0, height: 2 },
//     shadowRadius: 4,
//     elevation: 2,
//   },

//  backBtn: {
//   flexDirection: "row",   // icon and text in a row
//   alignItems: "center",   // vertically center
//   paddingVertical: 8,
//   paddingHorizontal: 12,
//   borderRadius: 8,
//   backgroundColor: "#e0f7f4",
//   gap: 4,                 // space between icon and text
// },

//   backText: {
//     fontSize: 16,
//     fontWeight: "600",
//     color: "#1abc9c",
//   },

//   backPlaceholder: { width: 68 }, // Same width as backBtn

//   title: {
//     flex: 1,
//     textAlign: "center",
//     fontSize: 20,
//     fontWeight: "700",
//     color: "#2c3e50",
//   },

//   content: {
//     flex: 1,
//   },
// });

// import React, { useEffect, useState } from "react";
// import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from "react-native";
// import { SafeAreaView } from "react-native-safe-area-context";

// import LeadsScreen from "./src/screens/LeadsScreen";
// import DialerScreen from "./src/screens/DialerScreen";
// import HistoryScreen from "./src/screens/HistoryScreen";
// import { startCallListener } from "./src/utils/CallRecorder";

// type Tab = "leads" | "dialer" | "history";

// export default function App() {
//   const [activeTab, setActiveTab] = useState<Tab>("leads");
//   const [selectedPhone, setSelectedPhone] = useState<string>("");

//   useEffect(() => {
//     startCallListener(); // Start listening to native call events
//   }, []);

//   const handleSelectLead = (phone: string) => {
//     setSelectedPhone(phone);
//     setActiveTab("dialer");
//   };

//   const getTitle = () => {
//     switch (activeTab) {
//       case "dialer": return "Dialer";
//       case "history": return "Call History";
//       default: return "Leads";
//     }
//   };

//   return (
//     <SafeAreaView style={styles.container}>
//       <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

//       {/* HEADER */}
//       <View style={styles.header}>
//         {activeTab !== "leads" ? (
//           <TouchableOpacity style={styles.backBtn} onPress={() => setActiveTab("leads")}>
//             <Text style={styles.backText}>‹ Back</Text>
//           </TouchableOpacity>
//         ) : (
//           <View style={styles.backPlaceholder} />
//         )}

//         <Text style={styles.title}>{getTitle()}</Text>
//         <View style={styles.backPlaceholder} />
//       </View>

//       {/* MAIN CONTENT */}
//       <View style={styles.content}>
//         {activeTab === "leads" && (
//           <LeadsScreen
//             onSelectLead={handleSelectLead}
//             onOpenDialer={() => setActiveTab("dialer")}
//             onOpenHistory={() => setActiveTab("history")}
//           />
//         )}

//         {activeTab === "dialer" && <DialerScreen phone={selectedPhone} />}
//         {activeTab === "history" && <HistoryScreen />}
//       </View>
//     </SafeAreaView>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: "#f0f4f7",
//   },

//   header: {
//     height: 64,
//     backgroundColor: "#ffffff",
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "space-between",
//     paddingHorizontal: 16,
//     borderBottomWidth: 1,
//     borderBottomColor: "#e0e0e0",
//     shadowColor: "#000",
//     shadowOpacity: 0.05,
//     shadowOffset: { width: 0, height: 2 },
//     shadowRadius: 4,
//     elevation: 2,
//   },

//   backBtn: {
//     paddingVertical: 8,
//     paddingHorizontal: 12,
//     borderRadius: 8,
//     backgroundColor: "#e0f7f4",
//   },

//   backText: {
//     fontSize: 16,
//     fontWeight: "600",
//     color: "#1abc9c",
//   },

//   backPlaceholder: { width: 68 }, // Same width as backBtn

//   title: {
//     flex: 1,
//     textAlign: "center",
//     fontSize: 20,
//     fontWeight: "700",
//     color: "#2c3e50",
//   },

//   content: {
//     flex: 1,
//   },
// });

// import React, { useEffect, useState } from "react";
// import {
//   NativeModules,
//   NativeEventEmitter,
//   PermissionsAndroid,
//   View,
//   Text,
//   FlatList,
//   Platform,
//   StyleSheet,
//   TouchableOpacity,
//   Linking,
//   KeyboardAvoidingView,
// } from "react-native";
// import AsyncStorage from "@react-native-async-storage/async-storage";

// type CallLog = {
//   id: string;
//   number?: string;
//   duration: number;
//   time: string;
// };

// type CallEvent = {
//   state: "Incoming" | "Connected" | "Disconnected";
//   number?: string;
//   duration?: number;
// };

// const { CallDetector } = NativeModules;
// const emitter = new NativeEventEmitter(CallDetector);

// export default function App(): JSX.Element {
//   const [logs, setLogs] = useState<CallLog[]>([]);
//   const [activeTab, setActiveTab] = useState<"dialer" | "history">("dialer");
//   const [dialNumber, setDialNumber] = useState("");

//   useEffect(() => {
//     if (Platform.OS !== "android") return;

//     requestPermissions().then(() => {
//       loadLogs();
//       CallDetector.startListening();
//     });

//     const subscription = emitter.addListener("CallEvent", async (data: CallEvent) => {
//       if (data.state === "Disconnected" && data.duration) {
//         const log: CallLog = {
//           id: Date.now().toString(),
//           number: data.number,
//           duration: data.duration,
//           time: new Date().toLocaleString(),
//         };

//         setLogs(prev => {
//           const updated = [log, ...prev];
//           AsyncStorage.setItem("logs", JSON.stringify(updated));
//           return updated;
//         });
//       }
//     });

//     return () => {
//       subscription.remove();
//       CallDetector.stopListening?.();
//     };
//   }, []);

//   const requestPermissions = async () => {
//     await PermissionsAndroid.requestMultiple([
//       PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
//       PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
//       PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
//       PermissionsAndroid.PERMISSIONS.CALL_PHONE,
//     ]);
//   };

//   const loadLogs = async () => {
//     const saved = await AsyncStorage.getItem("logs");
//     if (saved) setLogs(JSON.parse(saved));
//   };

//   const makeCall = () => {
//     if (!dialNumber) return;
//     const url = `tel:${dialNumber}`;
//     Linking.canOpenURL(url).then(supported => {
//       if (supported) Linking.openURL(url);
//     });
//   };

//  const MAX_NUMBER_LENGTH = 18; // maximum digits allowed

// const handleKeyPress = (key: string) => {
//   setDialNumber(prev => {
//     if (prev.length >= MAX_NUMBER_LENGTH) return prev; // limit reached
//     return prev + key;
//   });
// };

// const handleBackspace = () => {
//   setDialNumber(prev => prev.slice(0, -1));
// };

//   const keypad = [
//     ["1", "2", "3"],
//     ["4", "5", "6"],
//     ["7", "8", "9"],
//     ["*", "0", "#"],
//   ];

//   return (
//     <KeyboardAvoidingView style={styles.container} behavior="padding">
//       {/* Tabs */}
//       <View style={styles.tabContainer}>
//         <TouchableOpacity
//           style={[styles.tab, activeTab === "dialer" && styles.activeTab]}
//           onPress={() => setActiveTab("dialer")}
//         >
//           <Text style={[styles.tabText, activeTab === "dialer" && styles.activeTabText]}>Dialer</Text>
//         </TouchableOpacity>
//         <TouchableOpacity
//           style={[styles.tab, activeTab === "history" && styles.activeTab]}
//           onPress={() => setActiveTab("history")}
//         >
//           <Text style={[styles.tabText, activeTab === "history" && styles.activeTabText]}>History</Text>
//         </TouchableOpacity>
//       </View>

//       {activeTab === "dialer" ? (
//         <View style={styles.dialerContainer}>
//           <Text style={styles.dialerNumber} numberOfLines={1} ellipsizeMode="tail">
//   {dialNumber || "Enter your Number"}
// </Text>

//           <View style={styles.keypad}>
//             {keypad.map((row, rowIndex) => (
//               <View key={rowIndex} style={styles.keyRow}>
//                 {row.map(key => (
//                   <TouchableOpacity key={key} style={styles.key} onPress={() => handleKeyPress(key)}>
//                     <Text style={styles.keyText}>{key}</Text>
//                   </TouchableOpacity>
//                 ))}
//               </View>
//             ))}
//             <View style={styles.keyRow}>
//               <TouchableOpacity style={styles.key} onPress={handleBackspace}>
//                 <Text style={styles.keyText}>⌫</Text>
//               </TouchableOpacity>
//               <TouchableOpacity style={[styles.key, styles.callKey]} onPress={makeCall}>
//                 <Text style={styles.keyText}>📞</Text>
//               </TouchableOpacity>
//             </View>
//           </View>
//         </View>
//       ) : (
//         <View style={styles.historyContainer}>
//           {logs.length === 0 ? (
//             <View style={styles.emptyContainer}>
//               <Text style={styles.emptyText}>No calls recorded yet</Text>
//             </View>
//           ) : (
//             <FlatList
//               data={logs}
//               keyExtractor={item => item.id}
//               contentContainerStyle={styles.listContainer}
//               renderItem={({ item }) => (
//                 <View style={styles.card}>
//                   <View style={styles.cardContent}>
//                     <View style={styles.cardLeft}>
//                       <Text style={styles.logItemNumber}>📞 {item.number ?? "Unknown"}</Text>
//                       <Text style={styles.callTime}>{item.time}</Text>
//                     </View>
//                     <View style={styles.durationBadge}>
//                       <Text style={styles.durationText}>{item.duration}s ⏱</Text>
//                     </View>
//                   </View>
//                 </View>
//               )}
//             />
//           )}
//         </View>
//       )}
//     </KeyboardAvoidingView>
//   );
// }

// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: "#f5f6fa", paddingTop: 50, paddingHorizontal: 20 },
//   historyContainer: { flex: 1 },
//   tabContainer: { flexDirection: "row", marginBottom: 20 },
//   tab: { flex: 1, paddingVertical: 12, backgroundColor: "#dcdde1", borderRadius: 10, marginHorizontal: 5, alignItems: "center" },
//   activeTab: { backgroundColor: "#4cd137" },
//   tabText: { fontSize: 16, fontWeight: "600", color: "#2f3640" },
//   activeTabText: { color: "#fff" },
//   dialerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
//   dialerNumber: { fontSize: 30, fontWeight: "700", marginBottom: 20, color: "#2f3640" },
//   keypad: { width: "100%" },
//   keyRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: 15 },
//   key: { backgroundColor: "#fff", flex: 1, marginHorizontal: 5, paddingVertical: 20, borderRadius: 12, alignItems: "center", justifyContent: "center" },
//   callKey: { backgroundColor: "#44bd32" },
//   keyText: { fontSize: 20, fontWeight: "700", color: "#2f3640" },
//   listContainer: { paddingBottom: 20 },
//   card: { backgroundColor: "#fff", borderRadius: 12, padding: 15, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 5, elevation: 3 },
//   cardContent: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
//   cardLeft: { flexDirection: "column" },
//   logItemNumber: { fontSize: 16, fontWeight: "bold", color: "#2f3640" },
//   callTime: { fontSize: 14, color: "#718093", marginTop: 4 },
//   durationBadge: { backgroundColor: "#4cd137", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
//   durationText: { color: "#fff", fontWeight: "600", fontSize: 14 },
//   emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", marginTop: 50 },
//   emptyText: { fontSize: 18, color: "#718093" },
// });

// Dialer and Call History Added Version

// import React, { useEffect, useState } from "react";
// import {
//   NativeModules,
//   NativeEventEmitter,
//   PermissionsAndroid,
//   View,
//   Text,
//   FlatList,
//   Platform,
//   StyleSheet,
// } from "react-native";
// import AsyncStorage from "@react-native-async-storage/async-storage";

// type CallLog = {
//   id: string;
//   number?: string;
//   duration: number;
//   time: string;
// };

// type CallEvent = {
//   state: "Incoming" | "Connected" | "Disconnected";
//   number?: string;
//   duration?: number;
// };

// const { CallDetector } = NativeModules;
// const emitter = new NativeEventEmitter(CallDetector);

// export default function App(): JSX.Element {
//   const [logs, setLogs] = useState<CallLog[]>([]);

//   useEffect(() => {
//     if (Platform.OS !== "android") return;

//     requestPermissions().then(() => {
//       loadLogs();
//       CallDetector.startListening();
//     });

//     const subscription = emitter.addListener("CallEvent", async (data: CallEvent) => {
//       if (data.state === "Disconnected" && data.duration) {
//         const log: CallLog = {
//           id: Date.now().toString(),
//           number: data.number, // store the number
//           duration: data.duration,
//           time: new Date().toLocaleString(),
//         };

//         setLogs(prev => {
//           const updated = [log, ...prev];
//           AsyncStorage.setItem("logs", JSON.stringify(updated));
//           return updated;
//         });
//       }
//     });

//     return () => {
//       subscription.remove();
//       CallDetector.stopListening?.();
//     };
//   }, []);

//   const requestPermissions = async () => {
//     await PermissionsAndroid.requestMultiple([
//       PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
//       PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
//       PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
//     ]);
//   };

//   const loadLogs = async () => {
//     const saved = await AsyncStorage.getItem("logs");
//     if (saved) setLogs(JSON.parse(saved));
//   };

//   return (
//     <View style={styles.container}>
//       <Text style={styles.title}>📞 Call History</Text>

//       {logs.length === 0 ? (
//         <View style={styles.emptyContainer}>
//           <Text style={styles.emptyText}>No calls recorded yet</Text>
//         </View>
//       ) : (
//         <FlatList
//   data={logs}
//   keyExtractor={item => item.id}
//   contentContainerStyle={styles.listContainer}
//   renderItem={({ item }) => (
//     <View style={styles.card}>
//       <View style={styles.cardContent}>
//         <View style={styles.cardLeft}>
//           <Text style={styles.logItemNumber}>📞 {item.number ?? "Unknown"}</Text>
//           <Text style={styles.callTime}>{item.time}</Text>
//         </View>
//         <View style={styles.durationBadge}>
//           <Text style={styles.durationText}>{item.duration}s ⏱</Text>
//         </View>
//       </View>
//     </View>
//   )}
// />
//       )}
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     padding: 20,
//     backgroundColor: "#f5f6fa",
//   },
//   title: {
//     fontSize: 26,
//     fontWeight: "700",
//     color: "#2f3640",
//     marginBottom: 20,
//   },
//    listContainer: {
//     paddingBottom: 20,
//   },
//   card: {
//     backgroundColor: "#fff",
//     borderRadius: 12,
//     padding: 15,
//     marginBottom: 12,
//     shadowColor: "#000",
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.1,
//     shadowRadius: 5,
//     elevation: 3,
//   },
// cardContent: {
//   flexDirection: "row",
//   justifyContent: "space-between",
//   alignItems: "center",
// },
// cardLeft: {
//   flexDirection: "column",
// },
// logItemNumber: {
//   fontSize: 16,
//   fontWeight: "bold",
//   color: "#2f3640",
// },
// callTime: {
//   fontSize: 14,
//   color: "#718093",
//   marginTop: 4,
// },
// durationBadge: {
//   backgroundColor: "#4cd137",
//   paddingHorizontal: 12,
//   paddingVertical: 6,
//   borderRadius: 12,
// },
// durationText: {
//   color: "#fff",
//   fontWeight: "600",
//   fontSize: 14,
// },
//   emptyContainer: {
//     flex: 1,
//     justifyContent: "center",
//     alignItems: "center",
//     marginTop: 50,
//   },
//   emptyText: {
//     fontSize: 18,
//     color: "#718093",
//   },
// });

// import React, { useEffect, useState } from "react";
// import {
//   NativeModules,
//   NativeEventEmitter,
//   PermissionsAndroid,
//   View,
//   Text,
//   FlatList,
//   Platform,
//   StyleSheet,
// } from "react-native";
// import AsyncStorage from "@react-native-async-storage/async-storage";

// type CallLog = {
//   id: string;
//   duration: number;
//   time: string;
// };

// type CallEvent = {
//   state: "Incoming" | "Connected" | "Disconnected";
//   number?: string;
//   duration?: number;
// };

// const { CallDetector } = NativeModules;
// const emitter = new NativeEventEmitter(CallDetector);

// export default function App(): JSX.Element {
//   const [logs, setLogs] = useState<CallLog[]>([]);

//   useEffect(() => {
//     if (Platform.OS !== "android") return;

//     requestPermissions().then(() => {
//       loadLogs();
//       CallDetector.startListening();
//     });

//     const subscription = emitter.addListener("CallEvent", async (data: CallEvent) => {
//       if (data.state === "Disconnected" && data.duration) {
//         const log: CallLog = {
//           id: Date.now().toString(),
//           duration: data.duration,
//           time: new Date().toLocaleString(),
//         };

//         setLogs(prev => {
//           const updated = [log, ...prev];
//           AsyncStorage.setItem("logs", JSON.stringify(updated));
//           return updated;
//         });
//       }
//     });

//     return () => {
//       subscription.remove();
//       CallDetector.stopListening?.();
//     };
//   }, []);

//   const requestPermissions = async () => {
//     await PermissionsAndroid.requestMultiple([
//       PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
//       PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
//       PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
//     ]);
//   };

//   const loadLogs = async () => {
//     const saved = await AsyncStorage.getItem("logs");
//     if (saved) setLogs(JSON.parse(saved));
//   };

//   return (
//     <View style={styles.container}>
//       <Text style={styles.title}>📞 Call History</Text>
//       <FlatList
//         data={logs}
//         keyExtractor={item => item.id}
//         renderItem={({ item }) => (
//           <Text style={styles.logItem}>⏱ {item.duration}s — {item.time}</Text>
//         )}
//       />
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: { padding: 20 },
//   title: { fontSize: 22, fontWeight: "bold" },
//   logItem: { marginTop: 10 },
// });
