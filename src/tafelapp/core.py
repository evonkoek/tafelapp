"""Rekenlogica van TafelApp. Draait lokaal (pytest) en in de browser (Pyodide)."""

import json
import random

MAX_FACTOR = 10
MAX_NAAM = 20


def maak_vragen(tafels, aantal=10):
    """Geef `aantal` sommen [a, b] terug voor de gekozen tafels.

    Binnen een ronde komt elke som zo lang mogelijk maar één keer voor.
    De volgorde van de factoren wordt willekeurig omgedraaid (7 x 8 of 8 x 7).
    """
    tafels = sorted({int(t) for t in tafels if 1 <= int(t) <= MAX_FACTOR}) or [2]
    aantal = max(1, int(aantal))
    vragen = []
    while len(vragen) < aantal:
        pool = [(t, n) for t in tafels for n in range(1, MAX_FACTOR + 1)]
        random.shuffle(pool)
        vragen.extend(pool)
    vragen = vragen[:aantal]
    return [[a, b] if random.random() < 0.5 else [b, a] for a, b in vragen]


def controleer(a, b, antwoord):
    """True als `antwoord` (tekst of getal) gelijk is aan a x b."""
    try:
        return int(str(antwoord).strip()) == int(a) * int(b)
    except ValueError:
        return False


def beoordeling(goed, totaal):
    """Korte aanmoediging op basis van het percentage goed."""
    totaal = max(1, int(totaal))
    pct = int(goed) / totaal
    if pct == 1:
        return "Perfect! Alles goed!"
    if pct >= 0.8:
        return "Heel goed gedaan!"
    if pct >= 0.6:
        return "Goed bezig, blijf oefenen!"
    return "Oefening baart kunst. Probeer het nog eens!"


def speler_id(naam):
    """Geef [nette naam, sleutel] terug. Sleutel is leeg als er geen naam is.

    'anna', ' Anna ' en 'ANNA' zijn dezelfde speler.
    """
    netjes = " ".join(str(naam).split())[:MAX_NAAM]
    return [netjes, netjes.casefold()]


def _gemiddelde(waarden):
    return sum(waarden) / len(waarden)


def statistieken(resultaten_json):
    """Samenvatting van alle rondes van één speler.

    `resultaten_json` is een JSON-lijst met objecten {"goed": int, "totaal": int, ...}
    in volgorde van oud naar nieuw.
    """
    resultaten = json.loads(resultaten_json) if resultaten_json else []
    percentages = [
        round(100 * int(r["goed"]) / max(1, int(r["totaal"]))) for r in resultaten
    ]
    if not percentages:
        return {
            "rondes": 0, "gemiddelde": 0, "beste": 0, "laatste": 0,
            "percentages": [], "trend": "Speel een ronde om je voortgang te zien.",
        }

    if len(percentages) < 2:
        trend = "Speel nog een ronde om je voortgang te zien."
    else:
        if len(percentages) >= 4:
            recent, eerder = _gemiddelde(percentages[-3:]), _gemiddelde(percentages[:-3])
        else:
            recent, eerder = percentages[-1], _gemiddelde(percentages[:-1])
        verschil = recent - eerder
        if verschil >= 5:
            trend = "Je gaat vooruit! Ga zo door."
        elif verschil <= -5:
            trend = "Iets lager dan eerst. Even doorzetten, het komt goed!"
        else:
            trend = "Je scores blijven stabiel."

    return {
        "rondes": len(percentages),
        "gemiddelde": round(_gemiddelde(percentages)),
        "beste": max(percentages),
        "laatste": percentages[-1],
        "percentages": percentages,
        "trend": trend,
    }


LOF = ["Goed zo!", "Lekker bezig!", "Bamboe-top!", "Panda-proof!", "Geweldig!", "Yes!", "Knap hoor!"]
LOF_REEKS = {
    3: "Drie op een rij!",
    5: "Vijf op een rij, wat een panda-power!",
    10: "TIEN op een rij! Superpanda!",
}
TROOST = [
    "Bijna! Panda gelooft in je.",
    "Oeps! Van fouten leer je.",
    "Net niet, je kunt het!",
    "Niet erg, de volgende lukt vast.",
]


def lof(reeks):
    """Een vrolijke complimentzin; bij bijzondere reeksen een extra groot compliment."""
    return LOF_REEKS.get(int(reeks)) or random.choice(LOF)


def troost():
    """Een bemoedigende zin na een fout antwoord."""
    return random.choice(TROOST)


def sterren(goed, totaal):
    """Aantal sterren (1 t/m 3) voor een afgeronde ronde."""
    pct = int(goed) / max(1, int(totaal))
    return 3 if pct >= 0.9 else 2 if pct >= 0.7 else 1
