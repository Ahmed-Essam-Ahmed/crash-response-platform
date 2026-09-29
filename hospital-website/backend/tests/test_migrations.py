import unittest
from datetime import datetime

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session, sessionmaker

from app import migrations, models

LEGACY_SCHEMA = """
CREATE TABLE hospitals (
    id INTEGER NOT NULL,
    code VARCHAR NOT NULL,
    name VARCHAR NOT NULL,
    lat FLOAT NOT NULL,
    lon FLOAT NOT NULL,
    capacity INTEGER NOT NULL,
    trauma_level INTEGER NOT NULL,
    current_load INTEGER NOT NULL,
    PRIMARY KEY (id)
);
CREATE TABLE ambulances (
    id INTEGER NOT NULL,
    code VARCHAR NOT NULL,
    lat FLOAT NOT NULL,
    lon FLOAT NOT NULL,
    status VARCHAR NOT NULL,
    hospital_code VARCHAR,
    incident_id INTEGER,
    PRIMARY KEY (id)
);
CREATE TABLE incidents (
    id INTEGER NOT NULL,
    alert_id VARCHAR NOT NULL,
    trip_id VARCHAR NOT NULL,
    severity FLOAT NOT NULL,
    lat FLOAT NOT NULL,
    lon FLOAT NOT NULL,
    status VARCHAR NOT NULL,
    destination VARCHAR NOT NULL,
    hospital_code VARCHAR,
    medical_profile_ref VARCHAR,
    detection TEXT,
    impact_factors TEXT,
    eta_scene_seconds INTEGER,
    eta_hospital_seconds INTEGER,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    closed_at DATETIME,
    PRIMARY KEY (id)
);
"""

LEGACY_ROWS = """
INSERT INTO hospitals (id, code, name, lat, lon, capacity, trauma_level, current_load)
VALUES (1, 'hosp-old', 'Old General', 30.0, 31.0, 14, 2, 1);
INSERT INTO ambulances (id, code, lat, lon, status, hospital_code)
VALUES (1, 'amb-old-1', 30.0, 31.0, 'available', 'hosp-old');
INSERT INTO incidents (id, alert_id, trip_id, severity, lat, lon, status, destination,
                       hospital_code, created_at, updated_at)
VALUES (1, 'alert-old', 'trip-old', 7.5, 30.01, 31.01, 'closed', 'minor',
        'hosp-old', '2024-01-01 00:00:00', '2024-01-01 00:00:00');
"""


def legacy_engine():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    with engine.begin() as conn:
        for statement in LEGACY_SCHEMA.strip().split(";"):
            if statement.strip():
                conn.execute(text(statement))
        for statement in LEGACY_ROWS.strip().split(";"):
            if statement.strip():
                conn.execute(text(statement))
    return engine


class MigrationTest(unittest.TestCase):
    def setUp(self):
        self.engine = legacy_engine()

    def tearDown(self):
        self.engine.dispose()

    def test_retired_columns_are_dropped(self):
        applied = migrations.apply(self.engine)
        self.assertTrue(any("dropped" in entry for entry in applied))

        for table in ("hospitals", "ambulances", "incidents"):
            columns = {c["name"] for c in inspect(self.engine).get_columns(table)}
            self.assertFalse(
                {"capacity", "hospital_code"} & columns,
                f"{table} still carries retired columns: {columns}",
            )

    def test_new_tables_are_created(self):
        migrations.apply(self.engine)
        tables = set(inspect(self.engine).get_table_names())
        for table in ("users", "auth_tokens", "case_offers", "patient_profiles"):
            self.assertIn(table, tables)

    def test_legacy_rows_survive_and_are_repointed(self):
        migrations.apply(self.engine)
        db = Session(bind=self.engine)

        hospital = db.get(models.Hospital, 1)
        self.assertIsNotNone(hospital)
        self.assertEqual(hospital.name, "Old General")
        self.assertIsNotNone(hospital.created_at)

        ambulance = db.query(models.Ambulance).one()
        self.assertEqual(ambulance.hospital_id, 1)

        incident = db.query(models.Incident).one()
        self.assertEqual(incident.hospital_id, 1)
        self.assertEqual(incident.alert_id, 'alert-old')
        db.close()

    def test_capacity_becomes_beds_total(self):
        migrations.apply(self.engine)
        db = Session(bind=self.engine)
        self.assertEqual(db.get(models.Hospital, 1).beds_total, 14)
        db.close()

    def test_legacy_fleet_count_is_backfilled(self):
        migrations.apply(self.engine)
        db = Session(bind=self.engine)
        hospital = db.get(models.Hospital, 1)
        self.assertEqual(hospital.ambulances_total, 1)
        self.assertEqual(hospital.ambulances_available, 1)
        db.close()

    def test_inserts_work_after_migration(self):
        """The retired NOT NULL column used to make every new hospital fail."""
        migrations.apply(self.engine)
        db = Session(bind=self.engine)
        hospital = models.Hospital(
            code="hosp-new",
            name="Brand New Hospital",
            lat=30.05,
            lon=31.05,
            trauma_level=3,
            ambulances_total=2,
            ambulances_available=2,
            beds_total=8,
            beds_occupied=0,
            current_load=0,
            created_at=datetime.utcnow(),
        )
        db.add(hospital)
        db.commit()
        self.assertIsNotNone(hospital.id)
        db.close()

    def test_migration_is_idempotent(self):
        migrations.apply(self.engine)
        second = migrations.apply(self.engine)
        self.assertEqual(second, [])
        self.assertEqual(Session(bind=self.engine).query(models.Hospital).count(), 1)


class FreshDatabaseTest(unittest.TestCase):
    def test_fresh_database_needs_no_rebuild(self):
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
        models.Base.metadata.create_all(bind=engine)
        self.assertEqual(migrations.apply(engine), [])
        engine.dispose()

    def test_migration_on_fresh_database_allows_inserts(self):
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
        migrations.apply(engine)
        factory = sessionmaker(bind=engine)
        db = factory()
        db.add(
            models.Hospital(
                code="c1",
                name="Fresh",
                lat=30.0,
                lon=31.0,
                trauma_level=1,
                beds_total=4,
                current_load=0,
            )
        )
        db.commit()
        self.assertEqual(db.query(models.Hospital).count(), 1)
        db.close()
        engine.dispose()


if __name__ == "__main__":
    unittest.main()
