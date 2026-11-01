from tafelapp.core import beoordeling, controleer, maak_vragen


def test_maak_vragen_aantal_en_tafels():
    vragen = maak_vragen([7], 10)
    assert len(vragen) == 10
    assert all(7 in v for v in vragen)
    assert all(1 <= min(v) and max(v) <= 10 for v in vragen)


def test_geen_dubbelen_zolang_pool_groot_genoeg():
    vragen = maak_vragen([3, 4], 20)  # 20 unieke sommen mogelijk
    assert len({tuple(sorted(v)) if v[0] != v[1] else tuple(v) for v in vragen}) >= 1
    assert len(vragen) == 20


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
