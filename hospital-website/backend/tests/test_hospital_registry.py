"""The duplicate-hospitals guarantee.

Every test here is about one property: the same hospital cannot hold two
tenants. If a real hospital signs up twice it must hit an error or a review
queue, never silently get a second fleet and a second admin.
"""

import unittest
from datetime import datetime

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import IntegrityError

from app import models
from app.domain.naming import normalize
from app.services import hospital_registry
from app.services.hospital_seed import SEED_REGISTRY


def session():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    models.Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)(), engine


class NormalizeTest(unittest.TestCase):
    def test_case_and_spacing_fold(self):
        self.assertEqual(normalize("Cairo University Hospital"), normalize("  cairo   UNIVERSITY hospital "))

    def test_punctuation_folds(self):
        self.assertEqual(
            normalize("Dar Al-Fouad Hospital (Cairo)"),
            normalize("Dar Al Fouad Hospital, Cairo"),
        )

    def test_arabic_orthographic_variants_fold(self):
        self.assertEqual(normalize("مستشفى جامعة القاهرة"), normalize("مستشفي جامعه القاهره"))

    def test_arabic_diacritics_are_ignored(self):
        self.assertEqual(normalize("مُسْتَشْفَى القاهرة"), normalize("مستشفى القاهرة"))

    def test_arabic_indic_digits_fold(self):
        self.assertEqual(normalize("مستشفى ٥٧٣٥٧"), normalize("مستشفى 57357"))

    def test_abbreviations_expand(self):
        self.assertEqual(normalize("Cairo Univ. Hospital"), normalize("Cairo University Hospital"))

    def test_different_hospitals_stay_different(self):
        self.assertNotEqual(
            normalize("Mansoura University Hospital"),
            normalize("Cairo University Hospital"),
        )

    def test_nickname_is_not_silently_merged(self):
        """Folding words risks merging a branch with its parent.

        A nickname is not proof of a duplicate, so it must survive
        normalisation and be resolved by a human instead.
        """
        self.assertNotEqual(normalize("Al-Nahra Hospital"), normalize("Nahra Hospital"))

    def test_empty_input(self):
        self.assertEqual(normalize(""), "")


class SeedRegistryTest(unittest.TestCase):
    def setUp(self):
        self.db, self.engine = session()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_seed_is_idempotent(self):
        first = hospital_registry.seed_registry(self.db, SEED_REGISTRY)
        total = self.db.query(models.RegistryHospital).count()
        second = hospital_registry.seed_registry(self.db, SEED_REGISTRY)
        self.assertEqual(second, 0)
        self.assertEqual(self.db.query(models.RegistryHospital).count(), total)
        self.assertTrue(first > 0)

    def test_seeded_rows_have_no_invented_coordinates(self):
        hospital_registry.seed_registry(self.db, SEED_REGISTRY)
        for row in self.db.query(models.RegistryHospital).filter(
            models.RegistryHospital.source == "seed"
        ):
            self.assertIsNone(row.lat)
            self.assertIsNone(row.lon)

    def test_aliases_are_backfilled_on_rerun(self):
        rows = [(name, ar, gov, None) for name, ar, gov, _ in SEED_REGISTRY]
        hospital_registry.seed_registry(self.db, rows)
        target = self.db.query(models.RegistryHospital).filter(
            models.RegistryHospital.name_normalized == normalize("Cairo University Hospital")
        ).one()
        self.assertIsNone(target.aliases)

        hospital_registry.seed_registry(self.db, SEED_REGISTRY)
        self.db.expire_all()
        self.assertIn("kasr el aini", target.aliases.lower())

    def test_coordinates_survive_a_reseed(self):
        hospital_registry.seed_registry(self.db, SEED_REGISTRY)
        target = self.db.query(models.RegistryHospital).filter(
            models.RegistryHospital.name_normalized == normalize("Tanta University Hospital")
        ).one()
        target.lat, target.lon = 30.78, 30.99
        self.db.commit()

        hospital_registry.seed_registry(self.db, SEED_REGISTRY)
        self.db.expire_all()
        self.assertEqual((target.lat, target.lon), (30.78, 30.99))


class SearchTest(unittest.TestCase):
    def setUp(self):
        self.db, self.engine = session()
        hospital_registry.seed_registry(self.db, SEED_REGISTRY)

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_finds_by_official_name(self):
        names = [r.name for r in hospital_registry.search(self.db, "Ain Shams")]
        self.assertIn("Ain Shams University Hospital", names)

    def test_finds_by_alias(self):
        names = [r.name for r in hospital_registry.search(self.db, "kasr el ainy")]
        self.assertEqual(names, ["Cairo University Hospital"])

    def test_finds_by_arabic_name(self):
        names = [r.name for r in hospital_registry.search(self.db, "مستشفى جامعة المنصورة")]
        self.assertIn("Mansoura University Hospital", names)

    def test_finds_by_bare_number(self):
        names = [r.name for r in hospital_registry.search(self.db, "57357")]
        self.assertIn("57357 Children's Cancer Hospital", names)

    def test_unknown_query_returns_nothing(self):
        self.assertEqual(hospital_registry.search(self.db, "zzzz not a hospital"), [])

    def test_short_fragment_does_not_match_everything(self):
        """A loose rule would let a two letter query return the whole list."""
        self.assertEqual(hospital_registry.search(self.db, "ai"), [])

    def test_multiword_query_needs_all_terms(self):
        results = hospital_registry.search(self.db, "qasr al aini")
        self.assertEqual([r.name for r in results], ["Cairo University Hospital"])

    def test_near_miss_returns_little_rather_than_everything(self):
        """"ainy" instead of "aini" is a typo, not a reason to list all of Cairo.

        Fuzzy tolerance for a clipped final word is deliberate, but a
        misspelling should narrow the results, not widen them.
        """
        self.assertLessEqual(len(hospital_registry.search(self.db, "qasr al ainy")), 2)

    def test_governorate_filter(self):
        results = hospital_registry.search(self.db, "", governorate="Luxor")
        self.assertEqual([r.name for r in results], ["Luxor University Hospital"])

    def test_demo_entries_hidden_by_default(self):
        self.db.add(
            models.RegistryHospital(
                name="Riverside Trauma Centre",
                name_normalized=normalize("Riverside Trauma Centre"),
                governorate="Cairo",
                source="demo",
            )
        )
        self.db.commit()
        self.assertNotIn(
            "Riverside Trauma Centre",
            [r.name for r in hospital_registry.search(self.db, "riverside")],
        )
        self.assertIn(
            "Riverside Trauma Centre",
            [r.name for r in hospital_registry.search(self.db, "riverside", include_demo=True)],
        )


class DuplicateGuardTest(unittest.TestCase):
    def setUp(self):
        self.db, self.engine = session()
        hospital_registry.seed_registry(self.db, SEED_REGISTRY)

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def _hospital(self, registry_id):
        entry = self.db.get(models.RegistryHospital, registry_id)
        return models.Hospital(
            code=f"h-{registry_id}",
            name=entry.name,
            lat=entry.lat or 30.0,
            lon=entry.lon or 31.0,
            registry_id=entry.id,
        )

    def test_one_registry_entry_backs_at_most_one_tenant(self):
        entry = self.db.query(models.RegistryHospital).filter(
            models.RegistryHospital.source == "seed"
        ).first()
        self.db.add(self._hospital(entry.id))
        self.db.commit()

        second = self._hospital(entry.id)
        second.code = "another-code"
        self.db.add(second)
        with self.assertRaises(IntegrityError):
            self.db.commit()
        self.db.rollback()

    def test_database_enforces_it_not_just_the_orm(self):
        """The guard has to survive a second process and hand written SQL."""
        entry = self.db.query(models.RegistryHospital).filter(
            models.RegistryHospital.source == "seed"
        ).first()
        self._raw_insert("a", entry.id)
        with self.assertRaises(IntegrityError):
            self._raw_insert("b", entry.id)

    def _raw_insert(self, code, registry_id):
        self.db.execute(
            text(
                "INSERT INTO hospitals (code, name, lat, lon, registry_id, trauma_level, "
                "current_load, ambulances_total, ambulances_available, beds_total, "
                "beds_occupied, created_at) "
                "VALUES (:code, :code, 30.0, 31.0, :rid, 1, 0, 0, 0, 0, 0, :now)"
            ),
            {"code": code, "rid": registry_id, "now": datetime.utcnow()},
        )
        self.db.commit()

    def test_unlinked_hospitals_still_allowed(self):
        """Pre-registry tenants and demo data must keep working."""
        self.db.add(models.Hospital(code="legacy", name="Legacy", lat=30.0, lon=31.0))
        self.db.add(models.Hospital(code="legacy2", name="Legacy Two", lat=30.0, lon=31.0))
        self.db.commit()
        self.assertEqual(
            self.db.query(models.Hospital).filter(models.Hospital.registry_id.is_(None)).count(),
            2,
        )

    def test_tenant_lookup_finds_the_claimant(self):
        entry = self.db.query(models.RegistryHospital).filter(
            models.RegistryHospital.source == "seed"
        ).first()
        hospital = self._hospital(entry.id)
        self.db.add(hospital)
        self.db.commit()
        self.assertEqual(hospital_registry.tenant_for(self.db, entry.id).id, hospital.id)

    def test_same_name_in_another_governorate_is_flagged(self):
        results = hospital_registry.same_name_elsewhere(
            self.db, "Cairo University Hospital", "Giza"
        )
        self.assertIn("Cairo University Hospital", [r.name for r in results])

    def test_nearby_detects_a_relocated_duplicate(self):
        self.db.execute(
            text(
                "UPDATE registry_hospitals SET lat = 30.0444, lon = 31.2357 "
                "WHERE name_normalized = 'cairo university hospital'"
            )
        )
        self.db.commit()
        self.db.expire_all()
        found = hospital_registry.nearby(self.db, 30.0445, 31.2358)
        self.assertIn("Cairo University Hospital", [r.name for r in found])

    def test_nearby_ignores_distant_entries(self):
        self.db.execute(
            text(
                "UPDATE registry_hospitals SET lat = 30.0444, lon = 31.2357 "
                "WHERE name_normalized = 'cairo university hospital'"
            )
        )
        self.db.commit()
        self.db.expire_all()
        self.assertEqual(hospital_registry.nearby(self.db, 22.0, 30.0), [])

    def test_entries_without_coordinates_are_not_nearby(self):
        """A missing coordinate must not read as a match at distance zero."""
        self.assertEqual(hospital_registry.nearby(self.db, 30.0, 31.0), [])


if __name__ == "__main__":
    unittest.main()
