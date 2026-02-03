import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

type Props = { phone?: string };

export default function DialerScreen({ phone = "" }: Props) {
  const [dialNumber, setDialNumber] = useState(phone);
  const MAX_NUMBER_LENGTH = 18;

  const handleKeyPress = (key: string) => setDialNumber(prev => (prev.length >= MAX_NUMBER_LENGTH ? prev : prev + key));
  const handleBackspace = () => setDialNumber(prev => prev.slice(0, -1));

  const makeCall = async () => {
    if (!dialNumber) return;
    const url = `tel:${dialNumber}`;
    Linking.canOpenURL(url).then(supported => supported && Linking.openURL(url));

    // Save immediately with duration 0
    try {
      const saved = await AsyncStorage.getItem("logs");
      const logs = saved ? JSON.parse(saved) : [];
      logs.unshift({
        id: Date.now().toString(),
        number: dialNumber,
        duration: 0,
        time: new Date().toLocaleString(),
      });
      await AsyncStorage.setItem("logs", JSON.stringify(logs));
    } catch (e) {
      console.warn("Failed to save call log:", e);
    }

    setDialNumber("");
  };

  const keypad = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["*", "0", "#"],
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.dialerNumber}>{dialNumber || "Enter number"}</Text>
      {keypad.map((row, idx) => (
        <View key={idx} style={styles.keyRow}>
          {row.map(key => (
            <TouchableOpacity key={key} style={styles.key} onPress={() => handleKeyPress(key)}>
              <Text style={styles.keyText}>{key}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
      <View style={styles.keyRow}>
        <TouchableOpacity style={styles.key} onPress={handleBackspace}>
          <Text style={styles.keyText}>⌫</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.key, styles.callKey]} onPress={makeCall}>
          <Text style={styles.keyText}>📞</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 16 },
  dialerNumber: { fontSize: 32, fontWeight: "700", marginBottom: 20, color: "#2f3640" },
  keyRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: 15 },
  key: { flex: 1, marginHorizontal: 5, paddingVertical: 20, borderRadius: 12, backgroundColor: "#fff", justifyContent: "center", alignItems: "center" },
  callKey: { backgroundColor: "#44bd32" },
  keyText: { fontSize: 20, fontWeight: "700", color: "#2f3640" },
});
