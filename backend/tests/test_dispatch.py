import pytest

from app.config import settings
from app.sim import dispatch


def test_formula_matches_abouts_example():
    # ABOUT §6.2: центр, 10 авто × 35% неоплати = 3,5 авто без оплати × штраф 400 грн × 0,63 ≈ 882 грн
    assert dispatch.expected_benefit(10, 0.35, 20, fine_prob=0.63) == pytest.approx(882.0)
    # стандарт: 4 авто × 20% × (20 × 10) × 0,63 ≈ 100,8
    assert dispatch.expected_benefit(4, 0.20, 10, fine_prob=0.63) == pytest.approx(100.8)


def test_decide_threshold():
    assert dispatch.decide(882, trip_cost=200) == "go"
    assert dispatch.decide(101, trip_cost=200) == "route"
    assert dispatch.decide(200, trip_cost=200) == "route"   # рівно на межі — не їхати окремо


def test_unpaid_share_is_deterministic_and_in_range():
    a = dispatch.unpaid_share(7, "center", 1)
    assert a == dispatch.unpaid_share(7, "center", 1)
    assert a != dispatch.unpaid_share(8, "center", 1)
    assert 0 < a < 1


def test_zone_means_are_about_right():
    for zone, mean in dispatch.UNPAID_MEAN.items():
        avg = sum(dispatch.unpaid_share(i, zone, 31102026) for i in range(300)) / 300
        assert abs(avg - mean) < 0.05, zone


def test_endpoint_shape_and_sorting(client):
    d = client.get("/api/stats/dispatch").json()
    assert d["is_simulated"] is True
    assert len(d["rows"]) == 39                                   # усі платні лоти
    b = [r["expected_benefit_uah"] for r in d["rows"]]
    assert b == sorted(b, reverse=True)
    assert d["go_count"] + d["route_count"] == 39
    assert d["go_count"] > 0 and d["route_count"] > 0             # на демо є обидва рішення
    assert d["assumptions"]["trip_cost_uah"] == 200


def test_endpoint_decision_matches_trip_cost(client):
    for r in client.get("/api/stats/dispatch").json()["rows"]:
        assert (r["decision"] == "go") == (r["expected_benefit_uah"] > settings.TRIP_COST_UAH)
        assert r["fine_uah"] == 20 * r["tariff_per_hour"]
        assert 0 <= r["cars"] <= r["places"]


def test_endpoint_is_stable(client):
    assert client.get("/api/stats/dispatch").json() == client.get("/api/stats/dispatch").json()


def test_endpoint_does_not_depend_on_real_sessions(client):
    before = client.get("/api/stats/dispatch").json()
    client.post("/api/demo/reset", headers={"X-Demo-Token": "test-token"})
    lot = next(x for x in client.get("/api/lots").json() if x["zone"] == "center")
    client.post("/api/sessions", json={"plate": "AA 1234 BB", "lot_id": lot["id"]})
    assert client.get("/api/stats/dispatch").json() == before     # симуляція не змінюється від реальних сесій
