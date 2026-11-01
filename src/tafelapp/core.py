"""Rekenlogica van TafelApp. Draait lokaal (pytest) en in de browser (Pyodide)."""

import random

MAX_FACTOR = 10


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
