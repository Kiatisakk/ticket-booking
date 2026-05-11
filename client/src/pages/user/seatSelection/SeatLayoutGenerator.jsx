import React from 'react';

function SeatLayoutGenerator({ 
  seats, 
  categoryName, 
  isSeatBooked, 
  isSeatSelected, 
  handleSeatClick,
  showtimeBasePrice
}) {
  const isSeminar = categoryName?.toLowerCase() === 'seminar';

  const groupSeatsByZoneAndRow = () => {
    const grouped = {};
    seats.forEach(seat => {
      const zone = seat.SeatType?.TypeName || 'Standard';
      const row = seat.RowLabel || 'A';
      if (!grouped[zone]) grouped[zone] = {};
      if (!grouped[zone][row]) grouped[zone][row] = [];
      grouped[zone][row].push(seat);
    });
    return grouped;
  };

  const groupedData = groupSeatsByZoneAndRow();

  const getSeatTypeClass = (seat) => {
    const typeName = seat.SeatType?.TypeName?.toLowerCase() || 'standard';
    if (typeName.includes('vip')) return 'seat-type-vip';
    if (typeName.includes('sofa')) return 'seat-type-sofa-bed';
    return 'seat-type-standard';
  };

  const getSeatStatusClass = (seat) => {
    if (isSeatBooked(seat.SeatID)) return 'taken';
    if (isSeatSelected(seat.SeatID)) return 'selected';
    return `available ${getSeatTypeClass(seat)}`;
  };

  if (!isSeminar) {
    return (
      <div className="map-area">
        <div className="stage">STAGE</div>

        {Object.entries(groupedData).map(([zoneName, rows]) => {
          const sampleSeat = Object.values(rows)[0][0];
          const price = showtimeBasePrice * parseFloat(sampleSeat?.SeatType?.PriceModifier || 1);

          return (
            <div key={zoneName} className="seat-zone">
              <div className="zone-label">
                {zoneName.toLowerCase().includes('vip') ? '⭐ ' : ''}{zoneName} — ฿ {price.toLocaleString()}
              </div>
              <div className="seat-zone-inner">
                {Object.entries(rows).map(([rowLabel, rowSeats]) => {
                  const half = Math.floor(rowSeats.length / 2);
                  return (
                    <div key={rowLabel} className="seat-row">
                      <div className="row-label">{rowLabel}</div>
                      {rowSeats.map((seat, index) => (
                        <React.Fragment key={seat.SeatID}>
                          {index === half && <div className="aisle"></div>}
                          {(() => {
                            const isTaken = isSeatBooked(seat.SeatID);
                            return (
                              <div
                                className={`seat ${getSeatStatusClass(seat)}`}
                                onClick={isTaken ? undefined : () => handleSeatClick(seat)}
                                aria-disabled={isTaken}
                                title={`${zoneName} - Row ${seat.RowLabel} Seat ${seat.SeatNumber}${isTaken ? ' (Taken)' : ''}`}
                              >
                                <span className="seat-num">{seat.SeatNumber}</span>
                              </div>
                            );
                          })()}
                        </React.Fragment>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Legend */}
        <div className="legend">
          <div className="legend-item"><div className="legend-swatch legend-vip"></div>VIP</div>
          <div className="legend-item"><div className="legend-swatch legend-standard"></div>Standard</div>
          <div className="legend-item"><div className="legend-swatch legend-sofa-bed"></div>Sofa Bed</div>
          <div className="legend-item"><div className="legend-swatch legend-selected"></div>Selected</div>
          <div className="legend-item"><div className="legend-swatch legend-taken"></div>Taken</div>
        </div>
      </div>
    );
  }

  return (
    <div className="map-area seminar-mode">
      <div className="speaker-podium">SPEAKER PODIUM</div>
      <div className="seminar-hall">
        {Object.entries(groupedData).map(([zoneName, rows]) => (
          <div key={zoneName} className="seminar-zone">
            <div className="zone-label">{zoneName} Zone</div>
            <div className="seminar-rows">
              {Object.entries(rows).map(([rowLabel, rowSeats]) => {
                // แบ่งที่นั่งเป็น 2 ฝั่ง ซ้าย-ขวา แบบห้องเรียน
                const midPoint = Math.ceil(rowSeats.length / 2);
                const leftSide = rowSeats.slice(0, midPoint);
                const rightSide = rowSeats.slice(midPoint);

                return (
                  <div key={rowLabel} className="seminar-row">
                    <div className="row-label">{rowLabel}</div>
                    
                    {/* ฝั่งซ้าย */}
                    <div className="seminar-block">
                      {leftSide.map(seat => {
                        const isTaken = isSeatBooked(seat.SeatID);
                        return (
                          <div
                            key={seat.SeatID}
                            className={`seat seminar-seat ${getSeatStatusClass(seat)}`}
                            onClick={isTaken ? undefined : () => handleSeatClick(seat)}
                            aria-disabled={isTaken}
                          >
                            <span className="seat-num">{seat.SeatNumber}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="seminar-aisle"></div>

                    <div className="seminar-block">
                      {rightSide.map(seat => {
                        const isTaken = isSeatBooked(seat.SeatID);
                        return (
                          <div
                            key={seat.SeatID}
                            className={`seat seminar-seat ${getSeatStatusClass(seat)}`}
                            onClick={isTaken ? undefined : () => handleSeatClick(seat)}
                            aria-disabled={isTaken}
                          >
                            <span className="seat-num">{seat.SeatNumber}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SeatLayoutGenerator;
