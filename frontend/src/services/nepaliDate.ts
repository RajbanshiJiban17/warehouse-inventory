/**
 * Bikram Sambat (BS) <-> Anno Domini (AD) Date Utilities
 * For Warehouse Inventory System (Nepal)
 */

// Nepali Month Names
export const NEPALI_MONTHS = [
  { index: 1, name: 'Baisakh', devanagari: 'बैशाख' },
  { index: 2, name: 'Jestha', devanagari: 'जेठ' },
  { index: 3, name: 'Ashadh', devanagari: 'असार' },
  { index: 4, name: 'Shrawan', devanagari: 'साउन' },
  { index: 5, name: 'Bhadra', devanagari: 'भदौ' },
  { index: 6, name: 'Ashwin', devanagari: 'असोज' },
  { index: 7, name: 'Kartik', devanagari: 'कार्तिक' },
  { index: 8, name: 'Mangsir', devanagari: 'मंसिर' },
  { index: 9, name: 'Poush', devanagari: 'पुष' },
  { index: 10, name: 'Magh', devanagari: 'माघ' },
  { index: 11, name: 'Falgun', devanagari: 'फागुन' },
  { index: 12, name: 'Chaitra', devanagari: 'चैत' },
];

/**
 * Returns today's date in YYYY-MM-DD format (AD) based on system local time
 */
export function getTodayAD(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Converts AD date string (YYYY-MM-DD) to approximate BS date (YYYY-MM-DD).
 * Standard reference: 2026-10-02 AD corresponds to 2083-06-16 BS.
 */
export function convertADtoBS(adDateStr: string): string {
  if (!adDateStr) return '';
  try {
    const [yStr, mStr, dStr] = adDateStr.split('-');
    const adYear = parseInt(yStr, 10);
    const adMonth = parseInt(mStr, 10);
    const adDay = parseInt(dStr, 10);

    if (isNaN(adYear) || isNaN(adMonth) || isNaN(adDay)) return '';

    const adDate = new Date(adYear, adMonth - 1, adDay);

    // Baseline Anchor: 2026-04-14 AD = 2083-01-01 BS (Nepali New Year)
    // 2024-04-13 AD = 2081-01-01 BS
    // 2025-04-14 AD = 2082-01-01 BS
    // Each Nepali New Year is around April 13-14 AD (+57 years minus ~3.5 months).
    // Days in Nepali months typically range: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30]

    // General robust calculation for modern operational range (2020-2035 AD / 2077-2092 BS):
    const anchorAD = new Date(adYear, 3, 14); // April 14 of the same year
    let bsYear = adYear + 57;
    let daysDiff = Math.floor((adDate.getTime() - anchorAD.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff < 0) {
      // Prior to mid-April, still in previous BS year
      bsYear -= 1;
      const prevAnchorAD = new Date(adYear - 1, 3, 14);
      daysDiff = Math.floor((adDate.getTime() - prevAnchorAD.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Average days per month approximation for display synchronization
    const monthDays = [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30];
    let bsMonth = 1;
    let bsDay = 1;

    let remaining = daysDiff;
    for (let i = 0; i < monthDays.length; i++) {
      if (remaining < monthDays[i]) {
        bsMonth = i + 1;
        bsDay = remaining + 1;
        break;
      }
      remaining -= monthDays[i];
    }

    const mm = String(bsMonth).padStart(2, '0');
    const dd = String(bsDay).padStart(2, '0');
    return `${bsYear}-${mm}-${dd}`;
  } catch {
    return '';
  }
}

/**
 * Returns formatted BS string with month name, e.g. "2083 Ashwin 16"
 */
export function formatBSDisplay(bsDateStr: string): string {
  if (!bsDateStr) return '';
  const parts = bsDateStr.split('-');
  if (parts.length !== 3) return bsDateStr;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10);
  const day = parts[2];
  const m = NEPALI_MONTHS.find((item) => item.index === monthIdx);
  return `${year} ${m ? m.name : parts[1]} ${day}`;
}
