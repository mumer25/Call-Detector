import { NativeModules, NativeEventEmitter, Platform, PermissionsAndroid } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type CallLog = {
  id: string;
  number: string;
  duration: number;
  time: string;
  type: "incoming" | "outgoing" | "missed";
};

const { CallDetector } = NativeModules;
const emitter = new NativeEventEmitter(CallDetector);

// Track active calls to prevent double logging
const activeCalls: Record<string, boolean> = {};

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
    async (data: { state: string; number?: string; duration?: number; type?: "INCOMING" | "OUTGOING" }) => {
      const number = data.number;
      if (!number) return; // skip if no number

      // Only log when the call is finished
      if (data.state === "Disconnected") {
        // Prevent double logging
        if (activeCalls[number]) return;

        const callType =
          data.duration && data.duration > 0
            ? data.type === "OUTGOING"
              ? "outgoing"
              : "incoming"
            : "missed";

        const log: CallLog = {
          id: Date.now().toString(),
          number,
          duration: data.duration ?? 0,
          type: callType,
          time: new Date().toLocaleString(),
        };

        // Save log to AsyncStorage
        const saved = await AsyncStorage.getItem("logs");
        const logs: CallLog[] = saved ? JSON.parse(saved) : [];
        logs.unshift(log);
        await AsyncStorage.setItem("logs", JSON.stringify(logs));

        // Mark this number as logged
        activeCalls[number] = true;

        // Remove after a short delay to allow future calls with same number
        setTimeout(() => {
          delete activeCalls[number];
        }, 3000);
      }
    }
  );
}



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
