import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.meuapp.android",
  appName: "Prontuário Enfermagem",
  webDir: "out",
  server: {
    androidScheme: "https",
  },
  plugins: {
    SafeArea: {
      enabled: true,
      customColorsForSystemBars: true,
      statusBarColor: "#00000000",
      statusBarContent: "dark",
      navigationBarColor: "#00000000",
      navigationBarContent: "dark",
    },
    CapacitorSQLite: {
      androidIsEncryption: false,
    },
    SplashScreen: {
      backgroundColor: "#ffffff",
    },
    LocalNotifications: {
      iconColor: "#0f766e",
    },
  },
};

export default config;
