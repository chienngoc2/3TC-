export type {
  Coach,
  CoachAvailabilitySlot,
  CoachRateItem,
  CoachSpecialtyItem,
  DisciplineSectionData,
} from "./types/coach.types";
export type { Discipline as CoachDiscipline } from "./types/coach.types";
export { coachApiService } from "./services/coach-api.service";
export * from "./components/coach-card";
export * from "./components/coach-detail-modal";
export * from "./components/discipline-icon";
export * from "./pages/coaches-page";
export { default } from "./pages/coaches-page";

