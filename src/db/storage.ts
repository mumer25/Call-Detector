// src/db/storage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Lead } from "../screens/LeadsScreen";

const LEADS_KEY = "leads_data";

export const saveLeads = async (leads: Lead[]) => {
  try {
    await AsyncStorage.setItem(LEADS_KEY, JSON.stringify(leads));
  } catch (err) {
    console.error("Error saving leads:", err);
  }
};

export const loadLeads = async (): Promise<Lead[]> => {
  try {
    const saved = await AsyncStorage.getItem(LEADS_KEY);
    if (!saved) return [];
    return JSON.parse(saved);
  } catch (err) {
    console.error("Error loading leads:", err);
    return [];
  }
};
