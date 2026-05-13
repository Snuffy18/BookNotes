import type { ScanItem } from "../types/note";
import type { ExtractionMode } from "../types/note";
import type { NavigatorScreenParams } from "@react-navigation/native";
import type { StudyPreferencesSnapshot } from "../types/studyPreferences";

/** Where to return after re-extracting an existing report from Processing. */
export type RescanReturnTab = "library" | "scan";

export type CropPhotoRouteParams = {
  imageUri: string;
  page?: string;
  chapter?: string;
  purpose?: "page" | "bookCover" | "contents" | "libraryBookCover";
  contentsScanAppend?: boolean;
  bookId?: string;
};

export type ScanStackParamList = {
  ScanCamera:
    | {
        autoOpenCoverCamera?: boolean;
        bookCoverCropResultUri?: string;
        contentsCropResultUri?: string;
        contentsScanAppend?: boolean;
        openReadingTimer?: boolean;
      }
    | undefined;
  ReadingHistory: undefined;
  StreakDetails: undefined;
  CropPhoto: CropPhotoRouteParams;
  ExtractionOptions: {
    imageUri: string;
    page?: string;
    chapter?: string;
    /** Regenerate notes for this scan id instead of creating a new scan. */
    rescanForScanId?: string;
    /** Snapshot used for AI (defaults to global study prefs when omitted). */
    studyPreferences?: StudyPreferencesSnapshot;
    rescanReturnTab?: RescanReturnTab;
  };
  Processing: {
    imageUri: string;
    page?: string;
    chapter?: string;
    extractionMode?: ExtractionMode;
    extractionModes?: ExtractionMode[];
    rescanForScanId?: string;
    studyPreferences?: StudyPreferencesSnapshot;
    rescanReturnTab?: RescanReturnTab;
  };
  Results: { item: ScanItem };
  ReportDetails: { item: ScanItem; highlightQuery?: string; reportNavOrigin?: RescanReturnTab };
};

export type LibraryStackParamList = {
  LibraryHome: undefined;
  BookReports: { bookId: string };
  ReportDetails: { item: ScanItem; highlightQuery?: string; reportNavOrigin?: RescanReturnTab };
  CropPhoto: CropPhotoRouteParams;
};

export type ProfileStackParamList = {
  ProfileHome: undefined;
  Appearance: undefined;
  Themes: undefined;
  StudyPreferences: undefined;
  OutputLanguage: undefined;
  AppBehavior: undefined;
  ExportSettings: undefined;
  ReadingReminders: undefined;
};

export type RootTabParamList = {
  ScanFlow: NavigatorScreenParams<ScanStackParamList>;
  Library: NavigatorScreenParams<LibraryStackParamList>;
  Profile: NavigatorScreenParams<ProfileStackParamList>;
};
