import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Dimensions } from "react-native";

const { width } = Dimensions.get("window");

type SplashScreenProps = {
  onFinish: () => void;
};

const BAR_COLORS = ["#1abc9c", "#3498db", "#f1c40f"];

const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const slideBars = useRef(new Animated.Value(-width)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 1,
        duration: 2000, // slower scale
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 2000, // slower fade in
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(500), // slight delay
        Animated.timing(slideBars, {
          toValue: 0,
          duration: 2000, // slower slide
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    const timer = setTimeout(() => {
      onFinish();
    }, 4000); // splash stays longer

    return () => clearTimeout(timer);
  }, [onFinish, scale, opacity, slideBars]);

  return (
    <View style={styles.container}>
      {/* Animated CRM Text */}
      <Animated.View
        style={[
          styles.crmTextContainer,
          { transform: [{ scale }], opacity },
        ]}
      >
        <Animated.Text style={styles.crmText}>CRM</Animated.Text>
      </Animated.View>

      {/* Animated sliding bars */}
      {BAR_COLORS.map((color, index) => (
        <Animated.View
          key={index}
          style={[
            styles.bar,
            { backgroundColor: color, transform: [{ translateX: slideBars }] },
          ]}
        />
      ))}

      {/* Animated Subtitle */}
      <Animated.View style={[styles.subtitleContainer, { opacity }]}>
        <Animated.Text style={styles.subtitle}>
          Customer Relationship Manager
        </Animated.Text>
      </Animated.View>
    </View>
  );
};

export default SplashScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0e1e2b",
    alignItems: "center",
    justifyContent: "center",
  },
  crmTextContainer: {
    marginBottom: 20,
  },
  crmText: {
    fontSize: 60,
    fontWeight: "bold",
    color: "#ffffff",
    letterSpacing: 4,
  },
  bar: {
    width: 60,
    height: 8,
    marginVertical: 6,
    borderRadius: 4,
  },
  subtitleContainer: {
    marginTop: 40,
  },
  subtitle: {
    fontSize: 16,
    color: "#bdc3c7",
    letterSpacing: 1,
  },
});




// import React, { useEffect, useRef } from "react";
// import { View, StyleSheet, Animated, Dimensions } from "react-native";

// const { width } = Dimensions.get("window");

// type SplashScreenProps = {
//   onFinish: () => void;
// };

// const BAR_COLORS = ["#1abc9c", "#3498db", "#f1c40f"];

// const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
//   const scale = useRef(new Animated.Value(0)).current;
//   const opacity = useRef(new Animated.Value(0)).current;
//   const slideBars = useRef(new Animated.Value(-width)).current;

//   useEffect(() => {
//     Animated.parallel([
//       Animated.timing(scale, {
//         toValue: 1,
//         duration: 1200,
//         useNativeDriver: true,
//       }),
//       Animated.timing(opacity, {
//         toValue: 1,
//         duration: 1200,
//         useNativeDriver: true,
//       }),
//       Animated.sequence([
//         Animated.delay(400),
//         Animated.timing(slideBars, {
//           toValue: 0,
//           duration: 1000,
//           useNativeDriver: true,
//         }),
//       ]),
//     ]).start();

//     const timer = setTimeout(() => {
//       onFinish();
//     }, 2500);

//     return () => clearTimeout(timer);
//   }, [onFinish, scale, opacity, slideBars]);

//   return (
//     <View style={styles.container}>
//       {/* Animated CRM Text */}
//       <Animated.View
//         style={[
//           styles.crmTextContainer,
//           { transform: [{ scale }], opacity },
//         ]}
//       >
//         <View style={styles.crmTextWrapper}>
//           <Animated.Text style={styles.crmText}>CRM</Animated.Text>
//         </View>
//       </Animated.View>

//       {/* Animated sliding bars */}
//       {BAR_COLORS.map((color, index) => (
//         <Animated.View
//           key={index}
//           style={[styles.bar, { backgroundColor: color, transform: [{ translateX: slideBars }] }]}
//         />
//       ))}

//       {/* Animated Subtitle */}
//       <Animated.View style={[styles.subtitleContainer, { opacity }]}>
//         <Animated.Text style={styles.subtitle}>
//           Customer Relationship Manager
//         </Animated.Text>
//       </Animated.View>
//     </View>
//   );
// };

// export default SplashScreen;

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: "#0e1e2b",
//     alignItems: "center",
//     justifyContent: "center",
//   },
//   crmTextContainer: {
//     marginBottom: 20,
//   },
//   crmTextWrapper: {},
//   crmText: {
//     fontSize: 60,
//     fontWeight: "bold",
//     color: "#ffffff",
//     letterSpacing: 4,
//   },
//   bar: {
//     width: 60,
//     height: 8,
//     marginVertical: 6,
//     borderRadius: 4,
//   },
//   subtitleContainer: {
//     marginTop: 40,
//   },
//   subtitle: {
//     fontSize: 16,
//     color: "#bdc3c7",
//     letterSpacing: 1,
//   },
// });
