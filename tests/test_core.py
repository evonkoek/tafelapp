import json

from tafelapp.core import (
    beoordeling,
    controleer,
    maak_vragen,
    speler_id,
    statistieken,
)


def test_maak_vragen_aantal_en_tafels():
    vragen = maak_vragen([7], 10)
    assert len(vragen) == 10
    assert all(7 in v for v in vragen)
    assert all(1 <= min(v) and max(v) <= 10 for v in vragen)


def test_meer_vragen_dan_pool():
    assert len(maak_vragen([5], 25)) == 25


def test_ongeldige_tafels_vallen_terug_op_2():
    assert all(2 in v for v in maak_vragen([], 5))


def test_controleer():
    assert controleer(7, 8, "56")
    assert controleer(7, 8, " 56 ")
    assert not controleer(7, 8, "54")
    assert not controleer(7, 8, "")
    assert not controleer(7, 8, "abc")


def test_beoordeling():
    assert "Perfect" in beoordeling(10, 10)
    assert "nog eens" in beoordeling(2, 10)


def test_speler_id():
    assert speler_id("  Anna  ") == ["Anna", "anna"]
    assert speler_id("ANNA")[1] == "anna"
    assert speler_id("   ") == ["", ""]
    assert len(speler_id("x" * 50)[0]) == 20


def test_statistieken_leeg():
    s = statistieken("[]")
    assert s["rondes"] == 0 and s["percentages"] == []


def test_statistieken_basis():
    data = [{"goed": 5, "totaal": 10}, {"goed": 8, "totaal": 10}]
    s = statistieken(json.dumps(data))
    assert s["rondes"] == 2
    assert s["gemiddelde"] == 65 or s["gemiddelde"] == 66  # 50 en 80 -> 65
    assert s["beste"] == 80 and s["laatste"] == 80
    assert "vooruit" in s["trend"]


def test_statistieken_trend_lager_en_stabiel():
    lager = [{"goed": 9, "totaal": 10}] * 3 + [{"goed": 5, "totaal": 10}] * 3
    assert "lager" in statistieken(json.dumps(lager))["trend"]
    stabiel = [{"goed": 7, "totaal": 10}] * 5
    assert "stabiel" in statistieken(json.dumps(stabiel))["trend"]


def test_lof_troost_sterren():
    from tafelapp.core import LOF, TROOST, lof, sterren, troost

    assert lof(1) in LOF
    assert "rij" in lof(3)
    assert troost() in TROOST
    assert sterren(10, 10) == 3
    assert sterren(8, 10) == 2
    assert sterren(2, 10) == 1
