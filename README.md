# ZAM Wohnen Formular

Dynamisches, barrierearmes Bewerbungsformular für Webflow CMS mit RTE-basierten Ausstattungstags, clientseitiger Validierung und Übergabe an Make.com.

## Inhalte
- `form.html`: Formular-Markup (einbettbar als Webflow Embed)
- `form.css`: Styles inkl. Responsiveness und Fehlerzustände
- `form.js`: Dynamik, Validierung, Submission (Make.com Webhook)
- `DOKUMENTATION.md`: Detail-Doku im XML-Stil (Integration, Customizing)

## Quick Start
1. CSS in den Head einfügen (Seite/Projekt).
2. JS in den Footer einfügen (Seite/Projekt).
3. HTML in ein Embed-Element im Collection Item kopieren.
4. Unsichtbaren RTE `.rte-ausstattung-source` pro Item anlegen.
5. In `form.js` `MAKE_WEBHOOK_URL` setzen.

## Anforderungen
- Webflow CMS Collections für Wohnungsdaten
- Make.com Webhook, der JSON akzeptiert

Weitere Details siehe `DOKUMENTATION.md`.

