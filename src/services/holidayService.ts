export const fetchHolidays = async (year: number): Promise<string[]> => {
  try {
    const cached = localStorage.getItem(`holidays-${year}`);
    if (cached) {
      return JSON.parse(cached);
    }

    let holidayDates: string[] = [];

    try {
      // Try to fetch from the more comprehensive Indonesian API
      const response = await fetch('https://raw.githubusercontent.com/guangrei/APIHariLibur_V2/main/holidays.json');
      if (response.ok) {
        const data = await response.json();
        // Extract dates that match the requested year
        holidayDates = Object.keys(data).filter(date => date.startsWith(`${year}-`));
      }
    } catch (e) {
      console.warn('Primary holiday API failed, falling back...');
    }

    // Fallback to Nager API if primary fails or doesn't have data for the year
    if (holidayDates.length === 0) {
      const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/ID`);
      if (response.ok) {
        const data = await response.json();
        holidayDates = data.map((h: any) => h.date);
      }
    }
    
    if (holidayDates.length > 0) {
      localStorage.setItem(`holidays-${year}`, JSON.stringify(holidayDates));
    }
    
    return holidayDates;
  } catch (error) {
    console.error('Error fetching holidays:', error);
    return [];
  }
};

