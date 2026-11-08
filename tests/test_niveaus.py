import json

from tafelapp.core import opties, overzicht


def test_opties():
    for a in range(1, 11):
        for b in range(1, 11):
            o = opties(a, b)
            assert len(o) == 4 and len(set(o)) == 4
            assert a * b in o and all(x > 0 for x in o)


def test_overzicht_ontgrendelen():
    ov = overzicht("{}")
    assert [l["open"] for l in ov["7"]] == [True, False, False, False, False]
    l = overzicht(json.dumps({"7": {"1": 80, "2": 50}}))["7"]
    assert l[0]["gehaald"] and l[1]["open"] and not l[1]["gehaald"] and not l[2]["open"]
    assert not l[3]["beschikbaar"] and not l[4]["open"]
