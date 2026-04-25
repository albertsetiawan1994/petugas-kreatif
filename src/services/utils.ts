
import { format } from 'date-fns';
// Fix: Import 'id' locale from specific subpath to avoid missing export error in some configurations
import { id } from 'date-fns/locale/id';

export const toRoman = (num: number): string => {
  const roman: { [key: string]: number } = {
    M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1
  };
  let str = '';
  for (const i of Object.keys(roman)) {
    const q = Math.floor(num / roman[i]);
    num -= q * roman[i];
    str += i.repeat(q);
  }
  return str;
};

// Helper to parse YYYY-MM-DD to local Date object
const parseDate = (dateStr: string): Date => {
  if (!dateStr) return new Date();
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  }
  return new Date(dateStr);
};

export const formatDateID = (dateStr: string): string => {
  try {
    return format(parseDate(dateStr), 'eeee, d MMMM yyyy', { locale: id });
  } catch (e) {
    return dateStr;
  }
};

export const getMonthYearID = (date: Date): string => {
  return format(date, 'MMMM yyyy', { locale: id });
};

export const generateId = () => Math.random().toString(36).substr(2, 9);

export const sendNotification = async (title: string, body: string) => {
  if (!("Notification" in window)) return;

  if (Notification.permission === "granted") {
    new Notification(title, { body, icon: '/pwa-192x192.png' });
  } else if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      new Notification(title, { body, icon: '/pwa-192x192.png' });
    }
  }
};

export const getEasterDate = (year: number): Date => {
  const f = Math.floor,
    G = year % 19,
    C = f(year / 100),
    H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30,
    I = H - f(H / 28) * (1 - f(29 / (H + 1)) * f((21 - G) / 11)),
    J = (year + f(year / 4) + I + 2 - C + f(C / 4)) % 7,
    L = I - J,
    month = 3 + f((L + 40) / 44),
    day = L + 28 - 31 * f(month / 4);
  return new Date(year, month - 1, day);
};

export const isCatholicHoliday = (date: Date): boolean => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  // Fixed Indonesian National Holidays & Catholic Holidays
  if (month === 0 && day === 1) return true; // Tahun Baru Masehi / Santa Perawan Maria Bunda Allah
  if (month === 11 && day === 25) return true; // Hari Raya Natal

  // Calculate Easter
  const easter = getEasterDate(year);
  
  // Helper to check relative to Easter
  const isDaysFromEaster = (daysOffset: number) => {
    const target = new Date(easter);
    target.setDate(easter.getDate() + daysOffset);
    return month === target.getMonth() && day === target.getDate();
  };

  if (isDaysFromEaster(-2)) return true; // Jumat Agung (Wafat Yesus Kristus)
  if (isDaysFromEaster(39)) return true; // Kenaikan Yesus Kristus

  return false;
};