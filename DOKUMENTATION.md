<!-- ZAM Wohnen Formular – Dokumentation (Markdown im XML‑Stil) -->
<documentation version="1.0" updated="2025-08-25" lang="de">

  <about>
    <title>ZAM Wohnen – Bewerbungsformular</title>
    <summary>
      Dynamisches, barrierearmes Webflow-Formular pro Wohnungs-Item mit automatischer Datenübernahme,
      RTE-basierten Ausstattungstags, clientseitiger Validierung und Übergabe an Make.com Webhook.
    </summary>
  </about>

  <files>
    <file path="form.html" purpose="Semantische Struktur & Formularfelder" />
    <file path="form.css" purpose="Design, Responsiveness, Fehlermarkierung" />
    <file path="form.js" purpose="Datenbefüllung, RTE-Parsing, Validierung, Submit" />
  </files>

  <assumptions>
    <item>Webflow CMS liefert die im Markup verwendeten Werte als Felder (id, Name, Mieten, etc.).</item>
    <item>Ein unsichtbarer Rich-Text pro Item mit Klasse <code>.rte-ausstattung-source</code> ist vorhanden.</item>
    <item>Make.com Webhook akzeptiert JSON <code>POST</code> ohne Auth (oder via Projektkonfiguration).</item>
    <item>Keine externen Dependencies; Vanilla HTML/CSS/JS im Webflow-Frontend.</item>
  </assumptions>

  <embedding platform="webflow">
    <step index="1" name="Section anlegen">
      Lege im Collection Item eine Section/Div mit Klasse <code>zam-apply</code> an und binde folgende <code>data-*</code> Attribute an CMS-Felder:
      <binds>
        <bind attr="data-unit-id" field="unit_id" />
        <bind attr="data-name" field="name" />
        <bind attr="data-haus" field="haus" />
        <bind attr="data-stockwerk" field="stockwerk" />
        <bind attr="data-zimmer" field="zimmer" />
        <bind attr="data-wohnflaeche" field="wohnflaeche_qm" />
        <bind attr="data-kaltmiete" field="kaltmiete_gerundet" />
        <bind attr="data-nebenkosten" field="nebenkosten_gerundet" />
        <bind attr="data-warmmiete" field="warmmiete_gerundet" />
        <bind attr="data-ausrichtung" field="ausrichtung_gesamt" />
        <bind attr="data-status" field="status" />
        <bind attr="data-form-aktiv" field="form_aktiv" />
      </binds>
    </step>
    <step index="2" name="RTE-Quelle bereitstellen">
      Platziere im gleichen Item einen gebundenen RTE mit Klasse <code>rte-ausstattung-source</code> und setze ihn auf "Display: none".
    </step>
    <step index="3" name="HTML einbetten">
      Kopiere den kompletten Inhalt aus <code>form.html</code> in ein Embed-Element in derselben Section.
      Achte darauf, dass das Root-Element die Klasse <code>zam-apply</code> trägt.
    </step>
    <step index="4" name="CSS einfügen">
      Füge den Inhalt aus <code>form.css</code> in den globalen Head (Seite oder Projektweite Custom Code) ein.
    </step>
    <step index="5" name="JS einfügen">
      Füge den Inhalt aus <code>form.js</code> in den Footer-Custom-Code der Seite oder projektweit ein.
    </step>
    <step index="6" name="Make.com konfigurieren">
      Öffne <code>form.js</code> und setze <code>MAKE_WEBHOOK_URL</code> auf deine Hook-URL.
      <code-example>
```javascript
const MAKE_WEBHOOK_URL = 'https://hook.eu2.make.com/DEIN_WEBHOOK';
```
      </code-example>
    </step>
  </embedding>

  <structure>
    <facts>
      Die Faktenzeile (Haus, Zimmer, Fläche, Mieten, Ausrichtung) wird automatisch aus den <code>data-*</code> Attributen gesetzt.
    </facts>
    <tags>
      Ausstattungstags werden aus dem RTE extrahiert. Listelemente (<code>ul/ol &gt; li</code>) haben Priorität; sonst Absätze, sonst Fallback gesamter Text.
      Deduplizierung mit Normalisierung; Keywords (z. B. <code>barriere</code>, <code>ebk</code>, <code>balkon</code>) erhalten <code>tag--highlight</code>.
    </tags>
    <hidden-fields>
      Hidden-Felder für Unit-Metadaten und UTM-Parameter werden automatisch befüllt (z. B. <code>page_url</code>, <code>utm_source</code>, ...).
    </hidden-fields>
  </structure>

  <validation>
    <required>
      <field id="full_name" label="Vollständiger Name" />
      <field id="email" label="E‑Mail" />
      <field id="phone" label="Telefon (mobil)" />
      <field id="move_in" label="Gewünschter Einzug" />
      <field id="occupants" label="Personen im Haushalt" />
      <field id="income" label="Monatl. Nettoeinkommen (gesamt)" />
      <field id="employment" label="Beschäftigung" />
      <field id="privacy" label="Einwilligung" type="checkbox" />
    </required>
    <rules>
      <rule field="email">E-Mail-Formatprüfung mit Basis-Regex.</rule>
      <rule field="phone">7–16 Ziffern; erlaubt: + ( ) - / . Leerzeichen.</rule>
      <rule field="honeypot">Feld <code>#website</code> muss leer sein (Bot-Schutz).</rule>
      <rule field="unit_id">Fehlt die Unit-ID, wird abgebrochen und ein Hinweis angezeigt.</rule>
    </rules>
    <feedback>
      Fehlertexte werden in <code>.error[data-for="&lt;feld&gt;"]</code> gesetzt; erstes ungültiges Feld erhält Fokus.
    </feedback>
  </validation>

  <accessibility aria="true">
    <mechanics>
      <item>Fehlercontainer erhält <code>role="status"</code> und <code>aria-live="polite"</code>.</item>
      <item>Felder erhalten <code>aria-invalid</code> und bei Fehler <code>aria-describedby</code> auf die Fehler-ID.</item>
      <item>Visuelles Feedback: CSS-Selektor <code>[aria-invalid="true"]</code> (roter Rahmen/Hintergrund).</item>
    </mechanics>
  </accessibility>

  <submission>
    <method>JSON POST an <code>MAKE_WEBHOOK_URL</code> mit <code>fetch</code>.</method>
    <payload-example>
```json
{
  "submitted_at": "2025-08-25T12:34:56.000Z",
  "unit": { "unit_id": "123", "name": "Wohnung A", "...": "..." },
  "form": {
    "full_name": "Max Mustermann",
    "email": "max@example.com",
    "phone": "+49 171 2345678",
    "move_in": "2025-10-01",
    "occupants": "2",
    "income": "3.000 – 4.500 €",
    "employment": "Angestellt (unbefristet)",
    "message": "...",
    "privacy": true,
    "page_url": "https://...",
    "utm_source": "google",
    "utm_medium": "cpc",
    "utm_campaign": "brand",
    "utm_content": "ad-1"
  },
  "idempotency_key": "ZW5jb2RlZA=="
}
```
    </payload-example>
    <states>
      <state name="success">Formular wird zurückgesetzt; <code>#formSuccess</code> sichtbar, <code>#formError</code> ausgeblendet.</state>
      <state name="error"><code>#formError</code> wird eingeblendet; Spinner deaktiviert.</state>
    </states>
  </submission>

  <customizing>
    <option name="Pflichtfelder anpassen">Array <code>REQUIRED</code> in <code>form.js</code> ändern.</option>
    <option name="Fehlermeldungen">Texte in <code>showError</code>/<code>validate</code> anpassen.</option>
    <option name="Highlight-Tags">Keywords in <code>addTag</code> erweitern.</option>
    <option name="Design">
      CSS-Variablen in <code>[data-theme="zam"]</code> ändern (Farben, Radius, Shadows).
    </option>
    <option name="Responsiveness">Grid/Breakpoints in <code>form.css</code> anpassen.</option>
  </customizing>

  <webflow-specifics>
    <item>Re-Init-Schutz per <code>data-inited</code> verhindert doppelte Initialisierung bei Webflow-Neurendering.</item>
    <item>Scoping pro Formularinstanz: Alle Selektoren sind an die umgebende <code>.zam-apply</code> Section gebunden.</item>
    <item>Mehrere Instanzen pro Seite werden unterstützt.</item>
  </webflow-specifics>

  <troubleshooting>
    <case id="no-tags">Prüfe, ob <code>.rte-ausstattung-source</code> im selben Item existiert und Text enthält.</case>
    <case id="no-submit">Setze korrekte <code>MAKE_WEBHOOK_URL</code>; prüfe Browser-Konsole auf Netzwerkfehler.</case>
    <case id="utm-missing">Rufe Seite mit UTM-Parametern auf (<code>?utm_source=...&amp;utm_medium=...</code>), sonst bleiben Felder leer.</case>
    <case id="unit-missing">Fehlt <code>data-unit-id</code>, wird der Submit blockiert.</case>
  </troubleshooting>

  <checklist label="Selbstreflexion">
    <item>Webflow-kompatibel (keine externen Abhängigkeiten, Re-Init-Schutz, Scoping)</item>
    <item>Validierung (Pflichtfelder, E-Mail, Telefon, Honeypot) funktioniert</item>
    <item>Responsiveness (Grid/Breakpoints) geprüft</item>
    <item>Dokumentation (Einbettung, Funktionen, Customizing) vollständig</item>
    <item>Ohne zusätzliche Dependencies lauffähig</item>
  </checklist>

  <changelog>
    <change date="2025-08-25">
      <desc>Telefonvalidierung, ARIA-Fehlerzustände, visuelles Fehlerfeedback ergänzt.</desc>
    </change>
  </changelog>

  <quick-start>
    <steps>
      <step>CSS in den Head, JS in den Footer einfügen.</step>
      <step>HTML-Embed in Collection Item einsetzen.</step>
      <step>RTE <code>.rte-ausstattung-source</code> hinzufügen (hidden).</step>
      <step><code>MAKE_WEBHOOK_URL</code> setzen und testen.</step>
    </steps>
  </quick-start>

</documentation>


