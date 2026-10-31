from app.sim.occupancy import occupancy, simulated_busy


def test_lots_endpoint(client):
    r = client.get("/api/lots")
    assert r.status_code == 200
    lots = r.json()
    assert len(lots) == 54
    paid = [x for x in lots if x["is_paid"]]
    assert len(paid) == 39


def test_free_estimate_only_for_paid_and_within_places(client):
    for lot in client.get("/api/lots").json():
        if not lot["is_paid"]:
            assert lot["free_estimate"] is None
        else:
            assert 0 <= lot["free_estimate"] <= lot["places"]
            assert lot["free_estimate"] + lot["sim_busy"] == lot["places"]


def test_free_estimate_is_stable_between_calls(client):
    a = client.get("/api/lots").json()
    b = client.get("/api/lots").json()
    assert [x["free_estimate"] for x in a] == [x["free_estimate"] for x in b]


def test_lot_404(client):
    assert client.get("/api/lots/99999").status_code == 404


def test_occupancy_deterministic_and_bounded():
    assert occupancy(5, 31102026) == occupancy(5, 31102026)
    assert occupancy(5, 31102026) != occupancy(6, 31102026)
    assert 0.2 <= occupancy(7, 1) <= 1.0
    assert simulated_busy(1, None, 1) is None
    assert 0 <= simulated_busy(1, 10, 1) <= 10


def test_sim_profile_gives_mix_of_free_and_full(client):
    """Демо-мапа: серед платних лотів є і з вільними місцями, і повністю зайняті (через SIM_OCC_*, не хардкод)."""
    paid = [x for x in client.get("/api/lots").json() if x["is_paid"]]
    assert any(x["free_estimate"] == 0 for x in paid)
    assert sum(x["free_estimate"] > 0 for x in paid) > len(paid) // 2


def test_open_now_follows_server_clock(client):
    """Демо-час: пʼятниця 14:00. Лот 38 (Вт–Нд 09–17) відкритий, безкоштовні мають None."""
    lots = {x["id"]: x for x in client.get("/api/lots").json()}
    assert lots[38]["open_now"] is True
    assert lots[1]["open_now"] is None


def test_streets_endpoint_returns_dict(client):
    r = client.get("/api/streets")
    assert r.status_code == 200
    assert isinstance(r.json(), dict)
