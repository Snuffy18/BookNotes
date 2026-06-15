import { StyleSheet, Text, View } from "react-native";
import { QuestionScreen } from "./QuestionScreen";
import { ResultScreen } from "./ResultScreen";
import {
  Apple,
  ArrowRight,
  Bell,
  BookSingle,
  Books,
  Brain,
  Briefcase,
  Bulb,
  Camera,
  ChartBar,
  Clock,
  DeviceMobile,
  Feather,
  GoogleG,
  Heart,
  Mail,
  MoodSad,
  Pencil,
  Repeat,
  School,
  Sparkles,
  Stack,
  TrendingUp,
  Trophy,
  User,
  XIcon,
} from "./icons";
import {
  PrimaryButton,
  ScreenShell,
  SkipLink,
  Toggle,
  Wordmark,
  serifStyle,
} from "./primitives";
import { T } from "./theme";
import type { OnboardingScreenProps } from "./types";

export function ScreenWelcome({ next, skip }: Pick<OnboardingScreenProps, "next" | "skip">) {
  const features = [
    {
      icon: <Camera color={T.blue} size={17} />,
      bg: T.blueBg,
      title: "Scan pages as you read",
      desc: "AI does the rest in seconds",
    },
    {
      icon: <Sparkles color={T.purple} size={17} />,
      bg: T.purpleBg,
      title: "AI extracts what matters",
      desc: "Ideas, quotes and summaries",
    },
    {
      icon: <Books color={T.amber} size={17} />,
      bg: T.amberBg,
      title: "Build your knowledge library",
      desc: "Every book, searchable forever",
    },
  ];

  return (
    <ScreenShell screenKey="welcome">
      <View style={styles.welcomeContainer}>
        <View>
          <Wordmark />
          <Text style={styles.welcomeHeadline}>
            Read it.{"\n"}Scan it.{"\n"}Never forget it.
          </Text>
          <Text style={styles.welcomeSubtitle}>
            Scan any page you read and AI extracts the key ideas, quotes and summaries automatically.
          </Text>
        </View>

        <View style={styles.featureList}>
          {features.map((f) => (
            <View key={f.title} style={styles.featureRow}>
              <View style={[styles.featureIcon, { backgroundColor: f.bg }]}>{f.icon}</View>
              <View style={styles.featureTextCol}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <View>
          <PrimaryButton onPress={next} icon={<ArrowRight size={16} color="#111" />}>
            Get started
          </PrimaryButton>
          <View style={{ height: 4 }} />
          <SkipLink onPress={skip}>Skip for now</SkipLink>
        </View>
      </View>
    </ScreenShell>
  );
}

export function ScreenBooksPerYear({ state, set, next }: OnboardingScreenProps) {
  return (
    <QuestionScreen
      step={0}
      title="How many books do you read per year?"
      selected={state.q1}
      onSelect={(i) => set("q1", i)}
      onContinue={next}
      options={[
        { label: "1–2 books", icon: <BookSingle color={T.blue} size={16} />, bg: T.blueBg, color: T.blue },
        { label: "3–5 books", icon: <Books color={T.blue} size={16} />, bg: T.blueBg, color: T.blue },
        { label: "5–10 books", icon: <Stack color={T.blue} size={16} />, bg: T.blueBg, color: T.blue },
        { label: "10+ books", icon: <Trophy color={T.blue} size={16} />, bg: T.blueBg, color: T.blue },
      ]}
    />
  );
}

export function ScreenChallenge({ state, set, next }: OnboardingScreenProps) {
  return (
    <QuestionScreen
      step={1}
      title="What's your biggest challenge with reading?"
      selected={state.q2}
      onSelect={(i) => set("q2", i)}
      onContinue={next}
      options={[
        { label: "Forgetting what I read", icon: <Brain color={T.purple} size={16} />, bg: T.purpleBg, color: T.purple },
        { label: "Finding time", icon: <Clock color={T.purple} size={16} />, bg: T.purpleBg, color: T.purple },
        { label: "Staying consistent", icon: <Repeat color={T.purple} size={16} />, bg: T.purpleBg, color: T.purple },
        { label: "Taking notes", icon: <Pencil color={T.purple} size={16} />, bg: T.purpleBg, color: T.purple },
      ]}
    />
  );
}

export function ScreenWhy({ state, set, next }: OnboardingScreenProps) {
  return (
    <QuestionScreen
      step={2}
      title="Why do you read?"
      selected={state.q3}
      onSelect={(i) => set("q3", i)}
      onContinue={next}
      options={[
        { label: "Self-improvement", icon: <TrendingUp color={T.green} size={16} />, bg: T.greenBg, color: T.green },
        { label: "Career growth", icon: <Briefcase color={T.green} size={16} />, bg: T.greenBg, color: T.green },
        { label: "Curiosity", icon: <Bulb color={T.green} size={16} />, bg: T.greenBg, color: T.green },
        { label: "Entertainment", icon: <Heart color={T.green} size={16} />, bg: T.greenBg, color: T.green },
      ]}
    />
  );
}

export function ScreenNotes({ state, set, next }: OnboardingScreenProps) {
  return (
    <QuestionScreen
      step={3}
      title="How do you currently take notes?"
      selected={state.q4}
      onSelect={(i) => set("q4", i)}
      onContinue={next}
      options={[
        { label: "I don't", icon: <XIcon color={T.amber} size={16} />, bg: T.amberBg, color: T.amber },
        { label: "Pen and paper", icon: <Pencil color={T.amber} size={16} />, bg: T.amberBg, color: T.amber },
        { label: "Phone notes", icon: <DeviceMobile color={T.amber} size={16} />, bg: T.amberBg, color: T.amber },
        { label: "Nothing works", icon: <MoodSad color={T.amber} size={16} />, bg: T.amberBg, color: T.amber },
      ]}
    />
  );
}

export function ScreenBookType({ state, set, next }: OnboardingScreenProps) {
  return (
    <QuestionScreen
      step={4}
      title="What do you mostly read?"
      selected={state.q5}
      onSelect={(i) => set("q5", i)}
      onContinue={next}
      options={[
        { label: "Non-fiction", icon: <School color={T.blue} size={16} />, bg: T.blueBg, color: T.blue },
        { label: "Fiction", icon: <Feather color={T.blue} size={16} />, bg: T.blueBg, color: T.blue },
        { label: "Self-help", icon: <User color={T.blue} size={16} />, bg: T.blueBg, color: T.blue },
        { label: "Business", icon: <ChartBar color={T.blue} size={16} />, bg: T.blueBg, color: T.blue },
      ]}
    />
  );
}

export function ScreenSummary({ state, next }: OnboardingScreenProps) {
  const Q1 = ["1–2 books", "3–5 books", "5–10 books", "10+ books"];
  const Q2 = ["Forgetting what I read", "Finding time", "Staying consistent", "Taking notes"];
  const Q3 = ["Self-improvement", "Career growth", "Curiosity", "Entertainment"];
  const Q5 = ["Non-fiction", "Fiction", "Self-help", "Business"];

  const rows = [
    { icon: <Books color={T.blue} size={15} />, bg: T.blueBg, label: "Reading goal", value: Q1[state.q1 ?? -1] || "—" },
    { icon: <Brain color={T.purple} size={15} />, bg: T.purpleBg, label: "Biggest challenge", value: Q2[state.q2 ?? -1] || "—" },
    { icon: <TrendingUp color={T.green} size={15} />, bg: T.greenBg, label: "Reading for", value: Q3[state.q3 ?? -1] || "—" },
    { icon: <School color={T.blue} size={15} />, bg: T.blueBg, label: "Favourite genre", value: Q5[state.q5 ?? -1] || "—" },
  ];

  const goal = Q1[state.q1 ?? -1] || "few books";
  const quote = `BookNotes will help you retain more from the ${goal.toLowerCase()} you read this year — automatically.`;

  return (
    <ScreenShell screenKey="summary">
      <View style={styles.summaryContainer}>
        <View style={styles.summaryHeader}>
          <View style={styles.summaryIconWrap}>
            <Sparkles size={22} color={T.white} />
          </View>
          <Text style={styles.summaryTitle}>BookNotes is ready for you</Text>
          <Text style={styles.summarySubtitle}>Based on your answers</Text>
        </View>

        <View style={styles.summaryCard}>
          {rows.map((r, i) => (
            <View
              key={r.label}
              style={[styles.summaryRow, i < rows.length - 1 && styles.summaryRowBorder]}
            >
              <View style={[styles.summaryRowIcon, { backgroundColor: r.bg }]}>{r.icon}</View>
              <View style={styles.summaryRowText}>
                <Text style={styles.summaryRowLabel}>{r.label}</Text>
                <Text style={styles.summaryRowValue} numberOfLines={1}>
                  {r.value}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.quoteCard}>
          <Text style={styles.quoteText}>{quote}</Text>
        </View>

        <View style={styles.spacer} />

        <PrimaryButton onPress={next} icon={<ArrowRight size={16} color="#111" />}>
          Set up reminders
        </PrimaryButton>
      </View>
    </ScreenShell>
  );
}

export function ScreenNotifications({ state, set, next, skip }: OnboardingScreenProps) {
  const toggles = state.toggles;
  const items = [
    { key: "morning" as const, label: "Morning reminder", subtitle: "08:30  ·  Daily" },
    { key: "evening" as const, label: "Evening reminder", subtitle: "21:00  ·  Daily" },
    { key: "weekly" as const, label: "Weekly digest", subtitle: "Sundays  ·  Summary of the week" },
  ];

  return (
    <ScreenShell screenKey="notifications">
      <View style={styles.notificationsContainer}>
        <View style={styles.notificationsHeader}>
          <View style={[styles.summaryIconWrap, { backgroundColor: T.amberBg }]}>
            <Bell size={22} color={T.amber} />
          </View>
          <Text style={styles.summaryTitle}>Reading reminders</Text>
          <Text style={styles.notificationsSubtitle}>
            Readers with daily reminders finish 2× more books. Set yours now.
          </Text>
        </View>

        <View style={styles.toggleList}>
          {items.map((it) => (
            <View key={it.key} style={styles.toggleRow}>
              <View style={styles.toggleTextCol}>
                <Text style={styles.toggleLabel}>{it.label}</Text>
                <Text style={styles.toggleSubtitle}>{it.subtitle}</Text>
              </View>
              <Toggle
                on={toggles[it.key]}
                onPress={() => set("toggles", { ...toggles, [it.key]: !toggles[it.key] })}
              />
            </View>
          ))}
        </View>

        <Text style={styles.settingsHint}>You can change these anytime in Settings</Text>

        <View style={styles.spacer} />

        <PrimaryButton onPress={next}>Create account</PrimaryButton>
        <View style={{ height: 4 }} />
        <SkipLink onPress={skip}>Skip reminders</SkipLink>
      </View>
    </ScreenShell>
  );
}

export function ScreenSignUp({ next }: Pick<OnboardingScreenProps, "next">) {
  return (
    <ScreenShell screenKey="signup">
      <View style={styles.signupContainer}>
        <View style={styles.signupHeader}>
          <Wordmark opacity={0.35} />
          <Text style={styles.signupTitle}>Create your account</Text>
          <Text style={styles.signupSubtitle}>Your reading journey starts here</Text>
        </View>

        <View style={styles.spacer} />

        <View style={styles.signupButtons}>
          <PrimaryButton onPress={next}>
            <View style={styles.signupButtonInner}>
              <Mail size={15} color="#111" />
              <Text style={styles.signupButtonText}>Continue with email</Text>
            </View>
          </PrimaryButton>

          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>or</Text>
            <View style={styles.orLine} />
          </View>

          <PrimaryButton variant="ghost" onPress={next}>
            <View style={styles.signupButtonInner}>
              <GoogleG size={15} />
              <Text style={styles.signupButtonTextGhost}>Continue with Google</Text>
            </View>
          </PrimaryButton>

          <PrimaryButton variant="ghost" onPress={next}>
            <View style={styles.signupButtonInner}>
              <Apple size={15} color="#fff" />
              <Text style={styles.signupButtonTextGhost}>Continue with Apple</Text>
            </View>
          </PrimaryButton>
        </View>

        <Text style={styles.legalText}>
          By continuing you agree to our Terms of Service and Privacy Policy.
        </Text>

        <Text style={styles.signInText}>
          Already have an account? <Text style={styles.signInLink}>Sign in</Text>
        </Text>
      </View>
    </ScreenShell>
  );
}

export function ResultBooks({ state, next }: OnboardingScreenProps) {
  const Q1 = ["1–2 books", "3–5 books", "5–10 books", "10+ books"];
  const answer = Q1[state.q1 ?? -1] || "—";
  return (
    <ResultScreen
      screenKey="r-books"
      stat="40%"
      label="more books finished"
      explanation="40% more books finished by readers who actively take notes on what they read."
      personalized={`You read ${answer} per year — imagine retaining the key ideas from every single one.`}
      onContinue={next}
    />
  );
}

export function ResultChallenge({ state, next }: OnboardingScreenProps) {
  const Q2 = ["forgetting what you read", "finding time", "staying consistent", "taking notes"];
  const answer = Q2[state.q2 ?? -1] || "this";
  return (
    <ResultScreen
      screenKey="r-challenge"
      stat="83%"
      label="forget within a week"
      explanation="83% of readers forget most of a book within a week of finishing it — BookNotes fixes that."
      personalized={`You said ${answer} is your biggest struggle — BookNotes was built exactly for this.`}
      onContinue={next}
    />
  );
}

export function ResultWhy({ state, next }: OnboardingScreenProps) {
  const Q3 = ["self-improvement", "career growth", "curiosity", "entertainment"];
  const answer = Q3[state.q3 ?? -1] || "meaning";
  return (
    <ResultScreen
      screenKey="r-why"
      stat="3×"
      label="more retained"
      explanation="3× more retained from every book by BookNotes users compared to passive readers."
      personalized={`Reading for ${answer} means every idea you retain has real impact on your life.`}
      onContinue={next}
    />
  );
}

export function ResultNotes({ state, next }: OnboardingScreenProps) {
  const Q4 = ["don't take notes", "use pen and paper", "jot in phone notes", "haven't found a system that works"];
  const answer = Q4[state.q4 ?? -1] || "wing it";
  return (
    <ResultScreen
      screenKey="r-notes"
      stat="70%"
      label="more likely to apply"
      explanation="70% more likely to apply what they've learned — readers who review their notes regularly."
      personalized={`Most people who ${answer} still lose most of what they read. BookNotes changes that.`}
      onContinue={next}
    />
  );
}

export function ResultBookType({ state, next }: OnboardingScreenProps) {
  const Q5 = ["Non-fiction", "Fiction", "Self-help", "Business"];
  const answer = Q5[state.q5 ?? -1] || "your";
  return (
    <ResultScreen
      screenKey="r-booktype"
      stat={`Your ${answer.toLowerCase()} library`}
      statSize={32}
      label="is being tailored"
      explanation="BookNotes is tailoring your experience based on your reading style and goals."
      personalized={`BookNotes is tailoring your experience for ${answer.toLowerCase()} readers. Your AI assistant is ready.`}
      onContinue={next}
    />
  );
}

const styles = StyleSheet.create({
  welcomeContainer: {
    flex: 1,
    justifyContent: "space-between",
    paddingTop: 48,
    paddingBottom: 32,
  },
  welcomeHeadline: {
    marginTop: 14,
    ...serifStyle,
    fontSize: 28,
    fontWeight: "400",
    color: T.white,
    letterSpacing: -0.56,
    lineHeight: 32.2,
  },
  welcomeSubtitle: {
    marginTop: 14,
    fontSize: 14,
    color: T.w45,
    lineHeight: 22.4,
    letterSpacing: -0.05,
    maxWidth: 280,
  },
  featureList: {
    gap: 20,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  featureTextCol: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 12,
    fontWeight: "500",
    color: T.white,
    letterSpacing: -0.1,
  },
  featureDesc: {
    fontSize: 11,
    color: T.w40,
    marginTop: 2,
    letterSpacing: -0.05,
  },
  spacer: {
    flex: 1,
  },
  summaryContainer: {
    flex: 1,
    paddingTop: 36,
    paddingBottom: 24,
  },
  summaryHeader: {
    alignItems: "center",
  },
  summaryIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: T.w08,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryTitle: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: "600",
    color: T.white,
    letterSpacing: -0.2,
  },
  summarySubtitle: {
    marginTop: 4,
    fontSize: 11,
    color: T.w45,
  },
  summaryCard: {
    marginTop: 20,
    backgroundColor: T.w05,
    borderWidth: 0.5,
    borderColor: T.w10,
    borderRadius: 14,
    padding: 14,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  summaryRowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(255,255,255,0.07)",
  },
  summaryRowIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  summaryRowText: {
    flex: 1,
    minWidth: 0,
  },
  summaryRowLabel: {
    fontSize: 11,
    color: T.w45,
    marginBottom: 1,
  },
  summaryRowValue: {
    fontSize: 12,
    fontWeight: "500",
    color: T.white,
    letterSpacing: -0.1,
  },
  quoteCard: {
    marginTop: 12,
    backgroundColor: T.w04,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.07)",
    borderRadius: 12,
    padding: 12,
  },
  quoteText: {
    ...serifStyle,
    fontStyle: "italic",
    fontSize: 13,
    color: T.w60,
    lineHeight: 20.15,
  },
  notificationsContainer: {
    flex: 1,
    paddingTop: 36,
    paddingBottom: 24,
  },
  notificationsHeader: {
    alignItems: "center",
  },
  notificationsSubtitle: {
    marginTop: 6,
    paddingHorizontal: 24,
    fontSize: 11,
    color: T.w45,
    lineHeight: 16.5,
    textAlign: "center",
    maxWidth: 280,
  },
  toggleList: {
    marginTop: 22,
    gap: 8,
  },
  toggleRow: {
    backgroundColor: T.w05,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  toggleTextCol: {
    flex: 1,
    minWidth: 0,
  },
  toggleLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: T.white,
    letterSpacing: -0.1,
  },
  toggleSubtitle: {
    fontSize: 10,
    color: T.w45,
    marginTop: 2,
  },
  settingsHint: {
    marginTop: 12,
    marginBottom: 12,
    fontSize: 11,
    color: T.w30,
    textAlign: "center",
  },
  signupContainer: {
    flex: 1,
    paddingTop: 40,
    paddingBottom: 24,
  },
  signupHeader: {
    alignItems: "center",
  },
  signupTitle: {
    marginTop: 14,
    fontSize: 18,
    fontWeight: "600",
    color: T.white,
    letterSpacing: -0.3,
  },
  signupSubtitle: {
    marginTop: 6,
    fontSize: 11,
    color: T.w45,
  },
  signupButtons: {
    gap: 8,
  },
  signupButtonInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  signupButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111",
    letterSpacing: -0.1,
  },
  signupButtonTextGhost: {
    fontSize: 14,
    fontWeight: "600",
    color: T.white,
    letterSpacing: -0.1,
  },
  orRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  orLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: T.w10,
  },
  orText: {
    fontSize: 11,
    color: T.w30,
    letterSpacing: 0.5,
  },
  legalText: {
    marginTop: 18,
    paddingHorizontal: 12,
    fontSize: 10,
    color: T.w20,
    textAlign: "center",
    lineHeight: 15,
  },
  signInText: {
    marginTop: 12,
    fontSize: 11,
    textAlign: "center",
    color: T.w35,
  },
  signInLink: {
    color: T.white,
    fontWeight: "500",
  },
});
