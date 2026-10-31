import pytest

from app.config import settings


@pytest.fixture()
def dist(tmp_path, monkeypatch):
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text("<html>VILNO SPA</html>")
    (tmp_path / "assets" / "app-abc123.js").write_text("console.log(1)")
    (tmp_path / "favicon.svg").write_text("<svg/>")
    (tmp_path.parent / "secret.txt").write_text("не віддавати")
    monkeypatch.setattr(settings, "FRONTEND_DIST", str(tmp_path))
    return tmp_path


@pytest.mark.parametrize("path", ["/", "/driver", "/inspector", "/city", "/driver/anything"])
def test_spa_routes_serve_index(client, dist, path):
    r = client.get(path)
    assert r.status_code == 200 and "VILNO SPA" in r.text
    assert r.headers["cache-control"] == "no-cache"


def test_assets_served_with_long_cache(client, dist):
    r = client.get("/assets/app-abc123.js")
    assert r.status_code == 200 and r.text == "console.log(1)"
    assert "immutable" in r.headers["cache-control"]
    assert client.get("/favicon.svg").text == "<svg/>"


def test_api_not_swallowed_by_spa(client, dist):
    assert client.get("/api/lots").status_code == 200
    r = client.get("/api/nope")
    assert r.status_code == 404 and r.headers["content-type"].startswith("application/json")
    assert client.post("/api/sessions", json={}).status_code == 422


def test_no_path_traversal(client, dist):
    for p in ["/../secret.txt", "/assets/../../secret.txt", "/%2e%2e/secret.txt"]:
        r = client.get(p)
        assert "не віддавати" not in r.text


def test_missing_build_is_404_not_500(client, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "FRONTEND_DIST", str(tmp_path / "nope"))
    assert client.get("/driver").status_code == 404
