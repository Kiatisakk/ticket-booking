#!/usr/bin/env python3
"""
Custom synthetic data generator for the ticket-booking PostgreSQL database.

Examples:
  python scripts/synthetic_seed.py --prefix demo --users 1000 --events 80 --bookings 8000 --reset
  python scripts/synthetic_seed.py --profile festival --venues 6 --seed 20260512

The script reads DATABASE_URL from the environment by default. It uses psycopg
or psycopg2 if available:
  python -m pip install "psycopg[binary]"
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any

try:
    import psycopg
except ImportError:  # pragma: no cover - depends on local env
    psycopg = None

try:
    import psycopg2
except ImportError:  # pragma: no cover - depends on local env
    psycopg2 = None

try:
    import bcrypt
except ImportError:  # pragma: no cover - optional
    bcrypt = None


DEFAULT_PASSWORD_HASH = "$2b$10$5g3uDWaVHWnxKVEUgnAWleMbm2KkbF1uSk8nw1soClMbP7xLjN11G"

FIRST_NAMES = [
    "Arisa", "Benja", "Chaiwat", "Darika", "Ekkarat", "Fah", "Gun", "Hansa",
    "Intira", "Jirayu", "Kanda", "Lalida", "Mek", "Narin", "Orn", "Pawat",
    "Risa", "Saran", "Tida", "Viroj", "Warin", "Yada", "Anong", "Phupha"
]
LAST_NAMES = [
    "Sukjai", "Boonyarat", "Chaiyaphum", "Tangtrakul", "Wongsa", "Siriphan",
    "Kittikul", "Rattanapong", "Lertprasert", "Nimit", "Phromsri", "Saelim"
]

EVENT_TEMPLATES = {
    "Concert": [
        "{artist}: Neon Nights Bangkok", "{artist} Live at {venue_short}",
        "{artist} World Tour", "Indie Wave: {artist}", "Bangkok Sound Lab {n}"
    ],
    "Movie": [
        "{artist}: Midnight Premiere", "Galaxy Riders {n}", "The Last Monsoon",
        "Afterlight: IMAX Cut", "Bangkok Noir {n}"
    ],
    "Seminar": [
        "{artist} Leadership Forum", "Data & AI Summit {n}", "Future Skills Expo",
        "Product Strategy Day", "Cloud Native Workshop {n}"
    ],
}

ARTISTS = [
    "Lunar Bloom", "Paper Rockets", "Mango Theory", "Electric Temple",
    "Nora Waves", "Blue Jasmine", "Quantum Kids", "Velvet Metro",
    "Siam Signals", "The Glass Room", "North Star", "City Atlas"
]

VENUE_BLUEPRINTS = [
    ("Impact Arena", "Muang Thong Thani, Nonthaburi", 16, 24, "arena"),
    ("SF Cinema Paragon", "Siam Paragon, Bangkok", 8, 14, "cinema"),
    ("BITEC Bangkok", "Bang Na, Bangkok", 12, 20, "expo"),
    ("Union Hall", "Lat Phrao, Bangkok", 10, 18, "hall"),
    ("Riverfront Stage", "Charoen Krung, Bangkok", 9, 16, "outdoor"),
    ("Thonburi Blackbox", "Thonburi, Bangkok", 6, 12, "studio"),
    ("Chiang Mai Convention Center", "Mueang Chiang Mai", 11, 18, "expo"),
    ("Phuket Amphitheatre", "Phuket Town", 9, 20, "outdoor"),
]


@dataclass
class RefData:
    roles: dict[str, int]
    categories: dict[str, int]
    seat_types: dict[str, tuple[int, Decimal]]
    booking_statuses: dict[str, int]
    payment_statuses: dict[str, int]
    payment_methods: dict[str, int]


def load_local_env() -> None:
    env_path = Path(__file__).resolve().parents[1] / ".env"
    if not env_path.exists():
        return

    for line in env_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Generate diverse synthetic ticket-booking data.")
    parser.add_argument("--config", help="Optional JSON config file. CLI flags override config values.")
    parser.add_argument("--database-url", default=os.getenv("DATABASE_URL"), help="PostgreSQL DATABASE_URL")
    parser.add_argument("--prefix", default="pydata", help="Unique prefix used for generated records")
    parser.add_argument("--profile", choices=["balanced", "festival", "corporate", "cinema"], default="balanced")
    parser.add_argument("--seed", type=int, default=241241, help="Deterministic RNG seed")
    parser.add_argument("--users", type=int, default=800, help="Synthetic customer count")
    parser.add_argument("--events", type=int, default=45, help="Synthetic event count")
    parser.add_argument("--venues", type=int, default=5, help="Synthetic venue count")
    parser.add_argument("--bookings", type=int, default=3000, help="Synthetic booking count")
    parser.add_argument("--min-showtimes", type=int, default=1, help="Minimum showtimes per event")
    parser.add_argument("--max-showtimes", type=int, default=5, help="Maximum showtimes per event")
    parser.add_argument("--start-date", default="2025-01-01", help="First possible showtime date, YYYY-MM-DD")
    parser.add_argument("--months", type=int, default=18, help="Showtime date range in months")
    parser.add_argument("--max-seats-per-booking", type=int, default=5)
    parser.add_argument("--completed-rate", type=float, default=0.78)
    parser.add_argument("--cancelled-rate", type=float, default=0.14)
    parser.add_argument("--pending-rate", type=float, default=0.08)
    parser.add_argument("--reset", action="store_true", help="Delete generated data with this prefix before inserting")
    parser.add_argument("--clean-only", action="store_true", help="Only delete generated data for this prefix")
    parser.add_argument("--dry-run", action="store_true", help="Plan data but do not write to database")
    return parser


def parse_args() -> argparse.Namespace:
    load_local_env()
    pre_parser = argparse.ArgumentParser(add_help=False)
    pre_parser.add_argument("--config")
    pre_args, _ = pre_parser.parse_known_args()

    defaults = {}
    if pre_args.config:
        with open(pre_args.config, "r", encoding="utf-8") as handle:
            defaults = json.load(handle)

    parser = build_parser()
    parser.set_defaults(**defaults)
    return parser.parse_args()


def connect(database_url: str):
    if not database_url:
        raise SystemExit("DATABASE_URL is required. Pass --database-url or set the environment variable.")

    if psycopg is not None:
        return psycopg.connect(database_url)
    if psycopg2 is not None:
        return psycopg2.connect(database_url)

    raise SystemExit(
        "Missing PostgreSQL driver. Install one with: python -m pip install \"psycopg[binary]\""
    )


def execute(cur, sql: str, params: tuple[Any, ...] = ()) -> None:
    cur.execute(sql, params)


def fetchone(cur, sql: str, params: tuple[Any, ...] = ()) -> tuple[Any, ...] | None:
    cur.execute(sql, params)
    return cur.fetchone()


def fetchall(cur, sql: str, params: tuple[Any, ...] = ()) -> list[tuple[Any, ...]]:
    cur.execute(sql, params)
    return list(cur.fetchall())


def password_hash() -> str:
    if bcrypt is None:
        return DEFAULT_PASSWORD_HASH
    return bcrypt.hashpw(b"pass1234", bcrypt.gensalt(rounds=10)).decode("utf-8")


def weighted_choice(rng: random.Random, items: list[tuple[str, float]]) -> str:
    total = sum(weight for _, weight in items)
    point = rng.random() * total
    upto = 0.0
    for item, weight in items:
        upto += weight
        if point <= upto:
            return item
    return items[-1][0]


def month_add(date: datetime, months: int) -> datetime:
    return date + timedelta(days=months * 30)


def ensure_one(cur, table: str, id_col: str, lookup_col: str, lookup_value: str, extra: dict[str, Any] | None = None) -> int:
    row = fetchone(cur, f'SELECT "{id_col}" FROM "{table}" WHERE "{lookup_col}" = %s', (lookup_value,))
    if row:
        return int(row[0])

    extra = extra or {}
    cols = [lookup_col, *extra.keys()]
    vals = [lookup_value, *extra.values()]
    quoted_cols = ", ".join(f'"{col}"' for col in cols)
    placeholders = ", ".join(["%s"] * len(vals))
    row = fetchone(
        cur,
        f'INSERT INTO "{table}" ({quoted_cols}) VALUES ({placeholders}) RETURNING "{id_col}"',
        tuple(vals),
    )
    return int(row[0])


def ensure_reference_data(cur) -> RefData:
    roles = {
        "Admin": ensure_one(cur, "Roles", "RoleID", "RoleName", "Admin", {"Description": "System Administrator"}),
        "Staff": ensure_one(cur, "Roles", "RoleID", "RoleName", "Staff", {"Description": "Event Staff"}),
        "Customer": ensure_one(cur, "Roles", "RoleID", "RoleName", "Customer", {"Description": "Regular Customer"}),
    }

    categories = {
        name: ensure_one(cur, "EventCategories", "CategoryID", "CategoryName", name)
        for name in ["Concert", "Movie", "Seminar"]
    }

    seat_types = {}
    for name, modifier in [("VIP", Decimal("2.0")), ("Standard", Decimal("1.0")), ("Sofa Bed", Decimal("1.5"))]:
        seat_types[name] = (
            ensure_one(cur, "SeatTypes", "SeatTypeID", "TypeName", name, {"PriceModifier": modifier}),
            modifier,
        )

    booking_statuses = {
        name: ensure_one(cur, "BookingStatuses", "StatusID", "StatusName", name)
        for name in ["Pending", "Completed", "Cancelled"]
    }
    payment_statuses = {
        name: ensure_one(cur, "PaymentStatuses", "StatusID", "StatusName", name)
        for name in ["Pending", "Success", "Failed"]
    }
    payment_methods = {
        name: ensure_one(cur, "PaymentMethods", "MethodID", "MethodName", name, {"IsActive": True})
        for name in ["PromptPay", "Credit Card", "TrueMoney", "ShopeePay"]
    }

    return RefData(roles, categories, seat_types, booking_statuses, payment_statuses, payment_methods)


def reset_prefix(cur, prefix: str) -> None:
    email_prefix = f"{prefix}-"
    title_prefix = f"{prefix.upper()} "
    venue_prefix = f"{prefix.upper()} "

    booking_ids = [row[0] for row in fetchall(
        cur,
        '''
        SELECT b."BookingID"
        FROM "Bookings" b
        JOIN "Users" u ON u."UserID" = b."UserID"
        WHERE u."Email" LIKE %s
        ''',
        (email_prefix + "%",),
    )]

    if booking_ids:
        execute(cur, 'DELETE FROM "Tickets" WHERE "DetailID" IN (SELECT "DetailID" FROM "BookingDetails" WHERE "BookingID" = ANY(%s))', (booking_ids,))
        execute(cur, 'DELETE FROM "Payments" WHERE "BookingID" = ANY(%s)', (booking_ids,))
        execute(cur, 'DELETE FROM "BookingDetails" WHERE "BookingID" = ANY(%s)', (booking_ids,))
        execute(cur, 'DELETE FROM "Bookings" WHERE "BookingID" = ANY(%s)', (booking_ids,))

    execute(cur, 'DELETE FROM "Users" WHERE "Email" LIKE %s', (email_prefix + "%",))
    execute(cur, 'DELETE FROM "Showtimes" WHERE "EventID" IN (SELECT "EventID" FROM "Events" WHERE "Title" LIKE %s)', (title_prefix + "%",))
    execute(cur, 'DELETE FROM "Events" WHERE "Title" LIKE %s', (title_prefix + "%",))
    execute(cur, 'DELETE FROM "Seats" WHERE "VenueID" IN (SELECT "VenueID" FROM "Venues" WHERE "VenueName" LIKE %s)', (venue_prefix + "%",))
    execute(cur, 'DELETE FROM "Venues" WHERE "VenueName" LIKE %s', (venue_prefix + "%",))


def create_venues_and_seats(cur, args: argparse.Namespace, refs: RefData, rng: random.Random) -> list[dict[str, Any]]:
    venues = []
    blueprints = VENUE_BLUEPRINTS[: max(1, min(args.venues, len(VENUE_BLUEPRINTS)))]

    for index, (name, location, rows, seats_per_row, venue_kind) in enumerate(blueprints, start=1):
      venue_name = f"{args.prefix.upper()} {name}"
      venue_id = ensure_one(cur, "Venues", "VenueID", "VenueName", venue_name, {"Location": location})
      existing = fetchone(cur, 'SELECT COUNT(*) FROM "Seats" WHERE "VenueID" = %s', (venue_id,))[0]

      if int(existing) == 0:
          for row_idx in range(rows):
              row_label = chr(ord("A") + row_idx) if row_idx < 26 else f"R{row_idx + 1}"
              for seat_no in range(1, seats_per_row + 1):
                  seat_type = "VIP" if row_idx < max(1, rows // 5) else "Sofa Bed" if row_idx >= rows - 2 else "Standard"
                  if venue_kind == "cinema" and row_idx == rows - 1:
                      seat_type = "Sofa Bed"
                  execute(
                      cur,
                      '''
                      INSERT INTO "Seats" ("VenueID", "SeatTypeID", "RowLabel", "SeatNumber")
                      VALUES (%s, %s, %s, %s)
                      ON CONFLICT ON CONSTRAINT unique_seat_position DO NOTHING
                      ''',
                      (venue_id, refs.seat_types[seat_type][0], row_label, str(seat_no)),
                  )

      seats = fetchall(
          cur,
          '''
          SELECT s."SeatID", s."RowLabel", s."SeatNumber", st."TypeName", st."PriceModifier"
          FROM "Seats" s
          JOIN "SeatTypes" st ON st."SeatTypeID" = s."SeatTypeID"
          WHERE s."VenueID" = %s
          ORDER BY s."RowLabel", s."SeatNumber"
          ''',
          (venue_id,),
      )
      venues.append({
          "id": venue_id,
          "name": venue_name,
          "short": name.split()[0],
          "kind": venue_kind,
          "seats": [
              {"id": int(row[0]), "row": row[1], "number": row[2], "type": row[3], "modifier": Decimal(str(row[4]))}
              for row in seats
          ],
      })

    return venues


def category_weights(profile: str) -> list[tuple[str, float]]:
    if profile == "festival":
        return [("Concert", 0.65), ("Movie", 0.15), ("Seminar", 0.20)]
    if profile == "corporate":
        return [("Concert", 0.20), ("Movie", 0.15), ("Seminar", 0.65)]
    if profile == "cinema":
        return [("Concert", 0.15), ("Movie", 0.70), ("Seminar", 0.15)]
    return [("Concert", 0.38), ("Movie", 0.34), ("Seminar", 0.28)]


def create_events_and_showtimes(cur, args: argparse.Namespace, refs: RefData, venues: list[dict[str, Any]], rng: random.Random) -> list[dict[str, Any]]:
    showtimes = []
    start = datetime.fromisoformat(args.start_date).replace(tzinfo=timezone.utc)
    end = month_add(start, args.months)

    for i in range(1, args.events + 1):
        category = weighted_choice(rng, category_weights(args.profile))
        venue = rng.choice(venues)
        artist = rng.choice(ARTISTS)
        template = rng.choice(EVENT_TEMPLATES[category])
        title = f"{args.prefix.upper()} {template.format(artist=artist, venue_short=venue['short'], n=i)}"
        description = f"Synthetic {category.lower()} generated by Python seed profile={args.profile}."
        event_id = ensure_one(
            cur,
            "Events",
            "EventID",
            "Title",
            title,
            {"CategoryID": refs.categories[category], "Description": description},
        )

        showtime_count = rng.randint(args.min_showtimes, max(args.min_showtimes, args.max_showtimes))
        for _ in range(showtime_count):
            span_days = max(1, (end - start).days)
            day = rng.randrange(span_days)
            hour_pool = [10, 13, 16, 19, 20, 21] if category in ("Concert", "Movie") else [8, 9, 10, 13, 14]
            showtime_at = start + timedelta(days=day, hours=rng.choice(hour_pool), minutes=rng.choice([0, 15, 30, 45]))
            if category == "Concert":
                base_price = rng.choice([1200, 1800, 2500, 3200, 4500])
            elif category == "Movie":
                base_price = rng.choice([220, 280, 320, 450, 550])
            else:
                base_price = rng.choice([700, 950, 1200, 1800, 2500])

            row = fetchone(
                cur,
                '''
                INSERT INTO "Showtimes" ("EventID", "VenueID", "StartDateTime", "BasePrice")
                VALUES (%s, %s, %s, %s)
                RETURNING "ShowtimeID"
                ''',
                (event_id, venue["id"], showtime_at, Decimal(base_price)),
            )
            showtimes.append({
                "id": int(row[0]),
                "event_id": event_id,
                "category": category,
                "venue": venue,
                "start": showtime_at,
                "base_price": Decimal(base_price),
                "used_seats": set(),
            })

    return showtimes


def create_users(cur, args: argparse.Namespace, refs: RefData, rng: random.Random) -> list[int]:
    user_ids = []
    pwd = password_hash()

    for i in range(1, args.users + 1):
        first = rng.choice(FIRST_NAMES)
        last = rng.choice(LAST_NAMES)
        email = f"{args.prefix}-{i:06d}@example.test"
        created_at = datetime(2025, 1, 1, tzinfo=timezone.utc) + timedelta(days=rng.randrange(540), hours=rng.randrange(24))
        row = fetchone(
            cur,
            '''
            INSERT INTO "Users" ("RoleID", "FullName", "Email", "Password", "CreatedAt", "UpdatedAt")
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT ("Email") DO UPDATE SET "FullName" = EXCLUDED."FullName"
            RETURNING "UserID"
            ''',
            (refs.roles["Customer"], f"{first} {last}", email, pwd, created_at, created_at),
        )
        user_ids.append(int(row[0]))

    return user_ids


def choose_status(args: argparse.Namespace, rng: random.Random) -> str:
    return weighted_choice(rng, [
        ("Completed", max(args.completed_rate, 0)),
        ("Cancelled", max(args.cancelled_rate, 0)),
        ("Pending", max(args.pending_rate, 0)),
    ])


def choose_seats(showtime: dict[str, Any], max_count: int, rng: random.Random) -> list[dict[str, Any]]:
    seats = showtime["venue"]["seats"]
    available = [seat for seat in seats if seat["id"] not in showtime["used_seats"]]
    if not available:
        return []

    count = min(rng.randint(1, max(1, max_count)), len(available))
    popular = [
        seat for seat in available
        if seat["row"] in {"C", "D", "E"} or (str(seat["number"]).isdigit() and 4 <= int(seat["number"]) <= 10)
    ]
    pool = popular if popular and rng.random() < 0.72 else available
    chosen = rng.sample(pool, min(count, len(pool)))
    for seat in chosen:
        showtime["used_seats"].add(seat["id"])
    return chosen


def create_bookings(cur, args: argparse.Namespace, refs: RefData, user_ids: list[int], showtimes: list[dict[str, Any]], rng: random.Random) -> dict[str, int]:
    stats = {"bookings": 0, "details": 0, "tickets": 0, "payments": 0}
    methods = list(refs.payment_methods.values())

    for i in range(1, args.bookings + 1):
        showtime = rng.choice(showtimes)
        seats = choose_seats(showtime, args.max_seats_per_booking, rng)
        if not seats:
            continue

        status = choose_status(args, rng)
        lead_days = max(0, int(rng.expovariate(1 / 12)))
        booking_at = showtime["start"] - timedelta(days=lead_days, hours=rng.randrange(1, 8), minutes=rng.randrange(60))
        if booking_at > datetime.now(timezone.utc):
            booking_at = datetime.now(timezone.utc) - timedelta(minutes=rng.randrange(5, 600))

        total = sum(showtime["base_price"] * seat["modifier"] for seat in seats)
        row = fetchone(
            cur,
            '''
            INSERT INTO "Bookings" (
              "UserID", "StatusID", "BookingTimestamp", "ExpiresAt", "TotalAmount", "CreatedAt", "UpdatedAt"
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING "BookingID"
            ''',
            (
                rng.choice(user_ids),
                refs.booking_statuses[status],
                booking_at,
                booking_at + timedelta(minutes=15),
                total,
                booking_at,
                booking_at,
            ),
        )
        booking_id = int(row[0])
        stats["bookings"] += 1

        detail_ids = []
        for seat in seats:
            detail_row = fetchone(
                cur,
                '''
                INSERT INTO "BookingDetails" ("BookingID", "ShowtimeID", "SeatID", "CreatedAt", "UpdatedAt")
                VALUES (%s, %s, %s, %s, %s)
                RETURNING "DetailID"
                ''',
                (booking_id, showtime["id"], seat["id"], booking_at, booking_at),
            )
            detail_ids.append((int(detail_row[0]), seat))
            stats["details"] += 1

        payment_status = "Success" if status == "Completed" else "Failed" if status == "Cancelled" else "Pending"
        transaction_id = f"SYN-{args.prefix}-{hashlib.sha1(f'{args.seed}-{i}-{booking_id}'.encode()).hexdigest()[:12].upper()}"
        paid_at = booking_at + timedelta(minutes=rng.randrange(1, 12)) if payment_status == "Success" else None
        execute(
            cur,
            '''
            INSERT INTO "Payments" (
              "BookingID", "MethodID", "StatusID", "TransactionID", "Amount", "PaidAt", "CreatedAt", "UpdatedAt"
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT ("BookingID") DO NOTHING
            ''',
            (booking_id, rng.choice(methods), refs.payment_statuses[payment_status], transaction_id, total, paid_at, booking_at, booking_at),
        )
        stats["payments"] += 1

        if status == "Completed":
            for detail_id, seat in detail_ids:
                ticket_no = f"PY{detail_id}"
                execute(
                    cur,
                    '''
                    INSERT INTO "Tickets" ("TicketNo", "DetailID", "FinalPrice", "CreatedAt", "UpdatedAt")
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT ("DetailID") DO NOTHING
                    ''',
                    (ticket_no[:20], detail_id, showtime["base_price"] * seat["modifier"], booking_at, booking_at),
                )
                stats["tickets"] += 1

        if i % 500 == 0:
            print(f"  bookings planned: {i}/{args.bookings}")

    return stats


def main() -> int:
    args = parse_args()
    rng = random.Random(args.seed)

    print("=== Python Synthetic Seed ===")
    print(f"profile={args.profile} prefix={args.prefix} seed={args.seed}")
    print(f"users={args.users} events={args.events} venues={args.venues} bookings={args.bookings}")

    if args.dry_run:
        print("Dry run: no database writes will be performed.")
        return 0

    conn = connect(args.database_url)
    try:
        cur = conn.cursor()
        if args.reset or args.clean_only:
            print(f"Cleaning generated data for prefix {args.prefix!r}...")
            reset_prefix(cur, args.prefix)
            conn.commit()
            if args.clean_only:
                print("Clean-only complete.")
                return 0

        refs = ensure_reference_data(cur)
        venues = create_venues_and_seats(cur, args, refs, rng)
        users = create_users(cur, args, refs, rng)
        showtimes = create_events_and_showtimes(cur, args, refs, venues, rng)
        stats = create_bookings(cur, args, refs, users, showtimes, rng)
        conn.commit()

        print("=== Complete ===")
        print(f"venues={len(venues)} users={len(users)} showtimes={len(showtimes)}")
        print(f"bookings={stats['bookings']} details={stats['details']} payments={stats['payments']} tickets={stats['tickets']}")
        return 0
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
