"""Revantage European ESG portfolio: deterministic generator for the shared `properties` table and UJ1
(quarterly tenant ESG survey) tables.

Stdlib only, one seed, no I/O side effects unless --out is given. The same generator feeds the Delta
starting state (setup job) and the Lakebase response history (lakebase_setup job), so both always agree.

    python3 code/data-gen/generate.py --out /tmp/esg      # writes <table>.json + facts.json, runs asserts
    python3 code/data-gen/generate.py --facts             # prints the planted facts

Planted facts (asserted in `check_facts`, numbers in the workshop data contract):
  F1 Castellana Tower (6) has the lowest Energy & carbon and Indoor comfort scores in every campaign, and
     its free text keeps mentioning HVAC / air conditioning / temperature.
  F2 Amstel Logistics Park (1): LED retrofit + rooftop solar went live in March 2026; Energy & carbon
     climbs every quarter from 2025-Q4 to 2026-Q4, and its free text switches from complaints to praise.
  F3 Vltava Business Centre (4) has by far the lowest completion rate.
  F4 2026-Q4 is open (today is 2026-11-05) and only about half complete, so "not completed" is a real list.
  F5 Docklands Studios (8) has the highest overall satisfaction.
"""
from __future__ import annotations

import argparse
import json
import random
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

SEED = 20261105
AS_OF = datetime(2026, 11, 5, 7, 30, tzinfo=timezone.utc)  # "now" for the seeded history (before the workshop)

# --------------------------------------------------------------------------------------------------
# Shared dimension: properties (ids and names fixed in plan.md; UJ2 depends on them)
# --------------------------------------------------------------------------------------------------
PROPERTIES = [
    # id, name, city, country, type, currency, invoice_language, gfa m2, year_built, epc, certification
    (1, "Amstel Logistics Park", "Amsterdam", "NL", "Logistics", "EUR", "NL/EN", 48500, 2008, "B", "BREEAM Very Good"),
    (2, "Rhine Gate Offices", "Frankfurt", "DE", "Office", "EUR", "DE", 32000, 2015, "A", "LEED Gold"),
    (3, "Lumière Residences", "Lyon", "FR", "Residential", "EUR", "FR", 18400, 2012, "C", "none"),
    (4, "Vltava Business Centre", "Prague", "CZ", "Office", "CZK", "CS/EN", 22600, 2004, "C", "BREEAM Good"),
    (5, "Øresund Distribution Hub", "Malmö", "SE", "Logistics", "SEK", "SV", 41200, 2018, "A", "BREEAM Excellent"),
    (6, "Castellana Tower", "Madrid", "ES", "Office", "EUR", "ES", 38900, 1998, "D", "none"),
    (7, "Grand Rue Retail Quarter", "Luxembourg", "LU", "Retail", "EUR", "FR/DE", 15300, 2010, "B", "BREEAM Very Good"),
    (8, "Docklands Studios", "Dublin", "IE", "Office", "EUR", "EN", 12800, 2019, "A", "LEED Platinum"),
    (9, "Porta Nord Campus", "Milan", "IT", "Mixed-use", "EUR", "IT", 27500, 2016, "B", "LEED Gold"),
    (10, "Vistula Logistics Centre", "Warsaw", "PL", "Logistics", "PLN", "PL", 36700, 2011, "C", "BREEAM Good"),
]

# --------------------------------------------------------------------------------------------------
# Tenants (45) and their contacts (60): hand-written so names fit the city and sector
# --------------------------------------------------------------------------------------------------
# property_id -> [(tenant_name, sector, leased_area_sqm, lease_start, [contact (first, last, title), ...]), ...]
TENANTS = {
    1: [("Amstel Freight Services B.V.", "Logistics & freight", 14200, "2016-03-01",
         [("Joost", "de Vries", "Site Manager"), ("Femke", "Bakker", "Sustainability Lead")]),
        ("NordCool Foods B.V.", "Cold-chain food distribution", 11800, "2019-07-01", [("Sander", "Visser", "Operations Director")]),
        ("Brightline E-commerce Fulfilment", "E-commerce", 9600, "2021-01-01", [("Lotte", "Jansen", "Facilities Coordinator")]),
        ("Holland Parts Distribution", "Automotive parts", 6400, "2018-05-01", [("Ruben", "Mulder", "Warehouse Manager")]),
        ("GreenRoute Last Mile", "Urban delivery", 3200, "2023-09-01", [("Anouk", "Smit", "Fleet & Facilities Manager")])],
    2: [("Mainfeld Capital AG", "Asset management", 9800, "2016-01-01",
         [("Katrin", "Hoffmann", "Head of Workplace"), ("Lukas", "Schneider", "Office Manager")]),
        ("Rheinwerk Consulting GmbH", "Management consulting", 7200, "2017-04-01", [("Julia", "Wagner", "Office Manager")]),
        ("Taunus Digital GmbH", "Software", 6100, "2020-10-01", [("Felix", "Becker", "COO"), ("Miriam", "Fischer", "ESG Analyst")]),
        ("Hessische Versicherungsmakler", "Insurance brokerage", 4300, "2018-02-01", [("Sabine", "Koch", "Facility Manager")])],
    3: [("Lumière Living Services", "Residential operator", 12600, "2012-09-01",
         [("Camille", "Laurent", "Residence Director"), ("Hugo", "Moreau", "Resident Services Manager")]),
        ("Boulangerie Saint-Jean", "Food retail", 240, "2014-03-01", [("Élodie", "Girard", "Owner")]),
        ("Crèche Les Petits Lyonnais", "Childcare", 680, "2016-09-01", [("Manon", "Roux", "Director")]),
        ("Pharmacie de la Confluence", "Pharmacy", 310, "2013-06-01", [("Thomas", "Fournier", "Pharmacist & Manager")]),
        ("Atelier Vélo Lyon", "Bicycle repair", 190, "2022-04-01", [("Léa", "Bonnet", "Co-founder")])],
    4: [("Moldau Software s.r.o.", "Software", 6800, "2015-05-01",
         [("Jakub", "Novák", "Office Manager"), ("Tereza", "Svobodová", "HR Director")]),
        ("Bohemia Accounting Partners", "Accounting", 4100, "2012-01-01", [("Petr", "Dvořák", "Managing Partner")]),
        ("Pražská Energetická Poradna", "Energy consulting", 2900, "2019-03-01", [("Lucie", "Černá", "Operations Manager")]),
        ("Centrum Medical Clinic", "Healthcare", 3500, "2017-11-01",
         [("Martin", "Procházka", "Clinic Administrator"), ("Eva", "Kučerová", "Facilities Officer")])],
    5: [("Øresund Logistics AB", "Logistics & freight", 15600, "2018-09-01",
         [("Erik", "Lindqvist", "Terminal Manager"), ("Sara", "Johansson", "Sustainability Manager")]),
        ("Skåne Pharma Distribution", "Pharmaceutical distribution", 9300, "2019-02-01", [("Oskar", "Nilsson", "Site Director"), ("Maja", "Karlsson", "Quality & EHS Lead")]),
        ("Nordic Home Retail AB", "Home retail", 8700, "2020-06-01", [("Elin", "Andersson", "Logistics Manager")]),
        ("Baltic Sea Parcel AB", "Parcel delivery", 5200, "2022-01-01", [("Johan", "Persson", "Hub Manager")])],
    6: [("Banco Meseta S.A.", "Banking", 11200, "2005-01-01",
         [("Javier", "García López", "Head of Facilities"), ("Lucía", "Martínez Ruiz", "Workplace Experience Lead")]),
        ("Iberia Legal Abogados", "Law firm", 6800, "2010-04-01", [("Carmen", "Sánchez", "Office Manager")]),
        ("Solaria Media Group", "Media", 5100, "2014-09-01", [("Pablo", "Fernández", "COO")]),
        ("Madrid Tech Hub S.L.", "Coworking", 4600, "2019-01-01", [("Marta", "Gómez", "Community Manager")]),
        ("Consultores Castellana", "Engineering consulting", 3900, "2016-06-01", [("Diego", "Romero", "Office Manager")])],
    7: [("Maison Moselle Mode", "Fashion retail", 2600, "2013-03-01",
         [("Claire", "Weber", "Store Manager"), ("Marc", "Schmit", "Regional Operations Manager")]),
        ("Épicerie Fine du Grand-Duché", "Food retail", 1400, "2015-10-01", [("Sophie", "Muller", "Owner"), ("Jean", "Reuter", "Deputy Manager")]),
        ("Lux Optique", "Optician", 480, "2018-04-01", [("Paul", "Hoffmann", "Store Manager")]),
        ("Café Kirchberg & Co", "Café", 360, "2021-05-01", [("Laura", "Thill", "Manager")])],
    8: [("Liffey Games Studio", "Game development", 4200, "2019-09-01",
         [("Aoife", "Murphy", "Studio Operations Manager"), ("Ciarán", "O'Brien", "Head of People")]),
        ("Docklands Fintech Ltd", "Fintech", 3600, "2020-02-01", [("Siobhán", "Kelly", "Office Manager")]),
        ("Grand Canal Analytics", "Data analytics", 2400, "2021-06-01", [("Conor", "Walsh", "COO")]),
        ("Emerald Health Tech", "Health technology", 1500, "2022-03-01", [("Niamh", "Byrne", "Facilities Lead")]),
        ("Ringsend Architects", "Architecture", 900, "2019-11-01", [("Darragh", "Ryan", "Partner")])],
    9: [("Lombardia Design Srl", "Design studio", 5300, "2016-09-01",
         [("Giulia", "Rossi", "Studio Manager"), ("Marco", "Bianchi", "Facility Manager")]),
        ("Banca Navigli", "Banking", 7600, "2017-01-01", [("Francesca", "Colombo", "Head of Real Estate")]),
        ("Porta Nord Fitness", "Fitness", 1800, "2018-05-01", [("Luca", "Ferrari", "Club Manager")]),
        ("Milano Biotech SpA", "Life sciences", 6200, "2020-01-01", [("Chiara", "Esposito", "EHS Manager")]),
        ("Trattoria del Campus", "Restaurant", 420, "2019-03-01", [("Andrea", "Ricci", "Owner")])],
    10: [("Vistula Freight Sp. z o.o.", "Logistics & freight", 13400, "2012-04-01",
          [("Piotr", "Kowalski", "Warehouse Director"), ("Anna", "Nowak", "Health & Safety Manager")]),
         ("Mazovia Retail Distribution", "Retail distribution", 10100, "2014-08-01", [("Tomasz", "Wiśniewski", "Operations Manager"), ("Agnieszka", "Lewandowska", "CSR Coordinator")]),
         ("Polska Auto Parts", "Automotive parts", 7300, "2017-02-01", [("Katarzyna", "Wójcik", "Site Manager")]),
         ("Warsaw Cold Store", "Cold storage", 4800, "2020-10-01", [("Michał", "Kamiński", "Facilities Manager")])],
}

# --------------------------------------------------------------------------------------------------
# Survey questions: 8 Likert (1 = strongly disagree … 5 = strongly agree) + 3 free text
# --------------------------------------------------------------------------------------------------
QUESTIONS = [
    (1, "likert", "Energy & carbon", "The building's energy efficiency and carbon performance meet our expectations."),
    (2, "likert", "Indoor comfort", "Temperature, air quality and ventilation in our space are comfortable all year round."),
    (3, "likert", "Waste & recycling", "Waste separation and recycling facilities are easy to use and well maintained."),
    (4, "likert", "Water", "Water is used efficiently in the building (efficient fixtures, leaks fixed quickly)."),
    (5, "likert", "Sustainable transport", "There are good options for sustainable commuting (bike storage, EV charging, public transport)."),
    (6, "likert", "Wellbeing", "The building supports the health and wellbeing of our people (daylight, green space, amenities)."),
    (7, "likert", "Communication", "Revantage keeps us well informed about the building's ESG initiatives and performance."),
    (8, "likert", "Overall satisfaction", "Overall, we are satisfied with the sustainability of this building."),
    (9, "text", "Improvement", "What is the one thing we could do to improve the sustainability or comfort of the building?"),
    (10, "text", "Recent changes", "Have you noticed any recent changes in the building (good or bad)? Please tell us about them."),
    (11, "text", "Collaboration", "Would your organisation like to take part in a green-lease or energy-saving initiative with us? Tell us more."),
]
THEMES = [q[2] for q in QUESTIONS if q[1] == "likert"]

CAMPAIGNS = ["2025-Q4", "2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4"]
OPEN_CAMPAIGN = "2026-Q4"


def quarter_start(cid: str) -> date:
    y, q = cid.split("-Q")
    return date(int(y), 3 * (int(q) - 1) + 1, 1)


# --------------------------------------------------------------------------------------------------
# Score model: base[property][theme] + campaign trend + respondent bias + noise, rounded and clipped
# --------------------------------------------------------------------------------------------------
BASE = 3.7
PROPERTY_THEME_BASE = {
    # Castellana Tower: 1998 tower, EPC D, failing HVAC -> very low energy and comfort (F1)
    6: {"Energy & carbon": 2.0, "Indoor comfort": 1.8, "Wellbeing": 2.9, "Overall satisfaction": 2.6,
        "Communication": 3.1, "Water": 3.3, "Waste & recycling": 3.4, "Sustainable transport": 3.9},
    # Amstel: energy handled by TREND below; transport weak (out-of-town logistics park)
    1: {"Energy & carbon": None, "Sustainable transport": 2.9, "Indoor comfort": 3.4},
    2: {"Energy & carbon": 4.0, "Indoor comfort": 3.9, "Sustainable transport": 4.3, "Communication": 3.9},
    3: {"Waste & recycling": 3.0, "Wellbeing": 4.0, "Sustainable transport": 4.2},
    # Vltava: older building, little communication -> mediocre, and few people answer (F3)
    4: {"Energy & carbon": 3.1, "Indoor comfort": 3.4, "Communication": 2.5, "Overall satisfaction": 3.1},
    5: {"Energy & carbon": 4.1, "Water": 4.0, "Sustainable transport": 3.3},
    7: {"Waste & recycling": 2.9, "Sustainable transport": 4.0, "Communication": 3.8},
    # Docklands Studios: new LEED Platinum building -> best overall (F5)
    8: {"Energy & carbon": 4.4, "Indoor comfort": 4.3, "Wellbeing": 4.6, "Overall satisfaction": 4.6,
        "Communication": 4.3, "Sustainable transport": 4.5, "Water": 4.1, "Waste & recycling": 4.2},
    9: {"Wellbeing": 4.1, "Sustainable transport": 4.1},
    10: {"Energy & carbon": 3.2, "Indoor comfort": 3.0, "Sustainable transport": 2.8, "Waste & recycling": 3.5},
}
# Amstel Energy & carbon by campaign (F2): solar + LED live March 2026
AMSTEL_ENERGY = {"2025-Q4": 2.3, "2026-Q1": 2.9, "2026-Q2": 3.6, "2026-Q3": 4.0, "2026-Q4": 4.4}
AMSTEL_OVERALL = {"2025-Q4": 3.1, "2026-Q1": 3.3, "2026-Q2": 3.7, "2026-Q3": 3.9, "2026-Q4": 4.1}
# Castellana gets slightly worse in summer (Q3) when cooling fails
CASTELLANA_SEASON = {"2025-Q4": 0.0, "2026-Q1": 0.1, "2026-Q2": -0.1, "2026-Q3": -0.4, "2026-Q4": -0.1}

# Completed responses per property per campaign (out of the property's 6 contacts): exact counts.
# Vltava (4) answers far less (F3); 2026-Q4 is still open, so about half have answered (F4).
COMPLETIONS = {
    #          2025-Q4 2026-Q1 2026-Q2 2026-Q3 2026-Q4
    1: (5, 5, 5, 6, 4),
    2: (5, 4, 5, 5, 3),
    3: (4, 5, 4, 5, 3),
    4: (2, 2, 1, 2, 1),
    5: (5, 5, 6, 5, 4),
    6: (6, 5, 6, 6, 4),
    7: (4, 4, 5, 4, 2),
    8: (6, 5, 5, 6, 5),
    9: (5, 5, 4, 5, 3),
    10: (4, 5, 5, 4, 2),
}

# --------------------------------------------------------------------------------------------------
# Free text pools (English). {floor} etc. filled per respondent for variety.
# --------------------------------------------------------------------------------------------------
HVAC_IMPROVE = [
    "Fix the HVAC. On floor {floor} it is either freezing in the morning or far too warm after lunch.",
    "Please sort out the air conditioning. Our meeting rooms on floor {floor} regularly reach 27°C in the afternoon.",
    "The temperature control is the number one issue. We have logged {n} tickets about the HVAC this quarter.",
    "Better climate control. The heating and cooling seem to fight each other and nobody can adjust it locally.",
    "Replace the old HVAC system. Our people bring cardigans in July and fans in October.",
    "Ventilation and temperature. The air feels stuffy by 3 pm and the thermostats on floor {floor} do nothing.",
    "Invest in the cooling plant. When the AC trips, the south side of floor {floor} becomes unusable.",
    "Balance the air handling. Some desks are under a cold draught, others are hot and airless.",
]
HVAC_RECENT = [
    "The HVAC 'optimisation' over the summer made no difference to the temperature on floor {floor}.",
    "Air conditioning broke down twice in {month}, we had to send staff home one afternoon.",
    "Engineers were here several times about the heating, but the temperature swings are still there.",
    "The new thermostat panels look nice, but the temperature still swings between 19 and 27 degrees.",
    "Noticed more noise from the air handling units on the roof, and it still isn't cooler.",
    "Energy bills went up while comfort went down. The HVAC seems to run all night.",
]
AMSTEL_BEFORE = [
    "The warehouse lighting is old and stays on all night, it feels like a huge waste of energy.",
    "Install solar on the roofs. We have huge flat roofs and our energy bills keep rising.",
    "Replace the old sodium lights in the halls with LED and add motion sensors.",
    "We would like to see the building's energy use, today we have no data at all.",
    "Our carbon reporting needs better energy data from the landlord, and a plan to reduce it.",
]
AMSTEL_AFTER = [
    "The new LED lighting in the halls is a big improvement: brighter and it switches off when nobody is there.",
    "Great to see the rooftop solar panels live. Our share of green electricity now shows up in our CSRD report.",
    "Since the LED retrofit and solar, our energy cost per pallet has visibly dropped.",
    "The energy dashboard you shared after the solar installation is really useful for our sustainability team.",
    "Solar on the roof and LED inside: finally a logistics park we can be proud of. Next step: EV chargers for vans?",
    "Lighting is much better since the retrofit. Could we get sub-metering per unit next?",
]
AMSTEL_RECENT_AFTER = [
    "Rooftop solar went live in March and the LED retrofit is finished. Very positive change.",
    "The solar installation and new LED lights. Our staff noticed the better light quality straight away.",
    "We saw the solar generation figures in the quarterly newsletter. Good to see real numbers.",
]
COMMS_COMPLAINTS = [
    "We rarely hear from building management about sustainability. A short quarterly update would help.",
    "Nobody told us about the energy works last month. Please communicate planned changes earlier.",
    "We don't know what the building's energy rating or targets are. Share them with tenants.",
    "Communication could be much better, we only find out about changes when something stops working.",
]
GENERIC_IMPROVE = {
    "Waste & recycling": [
        "More recycling bins on each floor, and clearer signs on what goes where.",
        "A separate stream for food waste and coffee cups would help a lot.",
        "The waste room is often overflowing on Fridays, please increase collections.",
        "Add a collection point for e-waste and batteries.",
    ],
    "Water": [
        "The taps in the washrooms run for too long, sensor taps would save water.",
        "There was a leak in the kitchen on floor {floor} that took two weeks to fix.",
        "Consider rainwater harvesting for the landscaping.",
    ],
    "Sustainable transport": [
        "More EV charging points, the current ones are always occupied.",
        "Secure bike storage and showers would get more of our team cycling.",
        "A shuttle to the nearest train station would make a big difference.",
        "Charging for electric vans at the loading docks would help our fleet transition.",
    ],
    "Wellbeing": [
        "More plants and green space around the entrance.",
        "A quiet room or wellness space would be appreciated by our staff.",
        "Better daylight in the inner offices, they feel dark in winter.",
    ],
    "Energy & carbon": [
        "Share the building's energy and carbon data with us so we can use it in our own reporting.",
        "Motion sensors for the lighting in the corridors and stairwells.",
        "Look into green electricity contracts for the common areas.",
    ],
    "Indoor comfort": [
        "The south-facing offices get warm in summer, external blinds would help.",
        "Air quality sensors in meeting rooms would reassure our staff.",
    ],
    "Communication": COMMS_COMPLAINTS,
    "Overall satisfaction": [
        "Keep doing what you are doing, the building works well for us.",
        "Honestly very little, we are happy with the building.",
        "Nothing major. Perhaps a tenant sustainability forum once a year.",
    ],
}
POSITIVE_RECENT = [
    "The new recycling stations in the lobby are a good improvement.",
    "We noticed the new EV chargers in the car park, thank you.",
    "The green roof terrace is popular with our team.",
    "Cleaning now uses eco-labelled products, which we appreciate.",
    "Nothing major, the building runs smoothly.",
    "The lobby refurbishment looks great and the lighting is better.",
    "Bike storage has been expanded, it is now much easier to find a spot.",
    "Water-saving fixtures were installed in the washrooms and work well.",
]
COLLAB_YES = [
    "Yes, we would be interested in a green lease. Our parent company has science-based targets.",
    "Yes. We'd like to share energy data both ways and agree joint reduction targets.",
    "Possibly, please send us more details on what a green lease would mean for our service charge.",
    "Yes, we already run an internal energy-saving campaign and would like to align it with yours.",
    "Interested in joining a tenant sustainability working group.",
    "Yes, especially if it includes sub-metering so we can see our own consumption.",
]
COLLAB_NO = [
    "Not at the moment, we are focused on other priorities this year.",
    "Maybe next year, our lease renewal is coming up and we'd like to discuss it then.",
    "We are a small team, but happy to follow any simple guidelines you share.",
]
CASTELLANA_COLLAB = [
    "Only once the HVAC is fixed. It is hard to talk about energy saving while the AC runs all night.",
    "Yes, but first we need a plan for the cooling system and the temperature problems.",
    "We would join an energy initiative if it includes replacing the HVAC plant.",
]
MONTHS = {"2025-Q4": "October", "2026-Q1": "February", "2026-Q2": "May", "2026-Q3": "July", "2026-Q4": "October"}
HVAC_KEYWORDS = ("hvac", "air condition", "temperature", "cooling", "heating", "thermostat", "ventilation", " ac ")


def mentions_hvac(text: str) -> bool:
    t = f" {text.lower()} "
    return any(k in t for k in HVAC_KEYWORDS)


def ascii_fold(s: str) -> str:
    return s.translate(str.maketrans("áéíóúýčďěňřšťžůåäöøłńśźżèàçñëïüâêîôû", "aeiouycdenrstzuaaoolnszzeacneiuaeiou")).replace("ß", "ss")


def det_uuid(rng: random.Random) -> str:
    return str(uuid.UUID(int=rng.getrandbits(128), version=4))


def generate() -> dict:
    rng = random.Random(SEED)

    properties = [dict(property_id=p[0], property_name=p[1], city=p[2], country=p[3], property_type=p[4],
                       local_currency=p[5], invoice_language=p[6], gross_floor_area_sqm=p[7], year_built=p[8],
                       epc_rating=p[9], green_certification=p[10]) for p in PROPERTIES]
    pname = {p["property_id"]: p["property_name"] for p in properties}

    tenants, contacts = [], []
    tid = cid = 0
    for pid in range(1, 11):
        for name, sector, area, start, people in TENANTS[pid]:
            tid += 1
            domain = "".join(ch for ch in ascii_fold(name.lower().split(" ")[0]) if ch.isalnum()) or "tenant"
            domain = f"{domain}{tid}.example"  # reserved TLD: never a real mailbox
            tenants.append(dict(tenant_id=tid, tenant_name=name, property_id=pid, sector=sector,
                                leased_area_sqm=area, lease_start=start))
            for first, last, title in people:
                cid += 1
                local = f"{first}.{last}".lower().replace(" ", "").replace("'", "")
                local = ascii_fold(local)
                contacts.append(dict(contact_id=cid, contact_name=f"{first} {last}", contact_email=f"{local}@{domain}",
                                     job_title=title, tenant_id=tid, property_id=pid))

    questions = [dict(question_id=q[0], question_order=q[0], question_type=q[1], theme=q[2], question_text=q[3],
                      is_required=q[1] == "likert") for q in QUESTIONS]

    campaigns = []
    for c in CAMPAIGNS:
        qs = quarter_start(c)
        opens = datetime(qs.year, qs.month, 6, 8, 0, tzinfo=timezone.utc)
        closes = datetime(qs.year, qs.month + 1, 30 if qs.month + 1 != 2 else 28, 18, 0, tzinfo=timezone.utc)
        campaigns.append(dict(campaign_id=c, campaign_name=f"Tenant ESG & satisfaction survey {c}", quarter_start=qs.isoformat(),
                              opens_at=opens.isoformat(), closes_at=closes.isoformat(),
                              status="open" if c == OPEN_CAMPAIGN else "closed"))

    requests = []
    rid = 0
    for c in campaigns:
        opens = datetime.fromisoformat(c["opens_at"])
        for ct in contacts:
            rid += 1
            sent = opens + timedelta(seconds=ct["contact_id"] * 7)
            requests.append(dict(request_id=f"REQ-{c['campaign_id'].replace('-', '')}-{ct['contact_id']:03d}",
                                 campaign_id=c["campaign_id"], contact_id=ct["contact_id"], sent_at=sent.isoformat()))

    bias = {ct["contact_id"]: rng.gauss(0, 0.35) for ct in contacts}
    by_prop = {pid: [c for c in contacts if c["property_id"] == pid] for pid in range(1, 11)}
    responses, answers = [], []
    for ci, c in enumerate(campaigns):
        opens = datetime.fromisoformat(c["opens_at"])
        closes = min(datetime.fromisoformat(c["closes_at"]), AS_OF)
        window = (closes - opens).total_seconds()
        for pid in range(1, 11):
            k = COMPLETIONS[pid][ci]
            responders = sorted(rng.sample(by_prop[pid], k), key=lambda x: x["contact_id"])
            for ct in responders:
                # most answers arrive in the first two weeks
                frac = min(rng.betavariate(1.3, 4.0), 0.999)
                submitted = opens + timedelta(seconds=int(window * frac))
                resp_id = det_uuid(rng)
                responses.append(dict(response_id=resp_id, campaign_id=c["campaign_id"], contact_id=ct["contact_id"],
                                      contact_email=ct["contact_email"], property_id=pid,
                                      submitted_at=submitted.isoformat()))
                scores = {}
                for q in questions:
                    if q["question_type"] != "likert":
                        continue
                    th = q["theme"]
                    base = PROPERTY_THEME_BASE.get(pid, {}).get(th) or BASE
                    if pid == 1 and th == "Energy & carbon":
                        base = AMSTEL_ENERGY[c["campaign_id"]]
                    if pid == 1 and th == "Overall satisfaction":
                        base = AMSTEL_OVERALL[c["campaign_id"]]
                    if pid == 6 and th in ("Energy & carbon", "Indoor comfort", "Overall satisfaction"):
                        base += CASTELLANA_SEASON[c["campaign_id"]]
                    if pid == 1 and th == "Energy & carbon":  # the initiative effect dominates individual bias
                        v = int(round(base + 0.4 * bias[ct["contact_id"]] + rng.gauss(0, 0.35)))
                    else:
                        v = int(round(base + bias[ct["contact_id"]] + rng.gauss(0, 0.55)))
                    v = max(1, min(5, v))
                    scores[th] = v
                    answers.append(dict(response_id=resp_id, question_id=q["question_id"], likert_value=v, text_value=None))
                for q in questions:
                    if q["question_type"] != "text":
                        continue
                    text = free_text(rng, q["question_id"], pid, c["campaign_id"], scores)
                    if text:
                        answers.append(dict(response_id=resp_id, question_id=q["question_id"], likert_value=None,
                                            text_value=text))
    data = dict(properties=properties, tenants=tenants, survey_contacts=contacts, survey_questions=questions,
                survey_campaigns=campaigns, survey_requests=requests, survey_responses=responses,
                survey_answers=answers)
    data["facts"] = check_facts(data, pname)
    return data


PREFIXES = {
    "request": ["", "", "", "Honestly, ", "As mentioned last quarter: ", "From our team: ", "Our staff keep raising this. ",
                "Same as before. ", "Thanks for asking. "],
    "neutral": ["", "", "", "From our side: ", "Thanks for asking. ", "In short: "],
}
SUFFIXES = {
    "hvac": ["", " It affects productivity every week.", " Several colleagues now work from home on hot days.",
             " Please give us a timeline for a fix.", " Our facilities team has escalated this twice.",
             " Clients have commented on it during meetings.", " This is our main reason to reconsider the lease."],
    "amstel": ["", " Well done.", " Our sustainability team is very happy.", " Please keep sharing the numbers.",
               " Next: EV charging for our vans.", " It shows in our energy bills."],
    "generic": ["", "", " Thank you.", " Happy to discuss.", " Otherwise all good.", " A small change with a big effect.",
                " Our employees would really appreciate it.", " It came up in our internal staff survey too."],
    "recent": ["", "", " Thank you.", " Good to see.", " Keep it up.", " Our team noticed it straight away."],
    "collab": ["", "", " Happy to discuss.", " Please contact our facilities team.", " Let us know the next steps."],
}


def compose(rng: random.Random, s: str, campaign: str, kind: str = "generic") -> str:
    core = fill(rng, s, campaign)
    pre = rng.choice(PREFIXES["request" if kind in ("generic", "hvac") else "neutral"])
    if pre and core[0].isupper() and not pre.endswith(". ") and not pre.endswith(": "):
        core = core[0].lower() + core[1:]
    return (pre + core + rng.choice(SUFFIXES[kind])).strip()


def fill(rng: random.Random, s: str, campaign: str) -> str:
    return s.format(floor=rng.choice([3, 5, 7, 9, 11, 12, 14, 16]), n=rng.choice([6, 8, 9, 12, 14]),
                    month=MONTHS[campaign])


def free_text(rng: random.Random, qid: int, pid: int, campaign: str, scores: dict) -> str | None:
    after_initiative = campaign >= "2026-Q2"
    if qid == 9:  # improvement: answered by ~80 %
        if rng.random() > 0.8:
            return None
        if pid == 6 and rng.random() < 0.85:
            return compose(rng, rng.choice(HVAC_IMPROVE), campaign, "hvac")
        if pid == 1 and rng.random() < 0.7:
            return compose(rng, rng.choice(AMSTEL_AFTER if after_initiative else AMSTEL_BEFORE), campaign, "amstel" if after_initiative else "generic")
        if pid == 4 and rng.random() < 0.6:
            return compose(rng, rng.choice(COMMS_COMPLAINTS), campaign)
        worst = min(scores, key=lambda t: (scores[t], rng.random()))
        return compose(rng, rng.choice(GENERIC_IMPROVE[worst]), campaign)
    if qid == 10:  # recent changes: ~55 %
        if rng.random() > 0.55:
            return None
        if pid == 6 and rng.random() < 0.75:
            return compose(rng, rng.choice(HVAC_RECENT), campaign, "hvac")
        if pid == 1 and after_initiative and rng.random() < 0.8:
            return compose(rng, rng.choice(AMSTEL_RECENT_AFTER), campaign, "amstel")
        if pid == 1 and not after_initiative and rng.random() < 0.5:
            return "We heard there are plans for solar panels. When will the works start?"
        return compose(rng, rng.choice(POSITIVE_RECENT), campaign, "recent")
    if qid == 11:  # collaboration: ~40 %
        if rng.random() > 0.4:
            return None
        if pid == 6 and rng.random() < 0.7:
            return compose(rng, rng.choice(CASTELLANA_COLLAB), campaign, "hvac")
        return compose(rng, rng.choice(COLLAB_YES if scores["Overall satisfaction"] >= 3 else COLLAB_NO), campaign, "collab")
    return None


# --------------------------------------------------------------------------------------------------
# Planted facts: computed, asserted, returned (written to facts.json and the data contract)
# --------------------------------------------------------------------------------------------------
def check_facts(d: dict, pname: dict) -> dict:
    qtheme = {q["question_id"]: q["theme"] for q in d["survey_questions"]}
    resp = {r["response_id"]: r for r in d["survey_responses"]}

    def avg(pid=None, theme=None, campaign=None):
        vals = [a["likert_value"] for a in d["survey_answers"] if a["likert_value"] is not None
                and (theme is None or qtheme[a["question_id"]] == theme)
                and (pid is None or resp[a["response_id"]]["property_id"] == pid)
                and (campaign is None or resp[a["response_id"]]["campaign_id"] == campaign)]
        return round(sum(vals) / len(vals), 2)

    n_req = {c: sum(1 for r in d["survey_requests"] if r["campaign_id"] == c) for c in CAMPAIGNS}
    n_resp = {c: sum(1 for r in d["survey_responses"] if r["campaign_id"] == c) for c in CAMPAIGNS}
    completion = {c: round(n_resp[c] / n_req[c], 4) for c in CAMPAIGNS}
    prop_completion = {}
    for pid in range(1, 11):
        req = sum(1 for r in d["survey_requests"] if any(c["contact_id"] == r["contact_id"] and c["property_id"] == pid
                                                         for c in d["survey_contacts"]))
        done = sum(1 for r in d["survey_responses"] if r["property_id"] == pid)
        prop_completion[pid] = round(done / req, 4)

    energy = {pid: avg(pid, "Energy & carbon") for pid in range(1, 11)}
    comfort = {pid: avg(pid, "Indoor comfort") for pid in range(1, 11)}
    overall = {pid: avg(pid, "Overall satisfaction") for pid in range(1, 11)}
    amstel_energy = {c: avg(1, "Energy & carbon", c) for c in CAMPAIGNS}
    texts = [(resp[a["response_id"]], a["text_value"]) for a in d["survey_answers"] if a["text_value"]]
    cast_txt = [t for r, t in texts if r["property_id"] == 6]
    other_txt = [t for r, t in texts if r["property_id"] != 6]
    cast_hvac = sum(mentions_hvac(t) for t in cast_txt)
    other_hvac = sum(mentions_hvac(t) for t in other_txt)
    amstel_solar = {c: sum(1 for r, t in texts if r["property_id"] == 1 and r["campaign_id"] == c
                           and any(k in t.lower() for k in ("solar", "led"))) for c in CAMPAIGNS}

    # F1 Castellana lowest Energy & Indoor comfort overall and in every campaign; HVAC in free text
    assert min(energy, key=energy.get) == 6 and min(comfort, key=comfort.get) == 6, (energy, comfort)
    for c in CAMPAIGNS:
        e = {pid: avg(pid, "Energy & carbon", c) for pid in range(1, 11)}
        ic = {pid: avg(pid, "Indoor comfort", c) for pid in range(1, 11)}
        assert min(ic, key=ic.get) == 6, (c, ic)
        assert e[6] <= 2.6 and min(e, key=e.get) == 6, (c, e)
    assert energy[6] < 2.5 and comfort[6] < 2.3
    assert cast_hvac / len(cast_txt) >= 0.6, (cast_hvac, len(cast_txt))
    assert other_hvac / len(other_txt) <= 0.05, (other_hvac, len(other_txt))
    # F2 Amstel Energy rises every quarter, from < 3 to > 4
    vals = [amstel_energy[c] for c in CAMPAIGNS]
    assert all(b > a for a, b in zip(vals, vals[1:])), vals
    assert vals[0] < 3.0 and vals[-1] > 4.0, vals
    # F3 Vltava lowest completion, below 40 %, every other property >= 65 %
    assert min(prop_completion, key=prop_completion.get) == 4 and prop_completion[4] < 0.4
    assert all(v >= 0.6 for k, v in prop_completion.items() if k != 4), prop_completion
    # F4 open campaign partly completed
    assert 0.4 <= completion[OPEN_CAMPAIGN] <= 0.6, completion
    assert all(completion[c] >= 0.7 for c in CAMPAIGNS if c != OPEN_CAMPAIGN), completion
    assert all(datetime.fromisoformat(r["submitted_at"]) <= AS_OF for r in d["survey_responses"])
    # F5 Docklands highest overall satisfaction
    assert max(overall, key=overall.get) == 8, overall
    # integrity
    assert len(d["tenants"]) == 45 and len(d["survey_contacts"]) == 60
    assert len({c["contact_email"] for c in d["survey_contacts"]}) == 60
    assert all(len([c for c in d["survey_contacts"] if c["property_id"] == p]) == 6 for p in range(1, 11))
    pairs = [(r["campaign_id"], r["contact_id"]) for r in d["survey_responses"]]
    assert len(pairs) == len(set(pairs)), "one response per contact per campaign"
    distinct_text = len({t for _, t in texts}) / len(texts)
    assert distinct_text >= 0.6, distinct_text

    open_done = {r["contact_id"] for r in d["survey_responses"] if r["campaign_id"] == OPEN_CAMPAIGN}
    return {
        "as_of": AS_OF.isoformat(),
        "counts": {k: len(v) for k, v in d.items() if isinstance(v, list)},
        "text_answers": len(texts),
        "distinct_text_ratio": round(distinct_text, 3),
        "requests_by_campaign": n_req,
        "responses_by_campaign": n_resp,
        "completion_rate_by_campaign": completion,
        "completion_rate_by_property_all_campaigns": {pname[k]: v for k, v in prop_completion.items()},
        "open_campaign": OPEN_CAMPAIGN,
        "open_campaign_not_completed_contacts": 60 - len(open_done),
        "portfolio_avg_score_all": avg(),
        "portfolio_avg_by_theme": {t: avg(theme=t) for t in THEMES},
        "energy_avg_by_property": {pname[k]: v for k, v in energy.items()},
        "comfort_avg_by_property": {pname[k]: v for k, v in comfort.items()},
        "overall_avg_by_property": {pname[k]: v for k, v in overall.items()},
        "amstel_energy_by_campaign": amstel_energy,
        "amstel_solar_led_mentions_by_campaign": amstel_solar,
        "castellana_energy_by_campaign": {c: avg(6, "Energy & carbon", c) for c in CAMPAIGNS},
        "castellana_comfort_by_campaign": {c: avg(6, "Indoor comfort", c) for c in CAMPAIGNS},
        "castellana_text_answers": len(cast_txt),
        "castellana_text_mentioning_hvac": cast_hvac,
        "other_text_answers": len(other_txt),
        "other_text_mentioning_hvac": other_hvac,
        "open_campaign_avg_by_theme": {t: avg(theme=t, campaign=OPEN_CAMPAIGN) for t in THEMES},
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out")
    ap.add_argument("--facts", action="store_true")
    a = ap.parse_args()
    d = generate()
    if a.out:
        out = Path(a.out)
        out.mkdir(parents=True, exist_ok=True)
        for k, v in d.items():
            (out / f"{k}.json").write_text(json.dumps(v, ensure_ascii=False, indent=None if isinstance(v, list) else 2))
        print(f"wrote {len(d)} files to {out}")
    if a.facts or not a.out:
        print(json.dumps(d["facts"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
