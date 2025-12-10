// Timezone helper for WITA (Waktu Indonesia Tengah / UTC+8)
// Used throughout the app to ensure consistent date handling

const WITA_OFFSET = 8; // UTC+8

/**
 * Get current date/time in WITA timezone
 */
export function getWITADate(): Date {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * WITA_OFFSET));
}

/**
 * Get today's date in YYYY-MM-DD format (WITA timezone)
 */
export function getTodayWITA(): string {
  const wita = getWITADate();
  const year = wita.getFullYear();
  const month = String(wita.getMonth() + 1).padStart(2, '0');
  const day = String(wita.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get current month in YYYY-MM format (WITA timezone)
 */
export function getCurrentMonthWITA(): string {
  const wita = getWITADate();
  const year = wita.getFullYear();
  const month = String(wita.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Get first day of current month in YYYY-MM-DD format (WITA timezone)
 */
export function getFirstDayOfMonthWITA(): string {
  const wita = getWITADate();
  const year = wita.getFullYear();
  const month = String(wita.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

/**
 * Get last day of current month in YYYY-MM-DD format (WITA timezone)
 */
export function getLastDayOfMonthWITA(): string {
  const wita = getWITADate();
  const year = wita.getFullYear();
  const month = wita.getMonth() + 1;
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

/**
 * Get first day of a specific month in YYYY-MM-DD format
 */
export function getFirstDayOfMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

/**
 * Get last day of a specific month in YYYY-MM-DD format
 */
export function getLastDayOfMonth(year: number, month: number): string {
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

/**
 * Format a Date object to YYYY-MM-DD string (using WITA timezone)
 */
export function formatDateWITA(date: Date): string {
  // Convert to WITA
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const wita = new Date(utc + (3600000 * WITA_OFFSET));
  
  const year = wita.getFullYear();
  const month = String(wita.getMonth() + 1).padStart(2, '0');
  const day = String(wita.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get year from WITA timezone
 */
export function getYearWITA(): number {
  return getWITADate().getFullYear();
}

/**
 * Get month (1-indexed) from WITA timezone
 */
export function getMonthWITA(): number {
  return getWITADate().getMonth() + 1;
}
