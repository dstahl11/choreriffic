export type KioskView = "today" | "week" | "calendar";

export function initialKioskView(view?: string): KioskView {
  return view === "today" || view === "week" ? view : "calendar";
}

export function choreViewUrl(view: "today" | "week") {
  return `/?view=${view}`;
}
