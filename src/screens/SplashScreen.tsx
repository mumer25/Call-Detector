import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  StatusBar,
  Easing,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width } = Dimensions.get("window");

const SPLASH_SHOWN_KEY = "@crm_splash_shown";
const SPLASH_DURATION = 4000;

type SplashScreenProps = {
  onFinish: () => void;
};

const BAR_COLORS = ["#1abc9c", "#3498db", "#9b59b6"];

const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.6)).current;
  const logoTranslateY = useRef(new Animated.Value(30)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const barAnims = useRef(BAR_COLORS.map(() => new Animated.Value(0))).current;
  const dotAnim = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  // Store onFinish in a ref so it never triggers the effect to re-run
  const onFinishRef = useRef(onFinish);
  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    const animations = Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
        Animated.timing(logoTranslateY, {
          toValue: 0,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.stagger(
        150,
        barAnims.map((anim) =>
          Animated.timing(anim, {
            toValue: 1,
            duration: 500,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          })
        )
      ),
      Animated.timing(subtitleOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]);

    const loopAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(dotAnim, {
          toValue: 0,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    animations.start();
    loopAnimation.start();

    const exitTimer = setTimeout(() => {
      loopAnimation.stop();
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 600,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }).start(() => {
        onFinishRef.current();
      });
    }, SPLASH_DURATION);

    return () => {
      clearTimeout(exitTimer);
      animations.stop();
      loopAnimation.stop();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Animated.Value refs are stable — safe to omit

  return (
    <Animated.View style={[styles.container, { opacity: screenOpacity }]}>
      <StatusBar backgroundColor="#0d1b2a" barStyle="light-content" />
      <View style={styles.backgroundAccent} />

      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity,
            transform: [{ scale: logoScale }, { translateY: logoTranslateY }],
          },
        ]}
      >
        <View style={styles.logoBox}>
          <Animated.Text style={styles.crmText}>CRM</Animated.Text>
        </View>
      </Animated.View>

      <View style={styles.barsContainer}>
        {BAR_COLORS.map((color, index) => (
          <Animated.View
            key={index}
            style={[
              styles.bar,
              {
                backgroundColor: color,
                opacity: barAnims[index],
                transform: [
                  {
                    translateX: barAnims[index].interpolate({
                      inputRange: [0, 1],
                      outputRange: [-width * 0.5, 0],
                    }),
                  },
                  {
                    scaleX: barAnims[index].interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 1],
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
      </View>

      <Animated.Text style={[styles.subtitle, { opacity: subtitleOpacity }]}>
        Customer Relationship Manager
      </Animated.Text>

      <Animated.View
        style={[
          styles.loadingDot,
          {
            opacity: dotAnim,
            transform: [
              {
                scale: dotAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.6, 1.2],
                }),
              },
            ],
          },
        ]}
      />

      <Animated.Text style={[styles.version, { opacity: subtitleOpacity }]}>
        v1.0.0
      </Animated.Text>
    </Animated.View>
  );
};

// ─── Wrapper: shows splash only once per install ──────────────────────────────

type SplashGateProps = {
  children: React.ReactNode;
};

export const SplashGate: React.FC<SplashGateProps> = ({ children }) => {
  const [showSplash, setShowSplash] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const alreadyShown = await AsyncStorage.getItem(SPLASH_SHOWN_KEY);
        setShowSplash(!alreadyShown);
      } catch {
        setShowSplash(false);
      }
    })();
  }, []); // no deps needed — runs once on mount only

  const handleFinish = useCallback(async () => {
    try {
      await AsyncStorage.setItem(SPLASH_SHOWN_KEY, "true");
    } finally {
      setShowSplash(false);
    }
  }, []); // stable — setShowSplash from useState is guaranteed stable

  if (showSplash === null) return null;
  if (showSplash) return <SplashScreen onFinish={handleFinish} />;
  return <>{children}</>;
};

export default SplashScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d1b2a",
    alignItems: "center",
    justifyContent: "center",
  },
  backgroundAccent: {
    position: "absolute",
    width: width * 1.5,
    height: width * 1.5,
    borderRadius: width,
    backgroundColor: "#1a2f45",
    top: -width * 0.5,
    opacity: 0.5,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  logoBox: {
    width: 110,
    height: 110,
    borderRadius: 28,
    backgroundColor: "#1a2f45",
    borderWidth: 1.5,
    borderColor: "#1abc9c44",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1abc9c",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  crmText: {
    fontSize: 36,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: 6,
  },
  barsContainer: {
    alignItems: "flex-start",
    marginVertical: 20,
    gap: 10,
  },
  bar: {
    height: 5,
    borderRadius: 10,
    width: 80,
  },
  subtitle: {
    fontSize: 13,
    color: "#7f8fa6",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginTop: 8,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#1abc9c",
    marginTop: 48,
  },
  version: {
    position: "absolute",
    bottom: 40,
    fontSize: 11,
    color: "#3d5166",
    letterSpacing: 1,
  },
});

// import React, { useEffect, useRef } from "react";
// import { View, StyleSheet, Animated, Dimensions, Easing } from "react-native";

// const { width } = Dimensions.get("window");

// type SplashScreenProps = {
//   onFinish: () => void;
// };

// const BAR_COLORS = ["#1abc9c", "#3498db", "#f1c40f"];

// const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
//   const scale = useRef(new Animated.Value(0)).current;
//   const opacity = useRef(new Animated.Value(0)).current;
//   const slideBars = useRef(new Animated.Value(-width)).current;
//   const subtitleOpacity = useRef(new Animated.Value(0)).current;

//   useEffect(() => {
//     Animated.sequence([
//       // Step 1: Scale and fade in CRM text
//       Animated.parallel([
//         Animated.timing(scale, {
//           toValue: 1,
//           duration: 2500,
//           easing: Easing.out(Easing.exp),
//           useNativeDriver: true,
//         }),
//         Animated.timing(opacity, {
//           toValue: 1,
//           duration: 2500,
//           easing: Easing.out(Easing.exp),
//           useNativeDriver: true,
//         }),
//       ]),

//       // Step 2: Slide bars in
//       Animated.timing(slideBars, {
//         toValue: 0,
//         duration: 2500,
//         easing: Easing.out(Easing.exp),
//         useNativeDriver: true,
//       }),

//       // Step 3: Fade in subtitle
//       Animated.timing(subtitleOpacity, {
//         toValue: 1,
//         duration: 2500,
//         easing: Easing.out(Easing.exp),
//         useNativeDriver: true,
//       }),

//       // Optional delay before finishing
//       Animated.delay(3000),
//     ]).start(() => {
//       onFinish();
//     });
//   }, [onFinish, scale, opacity, slideBars, subtitleOpacity]);

//   return (
//     <View style={styles.container}>
//       {/* Animated CRM Text */}
//       <Animated.View
//         style={[styles.crmTextContainer, { transform: [{ scale }], opacity }]}
//       >
//         <Animated.Text style={styles.crmText}>CRM</Animated.Text>
//       </Animated.View>

//       {/* Animated sliding bars */}
//       {BAR_COLORS.map((color, index) => (
//         <Animated.View
//           key={index}
//           style={[
//             styles.bar,
//             { backgroundColor: color, transform: [{ translateX: slideBars }] },
//           ]}
//         />
//       ))}

//       {/* Animated Subtitle */}
//       <Animated.View style={[styles.subtitleContainer, { opacity: subtitleOpacity }]}>
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
//         duration: 2000, // slower scale
//         useNativeDriver: true,
//       }),
//       Animated.timing(opacity, {
//         toValue: 1,
//         duration: 2000, // slower fade in
//         useNativeDriver: true,
//       }),
//       Animated.sequence([
//         Animated.delay(500), // slight delay
//         Animated.timing(slideBars, {
//           toValue: 0,
//           duration: 2000, // slower slide
//           useNativeDriver: true,
//         }),
//       ]),
//     ]).start();

//     const timer = setTimeout(() => {
//       onFinish();
//     }, 5000); // splash stays longer

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
//         <Animated.Text style={styles.crmText}>CRM</Animated.Text>
//       </Animated.View>

//       {/* Animated sliding bars */}
//       {BAR_COLORS.map((color, index) => (
//         <Animated.View
//           key={index}
//           style={[
//             styles.bar,
//             { backgroundColor: color, transform: [{ translateX: slideBars }] },
//           ]}
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
