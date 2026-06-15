import { StyleSheet, Text, View } from "react-native";
import { ArrowRight } from "./icons";
import {
  OptionCard,
  PrimaryButton,
  ProgressDots,
  ScreenShell,
} from "./primitives";
import { T } from "./theme";

type QuestionOption = {
  label: string;
  icon: React.ReactNode;
  bg: string;
  color: string;
};

type QuestionScreenProps = {
  step: number;
  title: string;
  options: QuestionOption[];
  selected: number | null;
  onSelect: (index: number) => void;
  onContinue: () => void;
};

export function QuestionScreen({
  step,
  title,
  options,
  selected,
  onSelect,
  onContinue,
}: QuestionScreenProps) {
  const hasSelection = selected != null;

  return (
    <ScreenShell screenKey={`q-${step}`}>
      <View style={styles.container}>
        <ProgressDots step={step} />
        <Text style={styles.title}>{title}</Text>

        <View style={styles.options}>
          {options.map((opt, i) => (
            <OptionCard
              key={opt.label}
              label={opt.label}
              icon={opt.icon}
              iconBg={opt.bg}
              selected={selected === i}
              onPress={() => onSelect(i)}
            />
          ))}
        </View>

        <View style={styles.spacer} />

        <PrimaryButton
          onPress={hasSelection ? onContinue : undefined}
          icon={<ArrowRight size={16} color="#111" />}
          style={{ opacity: hasSelection ? 1 : 0.35 }}
        >
          Continue
        </PrimaryButton>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 28,
    paddingBottom: 24,
  },
  title: {
    marginTop: 28,
    fontSize: 18,
    fontWeight: "600",
    color: T.white,
    textAlign: "center",
    letterSpacing: -0.3,
    lineHeight: 22.5,
    paddingHorizontal: 8,
  },
  options: {
    marginTop: 28,
    gap: 8,
  },
  spacer: {
    flex: 1,
  },
});
