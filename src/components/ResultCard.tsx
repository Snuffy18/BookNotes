import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

export function ResultCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.resultCard}>
      <Text style={styles.resultTitle}>{title}</Text>
      <Text style={styles.resultText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  resultCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    gap: 6,
  },
  resultTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
  },
  resultText: {
    color: "#334155",
    lineHeight: 21,
  },
});
