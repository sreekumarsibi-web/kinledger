import { registerRootComponent } from "expo";
import React from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text } from "react-native";

let startupError = null;
let AppComponent = null;

function formatError(error) {
  if (!error) return "Unknown startup error.";
  return `${error.message || String(error)}${error.stack ? `\n\n${error.stack}` : ""}`;
}

if (global.ErrorUtils?.setGlobalHandler) {
  const defaultHandler = global.ErrorUtils.getGlobalHandler?.();
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    startupError = error;
    if (defaultHandler) defaultHandler(error, isFatal);
  });
}

try {
  AppComponent = require("./App").default;
} catch (error) {
  startupError = error;
}

function StartupErrorScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brand}>KinLedger</Text>
        <Text style={styles.title}>Startup error</Text>
        <Text style={styles.body}>{formatError(startupError)}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      startupError = this.state.error;
      return <StartupErrorScreen />;
    }

    if (!AppComponent || startupError) {
      return <StartupErrorScreen />;
    }

    return <AppComponent />;
  }
}

function Root() {
  return (
    <ErrorBoundary>
      <AppComponent />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f4f5f0" },
  content: { padding: 18 },
  brand: { color: "#16201c", fontSize: 24, fontWeight: "900", marginBottom: 16 },
  title: { color: "#c64b3b", fontSize: 20, fontWeight: "900", marginBottom: 12 },
  body: { color: "#16201c", fontSize: 14, lineHeight: 20 }
});

registerRootComponent(Root);
