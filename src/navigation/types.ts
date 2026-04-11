import type { ScanItem } from "../types/note";
import type { NavigatorScreenParams } from "@react-navigation/native";

export type ScanStackParamList = {
  ScanCamera: undefined;
  StreakDetails: undefined;
  Processing: { imageUri: string };
  Results: { item: ScanItem };
};

export type LibraryStackParamList = {
  LibraryHome: undefined;
  BookReports: { bookId: string };
  ReportDetails: { item: ScanItem; highlightQuery?: string };
};

export type ProfileStackParamList = {
  ProfileHome: undefined;
  Appearance: undefined;
  Themes: undefined;
  StudyPreferences: undefined;
  AppBehavior: undefined;
  ExportSettings: undefined;
  ReadingReminders: undefined;
};

export type RootTabParamList = {
  ScanFlow: NavigatorScreenParams<ScanStackParamList>;
  Library: NavigatorScreenParams<LibraryStackParamList>;
  Profile: NavigatorScreenParams<ProfileStackParamList>;
};
