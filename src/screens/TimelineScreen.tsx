import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

// Mock data based on your screenshot
const MOCK_LOGS = [
  { id: '1', title: 'Follow Up', time: '10:30 AM', date: '29.06.2019', icon: 'call' },
  { id: '2', title: 'Whatsapp', time: '11:37 AM', date: '28.06.2019', icon: 'logo-whatsapp' },
  { id: '3', title: 'Call', time: '11:30 AM', date: '28.06.2019', icon: 'time-outline' },
  { id: '4', title: 'Call', time: '10:35 AM', date: '28.06.2019', icon: 'call' },
];

export default function TimelineScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#3b5353" barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="menu" size={28} color="#fff" />
        <Text style={styles.headerTitle}>Neetin Agarwal</Text>
      </View>

      <ScrollView contentContainerStyle={styles.timelinePadding}>
        {MOCK_LOGS.map((item, index) => (
          <View key={item.id} style={styles.timelineRow}>
            
            {/* Left Column: Icon + Vertical Line */}
            <View style={styles.leftColumn}>
              {/* Vertical Line Connector */}
              {index !== MOCK_LOGS.length - 1 && <View style={styles.line} />}
              
              <View style={styles.iconContainer}>
                <Ionicons name={item.icon} size={24} color="#3b5353" />
              </View>
            </View>

            {/* Right Column: Content Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <View style={styles.timeRow}>
                <Ionicons name="time-outline" size={14} color="#666" />
                <Text style={styles.timeText}>{item.time} | {item.date}</Text>
              </View>
            </View>

          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#cbdada', // The light teal background
  },
  header: {
    height: 60,
    backgroundColor: '#3b5353', // Dark teal header
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '500',
    marginLeft: 15,
  },
  timelinePadding: {
    padding: 20,
    paddingTop: 40,
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: 40, // Space between logs
    minHeight: 80,
  },
  leftColumn: {
    alignItems: 'center',
    width: 60,
  },
  line: {
    position: 'absolute',
    top: 50, // Start from center of icon
    bottom: -40, // Stretch to next row
    width: 4,
    backgroundColor: '#3b5353',
    zIndex: 0,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    // Shadow
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 15,
    paddingHorizontal: 20,
    paddingVertical: 15,
    marginLeft: 10,
    justifyContent: 'center',
    elevation: 3,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 5,
    fontWeight: '500',
  },
});