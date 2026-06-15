import { StyleSheet, Text, View } from "react-native";
import { ArrowRight } from "./icons";
import { PrimaryButton, ScreenShell, serifStyle } from "./primitives";
import { T } from "./theme";

type ResultScreenProps = {
  screenKey: string;
  stat: string;
  statSize?: number;
  label: string;
  explanation: string;
  personalized: string;
  onContinue: () => void;
};

export function ResultScreen({
  screenKey,
  stat,
  statSize = 48,
  label,
  explanation,
  personalized,
  onContinue,
}: ResultScreenProps) {
  return (
    <ScreenShell screenKey={screenKey} variant="slide">
      <View style={styles.container}>
        <View style={styles.center}>
          <View style={styles.aura} />
          <Text style={[styles.stat, { fontSize: statSize }]}>{stat}</Text>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.explanation}>{explanation}</Text>
          <Text style={styles.personalized}>{personalized}</Text>
        </View>

        <PrimaryButton onPress={onContinue} icon={<ArrowRight size={16} color="#111" />}>
          Continue
        </PrimaryButton>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: 32,
    paddingTop: 24,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  aura: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.03)",
    top: "28%",
    alignSelf: "center",
  },
  stat: {
    fontWeight: "700",
    color: T.white,
    letterSpacing: -1.44,
    lineHeight: 50,
    textAlign: "center",
    maxWidth: 320,
  },
  label: {
    marginTop: 10,
    fontSize: 13,
    color: T.w40,
    fontWeight: "500",
  },
  explanation: {
    marginTop: 22,
    fontSize: 14,
    color: "rgba(255,255,255,0.65)",
    lineHeight: 22.4,
    letterSpacing: -0.05,
    maxWidth: 260,
    textAlign: "center",
  },
  personalized: {
    marginTop: 18,
    ...serifStyle,
    fontStyle: "italic",
    fontSize: 13,
    color: T.w45,
    lineHeight: 20.15,
    maxWidth: 280,
    textAlign: "center",
    paddingHorizontal: 8,
  },
});
