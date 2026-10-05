/**
 * Bikram Sambat (BS) <-> Anno Domini (AD) Accurate Bidirectional Converter
 * Fully synchronized calendar reference for Warehouse Inventory System (Nepal)
 */

export interface NepaliMonth {
  index: number;
  name: string;
  devanagari: string;
}

export const NEPALI_MONTHS: NepaliMonth[] = [
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

// Official Bikram Sambat Calendar Matrix: [monthDays (12), Start Gregorian Date [year, monthIndex(0-based), day]]
const BS_CALENDAR: Record<number, { days: number[]; startAD: [number, number, number] }> = {
  2070: { days: [31, 31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30], startAD: [2013, 3, 14] },
  2071: { days: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], startAD: [2014, 3, 14] },
  2072: { days: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31], startAD: [2015, 3, 14] },
  2073: { days: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31], startAD: [2016, 3, 13] },
  2074: { days: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30], startAD: [2017, 3, 14] },
  2075: { days: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], startAD: [2018, 3, 14] },
  2076: { days: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31], startAD: [2019, 3, 14] },
  2077: { days: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31], startAD: [2020, 3, 13] },
  2078: { days: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30], startAD: [2021, 3, 14] },
  2079: { days: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], startAD: [2022, 3, 14] },
  2080: { days: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30], startAD: [2023, 3, 14] },
  2081: { days: [31, 31, 32, 32, 31, 30, 30, 30, 29, 30, 29, 31], startAD: [2024, 3, 13] },
  2082: { days: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30], startAD: [2025, 3, 14] },
  2083: { days: [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30, 30], startAD: [2026, 3, 14] },
  2084: { days: [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30, 30], startAD: [2027, 3, 14] },
  2085: { days: [31, 32, 31, 32, 30, 31, 30, 30, 29, 30, 30, 30], startAD: [2028, 3, 13] },
  2086: { days: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30], startAD: [2029, 3, 14] },
  2087: { days: [31, 31, 32, 31, 31, 31, 30, 30, 29, 30, 30, 30], startAD: [2030, 3, 14] },
  2088: { days: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30], startAD: [2031, 3, 14] },
  2089: { days: [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30, 30], startAD: [2032, 3, 13] },
  2090: { days: [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30, 30], startAD: [2033, 3, 14] },
  2091: { days: [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30, 30], startAD: [2034, 3, 14] },
  2092: { days: [31, 32, 31, 32, 30, 31, 30, 30, 29, 30, 30, 30], startAD: [2035, 3, 14] },
  2093: { days: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30], startAD: [2036, 3, 13] },
  2094: { days: [31, 31, 32, 31, 31, 31, 30, 30, 29, 30, 30, 30], startAD: [2037, 3, 14] },
  2095: { days: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30], startAD: [2038, 3, 14] },
};

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
 * Returns today's date in YYYY-MM-DD format (BS)
 */
export function getTodayBS(): string {
  return convertADtoBS(getTodayAD());
}

/**
 * Checks if a string is a valid AD date (YYYY-MM-DD)
 */
export function isValidADDate(adDateStr: string): boolean {
  if (!adDateStr || typeof adDateStr !== 'string') return false;
  const match = adDateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const y = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const d = parseInt(match[3], 10);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dateObj = new Date(y, m - 1, d);
  return dateObj.getFullYear() === y && dateObj.getMonth() === m - 1 && dateObj.getDate() === d;
}

/**
 * Checks if a string is a valid BS date (YYYY-MM-DD or YYYY/MM/DD)
 */
export function isValidBSDate(bsDateStr: string): boolean {
  if (!bsDateStr || typeof bsDateStr !== 'string') return false;
  const cleaned = bsDateStr.replace(/\//g, '-').trim();
  const match = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return false;
  const y = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const d = parseInt(match[3], 10);
  if (m < 1 || m > 12) return false;
  const entry = BS_CALENDAR[y];
  if (!entry) return y >= 2000 && y <= 2100 && d >= 1 && d <= 32;
  const maxDays = entry.days[m - 1];
  return d >= 1 && d <= maxDays;
}

/**
 * Converts AD date string (YYYY-MM-DD) to BS date (YYYY-MM-DD).
 */
export function convertADtoBS(adDateStr: string): string {
  if (!adDateStr) return '';
  try {
    const parts = adDateStr.split('-');
    if (parts.length !== 3) return '';
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return '';

    const adTarget = new Date(y, m - 1, d);
    adTarget.setHours(0, 0, 0, 0);

    const years = Object.keys(BS_CALENDAR)
      .map(Number)
      .sort((a, b) => b - a);

    for (const bsYear of years) {
      const { days, startAD } = BS_CALENDAR[bsYear];
      const startADDate = new Date(startAD[0], startAD[1], startAD[2]);
      startADDate.setHours(0, 0, 0, 0);

      if (adTarget.getTime() >= startADDate.getTime()) {
        let diffDays = Math.round((adTarget.getTime() - startADDate.getTime()) / (1000 * 60 * 60 * 24));
        for (let mIdx = 0; mIdx < days.length; mIdx++) {
          if (diffDays < days[mIdx]) {
            const bsMonth = String(mIdx + 1).padStart(2, '0');
            const bsDay = String(diffDays + 1).padStart(2, '0');
            return `${bsYear}-${bsMonth}-${bsDay}`;
          }
          diffDays -= days[mIdx];
        }
      }
    }

    // Fallback approximation for dates outside explicit calendar range:
    const approxBSYear = y + 57;
    const anchorAD = new Date(y, 3, 14);
    let diff = Math.floor((adTarget.getTime() - anchorAD.getTime()) / (1000 * 60 * 60 * 24));
    let finalBSYear = approxBSYear;
    if (diff < 0) {
      finalBSYear -= 1;
      const prevAnchor = new Date(y - 1, 3, 14);
      diff = Math.floor((adTarget.getTime() - prevAnchor.getTime()) / (1000 * 60 * 60 * 24));
    }
    const defaultDays = [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30, 30];
    let bMonth = 1;
    let bDay = 1;
    let rem = diff;
    for (let i = 0; i < defaultDays.length; i++) {
      if (rem < defaultDays[i]) {
        bMonth = i + 1;
        bDay = rem + 1;
        break;
      }
      rem -= defaultDays[i];
    }
    return `${finalBSYear}-${String(bMonth).padStart(2, '0')}-${String(bDay).padStart(2, '0')}`;
  } catch {
    return '';
  }
}

/**
 * Converts BS date string (YYYY-MM-DD or YYYY/MM/DD) to AD date (YYYY-MM-DD).
 */
export function convertBStoAD(bsDateStr: string): string {
  if (!bsDateStr) return '';
  try {
    const cleaned = bsDateStr.replace(/\//g, '-').trim();
    const parts = cleaned.split('-');
    if (parts.length !== 3) return '';

    const bsYear = parseInt(parts[0], 10);
    const bsMonth = parseInt(parts[1], 10);
    const bsDay = parseInt(parts[2], 10);

    if (isNaN(bsYear) || isNaN(bsMonth) || isNaN(bsDay)) return '';
    if (bsMonth < 1 || bsMonth > 12 || bsDay < 1) return '';

    const calEntry = BS_CALENDAR[bsYear];
    if (calEntry) {
      const { days, startAD } = calEntry;
      let totalDays = 0;
      for (let i = 0; i < bsMonth - 1; i++) {
        totalDays += days[i];
      }
      totalDays += bsDay - 1;

      const adDate = new Date(startAD[0], startAD[1], startAD[2]);
      adDate.setDate(adDate.getDate() + totalDays);

      const y = adDate.getFullYear();
      const m = String(adDate.getMonth() + 1).padStart(2, '0');
      const d = String(adDate.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    // Fallback approximation for years outside predefined map
    const estADYear = bsYear - 57;
    const anchorAD = new Date(estADYear, 3, 14);
    const defaultDays = [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30, 30];
    let totalDays = 0;
    for (let i = 0; i < bsMonth - 1; i++) {
      totalDays += defaultDays[i];
    }
    totalDays += bsDay - 1;
    anchorAD.setDate(anchorAD.getDate() + totalDays);

    const y = anchorAD.getFullYear();
    const m = String(anchorAD.getMonth() + 1).padStart(2, '0');
    const d = String(anchorAD.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  } catch {
    return '';
  }
}

/**
 * Returns formatted BS string with month name, e.g. "2083 Ashwin 19 (असोज १९)"
 */
export function formatBSDisplay(bsDateStr: string): string {
  if (!bsDateStr) return '';
  const cleaned = bsDateStr.replace(/\//g, '-').trim();
  const parts = cleaned.split('-');
  if (parts.length !== 3) return bsDateStr;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  const m = NEPALI_MONTHS.find((item) => item.index === monthIdx);
  if (!m) return bsDateStr;
  return `${year} ${m.name} ${day} (${m.devanagari} ${day})`;
}

/**
 * Returns formatted AD string with English month name, e.g. "05 Oct 2026"
 */
export function formatADDisplay(adDateStr: string): string {
  if (!adDateStr) return '';
  const parts = adDateStr.split('-');
  if (parts.length !== 3) return adDateStr;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mIdx = parseInt(parts[1], 10) - 1;
  if (mIdx < 0 || mIdx > 11) return adDateStr;
  return `${parts[2]} ${months[mIdx]} ${parts[0]}`;
}
