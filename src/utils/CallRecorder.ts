import { NativeModules, NativeEventEmitter, Platform, PermissionsAndroid } from "react-native";
import { insertHistory } from "../db/database"; // SQLite helper

export type CallLog = {
  id: string;
  number: string;
  duration: number; // in seconds
  time: string; // call start time
  type: "incoming" | "outgoing" | "missed";
};

const { CallDetector } = NativeModules;
const emitter = new NativeEventEmitter(CallDetector);

// Track active calls
type ActiveCall = {
  startTime: number;
  type: "incoming" | "outgoing";
};
const activeCalls: Record<string, ActiveCall> = {};

// Normalize phone numbers to prevent duplicates
const normalizeNumber = (num: string) => num.replace(/\D/g, "");

export async function requestCallPermissions() {
  if (Platform.OS !== "android") return;

  await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
    PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
    PermissionsAndroid.PERMISSIONS.CALL_PHONE,
  ]);
}

export async function startCallListener() {
  if (Platform.OS !== "android") return;

  await requestCallPermissions();

  CallDetector.startListening?.();

  emitter.addListener(
    "CallEvent",
    async (data: { state: string; number?: string; type?: "INCOMING" | "OUTGOING" }) => {
      if (!data.number) return;
      const number = normalizeNumber(data.number);
      const now = Date.now();

      // --- Call started ---
      if (data.state === "Incoming" || data.state === "OffHook") {
        if (!activeCalls[number]) {
          activeCalls[number] = {
            startTime: now,
            type: data.type === "OUTGOING" ? "outgoing" : "incoming",
          };
        }
      }

      // --- Call ended ---
      if (data.state === "Disconnected") {
        const activeCall = activeCalls[number];
        let log: CallLog;

        if (!activeCall) {
          // Missed call (never picked up)
          log = {
            id: now.toString(),
            number,
            duration: 0,
            type: "missed",
            time: new Date(now).toLocaleString(),
          };
        } else {
          const durationSec = Math.floor((now - activeCall.startTime) / 1000);
          log = {
            id: now.toString(),
            number,
            duration: durationSec,
            type: durationSec > 0 ? activeCall.type : "missed",
            time: new Date(activeCall.startTime).toLocaleString(),
          };

          delete activeCalls[number]; // remove from active calls to prevent duplicates
        }

        // --- Save log to DB ---
        try {
          await insertHistory(null, log.number, log.time, log.duration, log.type);
        } catch (err) {
          console.error("Failed to save call log to DB", err);
        }
      }
    }
  );
}




// import { NativeModules, NativeEventEmitter, Platform, PermissionsAndroid } from "react-native";
// import { insertHistory } from "../db/database"; // <-- use your SQLite helper
// export type CallLog = {
//   id: string;
//   number: string;
//   duration: number; // in seconds
//   time: string; // call start time
//   type: "incoming" | "outgoing" | "missed";
// };

// const { CallDetector } = NativeModules;
// const emitter = new NativeEventEmitter(CallDetector);

// // Track active calls with start timestamp
// type ActiveCall = {
//   startTime: number; // timestamp in ms
//   type: "incoming" | "outgoing";
// };
// const activeCalls: Record<string, ActiveCall> = {};

// export async function requestCallPermissions() {
//   if (Platform.OS !== "android") return;

//   await PermissionsAndroid.requestMultiple([
//     PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
//     PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
//     PermissionsAndroid.PERMISSIONS.CALL_PHONE,
//   ]);
// }

// export async function startCallListener() {
//   if (Platform.OS !== "android") return;

//   await requestCallPermissions();

//   CallDetector.startListening?.();

//   emitter.addListener(
//     "CallEvent",
//     async (data: { state: string; number?: string; type?: "INCOMING" | "OUTGOING" }) => {
//       const number = data.number;
//       if (!number) return;

//       const now = Date.now();

//       // --- Call started ---
//       if (data.state === "Incoming" || data.state === "OffHook") {
//         if (!activeCalls[number]) {
//           activeCalls[number] = {
//             startTime: now,
//             type: data.type === "OUTGOING" ? "outgoing" : "incoming",
//           };
//         }
//       }

//       // --- Call ended ---
//       if (data.state === "Disconnected") {
//         const activeCall = activeCalls[number];
//         let log: CallLog;

//         if (!activeCall) {
//           // Missed call: no start recorded
//           log = {
//             id: now.toString(),
//             number,
//             duration: 0,
//             type: "missed",
//             time: new Date(now).toLocaleString(),
//           };
//         } else {
//           const durationSec = Math.floor((now - activeCall.startTime) / 1000);

//           // If duration is 0, mark as missed
//           if (durationSec <= 0) {
//             log = {
//               id: now.toString(),
//               number,
//               duration: 0,
//               type: "missed",
//               time: new Date(activeCall.startTime).toLocaleString(),
//             };
//           } else {
//             log = {
//               id: now.toString(),
//               number,
//               duration: durationSec,
//               type: activeCall.type,
//               time: new Date(activeCall.startTime).toLocaleString(),
//             };
//           }

//           delete activeCalls[number];
//         }

//         // --- Save log to SQLite instead of AsyncStorage ---
//         try {
//           // Here we pass lead_id as null, can be linked later
//           await insertHistory(null, log.number, log.time, log.duration, log.type);
//         } catch (err) {
//           console.error("Failed to save call log to DB", err);
//         }
//       }
//     }
//   );
// }



// import { NativeModules, NativeEventEmitter, Platform, PermissionsAndroid } from "react-native";
// import AsyncStorage from "@react-native-async-storage/async-storage";

// export type CallLog = {
//   id: string;
//   number: string;
//   duration: number; // in seconds
//   time: string; // call start time
//   type: "incoming" | "outgoing" | "missed";
// };

// const { CallDetector } = NativeModules;
// const emitter = new NativeEventEmitter(CallDetector);

// // Track active calls with start timestamp
// type ActiveCall = {
//   startTime: number; // timestamp in ms
//   type: "incoming" | "outgoing";
// };
// const activeCalls: Record<string, ActiveCall> = {};

// export async function requestCallPermissions() {
//   if (Platform.OS !== "android") return;

//   await PermissionsAndroid.requestMultiple([
//     PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
//     PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
//     PermissionsAndroid.PERMISSIONS.CALL_PHONE,
//   ]);
// }

// export async function startCallListener() {
//   if (Platform.OS !== "android") return;

//   await requestCallPermissions();

//   CallDetector.startListening?.();

//   emitter.addListener(
//     "CallEvent",
//     async (data: { state: string; number?: string; type?: "INCOMING" | "OUTGOING" }) => {
//       const number = data.number;
//       if (!number) return;

//       const now = Date.now();

//       // --- Call started ---
//       if (data.state === "Incoming" || data.state === "OffHook") {
//         // Only track if not already tracked
//         if (!activeCalls[number]) {
//           activeCalls[number] = {
//             startTime: now,
//             type: data.type === "OUTGOING" ? "outgoing" : "incoming",
//           };
//         }
//       }

//       // --- Call ended ---
//       if (data.state === "Disconnected") {
//         const activeCall = activeCalls[number];
//         let log: CallLog;

//         if (!activeCall) {
//           // Missed call: no start recorded
//           log = {
//             id: now.toString(),
//             number,
//             duration: 0,
//             type: "missed",
//             time: new Date(now).toLocaleString(),
//           };
//         } else {
//           const durationSec = Math.floor((now - activeCall.startTime) / 1000);

//           // If duration is 0, mark as missed
//           if (durationSec <= 0) {
//             log = {
//               id: now.toString(),
//               number,
//               duration: 0,
//               type: "missed",
//               time: new Date(activeCall.startTime).toLocaleString(),
//             };
//           } else {
//             log = {
//               id: now.toString(),
//               number,
//               duration: durationSec,
//               type: activeCall.type,
//               time: new Date(activeCall.startTime).toLocaleString(),
//             };
//           }

//           delete activeCalls[number];
//         }

//         // Save log to AsyncStorage
//         const saved = await AsyncStorage.getItem("logs");
//         const logs: CallLog[] = saved ? JSON.parse(saved) : [];
//         logs.unshift(log);
//         await AsyncStorage.setItem("logs", JSON.stringify(logs));
//       }
//     }
//   );
// }




// import { NativeModules, NativeEventEmitter, Platform, PermissionsAndroid } from "react-native";
// import AsyncStorage from "@react-native-async-storage/async-storage";

// export type CallLog = {
//   id: string;
//   number: string;
//   duration: number;
//   time: string;
//   type: "incoming" | "outgoing" | "missed";
// };

// const { CallDetector } = NativeModules;
// const emitter = new NativeEventEmitter(CallDetector);

// // Track active calls to prevent double logging
// const activeCalls: Record<string, boolean> = {};

// export async function requestCallPermissions() {
//   if (Platform.OS !== "android") return;

//   await PermissionsAndroid.requestMultiple([
//     PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
//     PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
//     PermissionsAndroid.PERMISSIONS.CALL_PHONE,
//   ]);
// }

// export async function startCallListener() {
//   if (Platform.OS !== "android") return;

//   await requestCallPermissions();

//   CallDetector.startListening?.();

//   emitter.addListener(
//     "CallEvent",
//     async (data: { state: string; number?: string; duration?: number; type?: "INCOMING" | "OUTGOING" }) => {
//       const number = data.number;
//       if (!number) return; // skip if no number

//       // Only log when the call is finished
//       if (data.state === "Disconnected") {
//         // Prevent double logging
//         if (activeCalls[number]) return;

//         const callType =
//           data.duration && data.duration > 0
//             ? data.type === "OUTGOING"
//               ? "outgoing"
//               : "incoming"
//             : "missed";

//         const log: CallLog = {
//           id: Date.now().toString(),
//           number,
//           duration: data.duration ?? 0,
//           type: callType,
//           time: new Date().toLocaleString(),
//         };

//         // Save log to AsyncStorage
//         const saved = await AsyncStorage.getItem("logs");
//         const logs: CallLog[] = saved ? JSON.parse(saved) : [];
//         logs.unshift(log);
//         await AsyncStorage.setItem("logs", JSON.stringify(logs));

//         // Mark this number as logged
//         activeCalls[number] = true;

//         // Remove after a short delay to allow future calls with same number
//         setTimeout(() => {
//           delete activeCalls[number];
//         }, 3000);
//       }
//     }
//   );
// }



// import { NativeModules, NativeEventEmitter, Platform, PermissionsAndroid } from "react-native";
// import AsyncStorage from "@react-native-async-storage/async-storage";

// export type CallLog = {
//   id: string;
//   number: string;
//   duration: number;
//   time: string;
//   type: "incoming" | "outgoing" | "missed";
// };

// const { CallDetector } = NativeModules;
// const emitter = new NativeEventEmitter(CallDetector);

// export async function requestCallPermissions() {
//   if (Platform.OS !== "android") return;

//   await PermissionsAndroid.requestMultiple([
//     PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
//     PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
//     PermissionsAndroid.PERMISSIONS.CALL_PHONE,
//   ]);
// }

// export async function startCallListener() {
//   if (Platform.OS !== "android") return;

//   await requestCallPermissions();

//   CallDetector.startListening?.();

//   emitter.addListener(
//     "CallEvent",
//     async (data: { state: string; number?: string; duration?: number; type?: "INCOMING" | "OUTGOING" }) => {
//       // Only proceed if number is defined
//       if (!data.number) return;

//       let log: CallLog | null = null;

//       if (data.state === "Incoming") {
//         // Log incoming call immediately
//         log = {
//           id: Date.now().toString(),
//           number: data.number,
//           duration: 0,
//           type: "incoming",
//           time: new Date().toLocaleString(),
//         };
//       } else if (data.state === "Disconnected") {
//         // Update or log call when it ends
//         const callType =
//           data.duration && data.duration > 0
//             ? data.type === "OUTGOING"
//               ? "outgoing"
//               : "incoming"
//             : "missed";

//         log = {
//           id: Date.now().toString(),
//           number: data.number,
//           duration: data.duration ?? 0,
//           type: callType,
//           time: new Date().toLocaleString(),
//         };
//       }

//       if (log) {
//         const saved = await AsyncStorage.getItem("logs");
//         const logs: CallLog[] = saved ? JSON.parse(saved) : [];
//         logs.unshift(log);
//         await AsyncStorage.setItem("logs", JSON.stringify(logs));
//       }
//     }
//   );
// }




// import { NativeModules, NativeEventEmitter, Platform } from "react-native";
// import AsyncStorage from "@react-native-async-storage/async-storage";

// export type CallLog = {
//   id: string;
//   number?: string;
//   duration: number;
//   time: string;
// };

// const { CallDetector } = NativeModules;
// const emitter = new NativeEventEmitter(CallDetector);

// export async function startCallListener() {
//   if (Platform.OS !== "android") return;

//   CallDetector.startListening?.();

//   emitter.addListener("CallEvent", async (data: { state: string; number?: string; duration?: number }) => {
//     if (data.state === "Disconnected" && data.duration) {
//       const log: CallLog = {
//         id: Date.now().toString(),
//         number: data.number,
//         duration: data.duration,
//         time: new Date().toLocaleString(),
//       };

//       const saved = await AsyncStorage.getItem("logs");
//       const logs: CallLog[] = saved ? JSON.parse(saved) : [];
//       logs.unshift(log);
//       await AsyncStorage.setItem("logs", JSON.stringify(logs));
//     }
//   });
// }
