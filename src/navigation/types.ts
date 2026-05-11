import type { ScanItem } from "../types/note";
import type { ExtractionMode } from "../types/note";
import type { NavigatorScreenParams } from "@react-navigation/native";

export type ScanStackParamList = {
  ScanCamera: { autoOpenCoverCamera?: boolean; bookCoverCropResultUri?: string } | undefined;
  ReadingHistory: undefined;
  StreakDetails: undefined;
  CropPhoto: { imageUri: string; page?: string; chapter?: string; purpose?: "page" | "bookCover" };
  ExtractionOptions: { imageUri: string; page?: string; chapter?: string };
  Processing: { imageUri: string; page?: string; chapter?: string; extractionMode?: ExtractionMode; extractionModes?: ExtractionMode[] };
  Results: { item: ScanItem };
  ReportDetails: { item: ScanItem; highlightQuery?: string };
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
