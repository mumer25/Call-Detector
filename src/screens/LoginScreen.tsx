import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";

import { saveLoggedInUser } from "../db/database"; // adjust path

type LoginScreenProps = {
  onLoginSuccess: () => void;
};

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert("Error", "Please enter username and password.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "https://server103.multi-techno.com:8383/ords/ard_holdings/crm_app/get_authentication",
        {
          method: "GET",
          headers: {
            "XUSERNAME": username,
            "XPASSWORD": password,
            "Accept": "application/json",
          },
        }
      );

      const text = await response.text();
      console.log("Raw API Response:", text);

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Invalid server response (not JSON).");
      }

      const userData =
        data?.items && data.items.length > 0 ? data.items[0] : null;

      if (userData?.entity_id) {
        // Save to SQLite
        await saveLoggedInUser(userData.entity_id.toString(), userData.user_name);
        Alert.alert("Login Successful", `Welcome ${userData.user_name}`);
        onLoginSuccess();
      } else {
        Alert.alert("Login Failed", "Invalid username or password.");
      }
    } catch (error: any) {
      console.error("Login Error:", error.message);
      Alert.alert("Login Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.innerContainer}>
        <Text style={styles.title}>Login to CRM</Text>

        <TextInput
          style={styles.input}
          placeholder="Username"
          value={username}
          autoCapitalize="characters"
          onChangeText={setUsername}
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          secureTextEntry
          onChangeText={setPassword}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0e1e2b",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  innerContainer: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#1f2f3f",
    padding: 30,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 30,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#ffffff",
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#1abc9c",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});



// import React, { useState } from "react";
// import {
//   View,
//   Text,
//   TextInput,
//   TouchableOpacity,
//   StyleSheet,
//   KeyboardAvoidingView,
//   Platform,
//   Alert,
// } from "react-native";

// type LoginScreenProps = {
//   onLoginSuccess: () => void;
// };

// const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
//   const [username, setUsername] = useState("");
//   const [password, setPassword] = useState("");

//   const handleLogin = () => {
//     if (!username || !password) {
//       Alert.alert("Error", "Please enter username and password.");
//       return;
//     }

//     // Temporary simple check (replace with DB later)
//     if (username === "admin" && password === "1234") {
//       onLoginSuccess();
//     } else {
//       Alert.alert("Login Failed", "Invalid username or password.");
//     }
//   };

//   return (
//     <KeyboardAvoidingView
//       style={styles.container}
//       behavior={Platform.OS === "ios" ? "padding" : undefined}
//     >
//       <View style={styles.innerContainer}>
//         <Text style={styles.title}>Login to CRM</Text>

//         <TextInput
//           style={styles.input}
//           placeholder="Username"
//           value={username}
//           autoCapitalize="none"
//           onChangeText={setUsername}
//         />

//         <TextInput
//           style={styles.input}
//           placeholder="Password"
//           value={password}
//           secureTextEntry
//           onChangeText={setPassword}
//         />

//         <TouchableOpacity style={styles.button} onPress={handleLogin}>
//           <Text style={styles.buttonText}>Login</Text>
//         </TouchableOpacity>
//       </View>
//     </KeyboardAvoidingView>
//   );
// };

// export default LoginScreen;

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: "#0e1e2b",
//     justifyContent: "center",
//     alignItems: "center",
//     paddingHorizontal: 20,
//   },
//   innerContainer: {
//     width: "100%",
//     maxWidth: 400,
//     backgroundColor: "#1f2f3f",
//     padding: 30,
//     borderRadius: 12,
//     shadowColor: "#000",
//     shadowOpacity: 0.25,
//     shadowOffset: { width: 0, height: 4 },
//     shadowRadius: 8,
//     elevation: 6,
//   },
//   title: {
//     fontSize: 28,
//     fontWeight: "700",
//     color: "#ffffff",
//     marginBottom: 30,
//     textAlign: "center",
//   },
//   input: {
//     backgroundColor: "#ffffff",
//     paddingVertical: 12,
//     paddingHorizontal: 15,
//     borderRadius: 8,
//     fontSize: 16,
//     marginBottom: 20,
//   },
//   button: {
//     backgroundColor: "#1abc9c",
//     paddingVertical: 14,
//     borderRadius: 8,
//     alignItems: "center",
//   },
//   buttonText: {
//     color: "#ffffff",
//     fontSize: 18,
//     fontWeight: "700",
//   },
// });
