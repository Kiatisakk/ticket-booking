export function sortShowtimesByBookingOrder(showtimes = [], now = new Date()) {
  return [...showtimes].sort((a, b) => {
    const aTime = new Date(a.StartDateTime).getTime();
    const bTime = new Date(b.StartDateTime).getTime();
    const nowTime = now.getTime();
    const aAvailable = aTime >= nowTime;
    const bAvailable = bTime >= nowTime;

    if (aAvailable !== bAvailable) return aAvailable ? -1 : 1;

    const dateDiff = aAvailable ? aTime - bTime : bTime - aTime;
    if (dateDiff !== 0) return dateDiff;
    return Number(a.ShowtimeID || 0) - Number(b.ShowtimeID || 0);
  });
}

export function getFirstBookableShowtime(showtimes = [], now = new Date()) {
  const sorted = sortShowtimesByBookingOrder(showtimes, now);
  return sorted.find(showtime => new Date(showtime.StartDateTime) >= now) || sorted[0] || null;
}
