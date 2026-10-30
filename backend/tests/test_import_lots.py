import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.db import Base
from app.models import Lot
from app.services.lots_import import import_lots, parse_hours, zone_for


@pytest.fixture()
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with sessionmaker(bind=engine)() as session:
        yield session


def lots_of(db):
    return db.scalars(select(Lot)).all()


def test_counts_match_dataset(db):
    assert import_lots(db) == 54
    lots = lots_of(db)
    paid = [x for x in lots if x.is_paid]
    assert len(paid) == 39
    assert len(lots) - len(paid) == 15
    assert sum(x.places for x in paid) == 848
    assert sum(x.places_disabled for x in paid) == 112
    assert len([x for x in paid if x.operator_name == 'КП "Міськшеп"']) == 26
    assert len({x.operator_name for x in paid} - {'КП "Міськшеп"'}) == 7


def test_every_lot_has_coordinates_in_chernivtsi(db):
    import_lots(db)
    for lot in lots_of(db):
        assert 48.2 < lot.lat < 48.4 and 25.8 < lot.lon < 26.1, lot.id
        assert lot.points


def test_import_is_idempotent(db):
    import_lots(db)
    first = {x.id: (x.address, x.lat, x.lon) for x in lots_of(db)}
    import_lots(db)
    assert {x.id: (x.address, x.lat, x.lon) for x in lots_of(db)} == first


def test_row_38_split_coordinates_fixed(db):
    import_lots(db)
    lot = next(x for x in lots_of(db) if 38 in x.source_ids)
    assert lot.geo_fixed == "split_field"
    assert lot.source_ids == [38, 51]  # згруповано з #51: lot.lat/lon — центроїд, тож дивимось у points
    assert any(p == pytest.approx([48.270865148332554, 25.940213557783256]) for p in lot.points)


def test_rows_65_66_geocoded(db):
    import_lots(db)
    lot = next(x for x in lots_of(db) if 65 in x.source_ids)
    assert lot.source_ids == [65, 66]
    assert lot.geo_fixed == "geocoded"
    assert lot.places == 23  # 10 + 13


def test_free_lots_have_no_tariff(db):
    import_lots(db)
    for lot in (x for x in lots_of(db) if not x.is_paid):
        assert lot.tariff_per_hour is None and lot.zone is None and lot.operator_name is None


def test_zones_derived_from_price(db):
    assert zone_for(20) == "center"
    assert zone_for(15) == "standard" and zone_for(10) == "standard"
    assert zone_for(5) == "market" and zone_for(3) == "market"
    assert zone_for(None) is None
    import_lots(db)
    for lot in (x for x in lots_of(db) if x.is_paid):
        assert lot.zone == zone_for(lot.tariff_per_hour)


def test_miskshep_hours_weekdays_9_to_19(db):
    import_lots(db)
    for lot in (x for x in lots_of(db) if x.operator_name == 'КП "Міськшеп"'):
        assert lot.opening_hours == {"days": [1, 2, 3, 4, 5], "from": "09:00", "to": "19:00"}


def test_parse_hours():
    assert parse_hours("2,3,4,5,6,7; 06:00-16:00") == {"days": [2, 3, 4, 5, 6, 7], "from": "06:00", "to": "16:00"}
    assert parse_hours("null") is None
