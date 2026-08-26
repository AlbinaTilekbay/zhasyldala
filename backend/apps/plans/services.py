"""Weekly treatment-plan generation, mirroring the mockup's hard-coded
`PLAN` constant — 5 generic steps, but scoped to whichever sectors this
scan actually flagged (or the whole greenhouse if every flagged sector
shares the same handful of steps)."""

from .models import TreatmentPlan, TreatmentPlanItem

DEFAULT_PLAN_TEMPLATE = [
    {
        "title": "Зақымдалған жапырақтарды жинау",
        "description": "Кесіп алып, жылыжайдан тыс жерге шығарыңыз; құралды дезинфекциялаңыз.",
        "when_label": "Бүгін",
    },
    {
        "title": "Мыс препаратымен өңдеу",
        "description": "Кешке, желдеткіштер жабық кезде. Мөлшері — қаптамадағы нұсқау бойынша.",
        "when_label": "Бүгін",
    },
    {
        "title": "Күнде екі рет желдету",
        "description": "Таңертең 30 минут және суарудан кейін — ылғалдылықты 65%-ға түсіру.",
        "when_label": "Күн сайын",
    },
    {
        "title": "Қайта өңдеу",
        "description": "Сол препаратпен екінші рет — қоздырғыш циклі бойынша.",
        "when_label": "7-күн",
    },
    {
        "title": "Бақылау шолуы",
        "description": "QR бойынша сол маршрут — жүйе ем нәтижесін көрсетеді.",
        "when_label": "7-күн",
    },
]


def generate_plan_for_session(scan_session):
    """Creates the one weekly plan for this scan the first time it's
    called; afterwards just returns the existing plan untouched (the
    mockup's CTA relabels to "Емдеу жоспарын ашу" once generated — it
    does not regenerate and wipe the farmer's checked-off items)."""
    existing = TreatmentPlan.objects.filter(scan_session=scan_session).first()
    if existing is not None:
        return existing

    affected_labels = list(
        scan_session.captures.select_related("sector", "diagnosis_request__result")
        .filter(diagnosis_request__result__severity__in=["warn", "bad"])
        .values_list("sector__label", flat=True)
    )

    plan = TreatmentPlan.objects.create(scan_session=scan_session, greenhouse=scan_session.greenhouse)
    TreatmentPlanItem.objects.bulk_create(
        [
            TreatmentPlanItem(
                plan=plan,
                title=step["title"],
                description=step["description"],
                when_label=step["when_label"],
                sector_labels=affected_labels,
                order=i,
            )
            for i, step in enumerate(DEFAULT_PLAN_TEMPLATE)
        ]
    )
    return plan
