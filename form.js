
document.addEventListener('DOMContentLoaded', () => {
  // Für jede Formular-Instanz separat arbeiten
  document.querySelectorAll('.zam-apply').forEach((WRAP) => {
    // === Doppel-Initialisierung verhindern (Webflow re-run etc.) ===
    if (WRAP.dataset.inited === '1') return;
    WRAP.dataset.inited = '1';

    // ===== Helper (immer auf WRAP scopen) =====
    const q  = (sel, root = WRAP) => root.querySelector(sel);
    const qa = (sel, root = WRAP) => Array.from(root.querySelectorAll(sel));
    const setText = (sel, val) => { const el = q(sel); if (el) el.textContent = (val ?? '') !== '' ? val : '—'; };
    const currency = (num) => {
      if (!num) return '';
      try {
        return new Intl.NumberFormat('de-DE', {
          style: 'currency',
          currency: 'EUR',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(Number(num));
      } catch { return String(num); }
    };

    // ===== ARIA / Zugänglichkeit =====
    const getField = (name) => FORM ? (FORM.querySelector(`[name="${name}"]`) || q('#' + name, FORM)) : null;
    const getErrorEl = (name) => {
      const el = q(`.error[data-for="${name}"]`);
      if (el && !el.id) el.id = `err-${name}`;
      if (el) {
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
      }
      return el;
    };
    const setFieldValidity = (name, isValid) => {
      const field = getField(name);
      const errEl = getErrorEl(name);
      if (field) {
        field.setAttribute('aria-invalid', isValid ? 'false' : 'true');
        if (errEl) {
          if (isValid) {
            if (field.getAttribute('aria-describedby') === errEl.id) {
              field.removeAttribute('aria-describedby');
            }
          } else {
            field.setAttribute('aria-describedby', errEl.id);
          }
        }
      }
    };
    const isPhoneLike = (v) => {
      if (!v) return false;
      const digits = (v.match(/\d/g) || []).length;
      if (digits < 7 || digits > 16) return false;
      return /^[\s()+\-./0-9]*\+?[\s()+\-./0-9]*$/.test(v);
    };

    // ===== Elemente (lokal) =====
    const FORM    = q('#zam-form');
    const SUBMIT  = q('#submitBtn');
    const SUCCESS = q('#formSuccess');
    const ERR     = q('#formError');
    if (!FORM) return;

    // Falls im Button kein Spinner vorhanden ist, füge ihn hinzu
    if (SUBMIT && !SUBMIT.querySelector('.btn__spinner')) {
      const sp = document.createElement('span');
      sp.className = 'btn__spinner';
      sp.setAttribute('aria-hidden', 'true');
      SUBMIT.appendChild(sp);
    }

    // ===== Config =====
    const MAKE_WEBHOOK_URL = 'https://hook.eu2.make.com/YOUR_MAKE_WEBHOOK_URL'; // <— DEINE URL hier einsetzen
    const REQUIRED = ['full_name', 'email', 'phone', 'move_in', 'occupants', 'income', 'employment', 'privacy'];

    // ===== Meta aus data-* (vom selben Item) =====
    const meta = {
      unit_id:     WRAP?.dataset.unitId || '',
      name:        WRAP?.dataset.name || '',
      haus:        WRAP?.dataset.haus || '',
      stockwerk:   WRAP?.dataset.stockwerk || '',
      zimmer:      WRAP?.dataset.zimmer || '',
      wohnflaeche: WRAP?.dataset.wohnflaeche || '',
      kaltmiete:   WRAP?.dataset.kaltmiete || '',
      nebenkosten: WRAP?.dataset.nebenkosten || '',
      warmmiete:   WRAP?.dataset.warmmiete || '',
      ausrichtung: WRAP?.dataset.ausrichtung || '',
      status:      WRAP?.dataset.status || '',
      form_aktiv:  WRAP?.dataset.formAktiv || ''
    };

    // ===== Facts füllen (lokal) =====
    setText('#fact-haus',  meta.haus);
    setText('#fact-stock', meta.stockwerk);
    setText('#fact-rooms', meta.zimmer);
    setText('#fact-size',  meta.wohnflaeche ? (meta.wohnflaeche + ' m²') : '');
    setText('#fact-warm',  currency(meta.warmmiete));
    setText('#fact-cold',  currency(meta.kaltmiete));
    setText('#fact-nk',    currency(meta.nebenkosten));
    setText('#fact-orient',meta.ausrichtung);

    // ===== RTE-Scrape: nur vom selben Collection-Item =====
    const container = WRAP.closest('.collection-item') || WRAP;
    const rte = container.querySelector('.rte-ausstattung-source'); // gebundener, unsichtbarer RTE

    // Tags-Container lokal besorgen ODER erzeugen
    let tagsWrap = q('#featureTags');
    if (!tagsWrap) {
      // Falls der Container fehlt, lege ihn im Header an
      const header = q('.zam-apply__header') || WRAP;
      tagsWrap = document.createElement('div');
      tagsWrap.className = 'zam-apply__tags';
      tagsWrap.id = 'featureTags';
      header.appendChild(tagsWrap);
    }

    // Normalisierung für Dedupe (verhindert 2x/3x gleiche Tags)
    const norm = (s) => {
      return (s || '')
        .replace(/\u00A0/g, ' ')          // NBSP -> Space
        .replace(/<[^>]+>/g, '')          // (Sicherheit) HTML Tags
        .replace(/^[-•\d\.\)\s]+/, '')    // führende Bullets/Nummern
        .replace(/[;,.\s]+$/, '')         // Endzeichen/Spaces
        .replace(/\s+/g, ' ')             // Mehrfachspaces
        .trim()
        .toLowerCase();
    };

    function addTag(text) {
      const raw = (text || '').trim();
      if (!raw || !tagsWrap) return;
      const el = document.createElement('span');
      const lower = raw.toLowerCase();
      const highlight =
        lower.includes('barriere') ||
        lower.includes('ebk') ||
        lower.includes('einbauküche') ||
        lower.includes('balkon') ||
        lower.includes('terrasse') ||
        lower.includes('loggia');
      el.className = 'tag' + (highlight ? ' tag--highlight' : '');
      el.textContent = raw;
      tagsWrap.appendChild(el);
    }

    (function renderAmenitiesFromRTE(){
      if (!tagsWrap) return;          // Safety
      tagsWrap.replaceChildren();     // vor jedem Render leeren

      if (!rte) return;               // kein RTE im Item → keine Tags

      let items = [];

      // 1) Listeneinträge priorisieren
      items = Array.from(rte.querySelectorAll('ul li, ol li'))
        .map(li => (li.innerText || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean);

      // 2) Falls keine LI: Absätze anhand üblicher Trenner splitten
      if (items.length === 0) {
        items = Array.from(rte.querySelectorAll('p'))
          .map(p => (p.innerText || '').trim())
          .filter(Boolean)
          .flatMap(t => t.split(/;|,|•|–|\n/).map(s => s.trim()).filter(Boolean));
      }

      // 3) Fallback: gesamter Text (inkl. Zeilenumbrüche)
      if (items.length === 0) {
        items = (rte.innerText || '')
          .split(/\n|<br\s*\/?>/i)
          .map(s => s.trim())
          .filter(Boolean);
      }

      // Robuste Deduplizierung
      const seen = new Set();
      items.forEach(s => {
        const key = norm(s);
        if (!key || key.length < 2) return;
        if (seen.has(key)) return;
        seen.add(key);
        addTag(s.replace(/\s+/g, ' ').trim());
      });
    })();

    // ===== Hidden-Felder (lokal) =====
    const hf = (name) => q('#' + name);
    if (hf('unit_id'))              hf('unit_id').value = meta.unit_id;
    if (hf('unit_name'))            hf('unit_name').value = meta.name;
    if (hf('haus'))                 hf('haus').value = meta.haus;
    if (hf('stockwerk'))            hf('stockwerk').value = meta.stockwerk;
    if (hf('zimmer'))               hf('zimmer').value = meta.zimmer;
    if (hf('wohnflaeche_qm'))       hf('wohnflaeche_qm').value = meta.wohnflaeche;
    if (hf('kaltmiete_gerundet'))   hf('kaltmiete_gerundet').value = meta.kaltmiete;
    if (hf('nebenkosten_gerundet')) hf('nebenkosten_gerundet').value = meta.nebenkosten;
    if (hf('warmmiete_gerundet'))   hf('warmmiete_gerundet').value = meta.warmmiete;
    if (hf('ausrichtung_gesamt'))   hf('ausrichtung_gesamt').value = meta.ausrichtung;
    if (hf('status'))               hf('status').value = meta.status;
    if (hf('page_url'))             hf('page_url').value = location.href;

    // UTM (lokal)
    const params = new URLSearchParams(location.search);
    const setHF = (n,v)=>{ if (hf(n)) hf(n).value = v || ''; };
    setHF('utm_source',   params.get('utm_source'));
    setHF('utm_medium',   params.get('utm_medium'));
    setHF('utm_campaign', params.get('utm_campaign'));
    setHF('utm_content',  params.get('utm_content'));

    // ===== Validierung (lokal) =====
    function clearErrors() {
      qa('.error').forEach(e => e.textContent = '');
      REQUIRED.forEach(name => setFieldValidity(name, true));
    }
    function showError(field, msg) {
      const el = getErrorEl(field);
      if (el) el.textContent = msg;
      setFieldValidity(field, false);
    }
    const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

    function validate() {
      clearErrors();
      let ok = true;

      let firstInvalid = null;
      REQUIRED.forEach(name => {
        const el = getField(name);
        if (!el) return;
        if (el.type === 'checkbox' && !el.checked) { ok = false; showError(name, 'Erforderlich.'); if (!firstInvalid) firstInvalid = el; return; }
        if (!el.value) { ok = false; showError(name, 'Erforderlich.'); if (!firstInvalid) firstInvalid = el; return; }
        if (name === 'email' && !isEmail(el.value)) { ok = false; showError(name, 'Ungültige E-Mail.'); if (!firstInvalid) firstInvalid = el; return; }
        if (name === 'phone' && !isPhoneLike(el.value)) { ok = false; showError(name, 'Bitte gültige Telefonnummer angeben.'); if (!firstInvalid) firstInvalid = el; return; }
      });

      // Honeypot
      const hp = q('#website');
      if (hp && hp.value) ok = false;

      if (!meta.unit_id) { ok = false; alert('Unit-ID fehlt. Bitte Admin kontaktieren.'); }
      if (!ok && firstInvalid && typeof firstInvalid.focus === 'function') firstInvalid.focus();
      return ok;
    }

    // ===== Submit (lokal) =====
    FORM.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!validate()) return;

      const spinner = SUBMIT ? SUBMIT.querySelector('.btn__spinner') : null;
      if (SUBMIT) SUBMIT.disabled = true;
      if (spinner) spinner.style.display = 'inline-block';

      try {
        const payload = {
          submitted_at: new Date().toISOString(),
          unit: meta,
          form: {
            full_name:  FORM.full_name?.value.trim() || '',
            email:      FORM.email?.value.trim() || '',
            phone:      FORM.phone?.value.trim() || '',
            move_in:    FORM.move_in?.value || '',
            occupants:  FORM.occupants?.value || '',
            income:     FORM.income?.value || '',
            employment: FORM.employment?.value || '',
            message:    (FORM.message?.value || '').trim(),
            privacy:    !!FORM.privacy?.checked,
            page_url:   hf('page_url')?.value || '',
            utm_source: hf('utm_source')?.value || '',
            utm_medium: hf('utm_medium')?.value || '',
            utm_campaign: hf('utm_campaign')?.value || '',
            utm_content:  hf('utm_content')?.value || ''
          },
          idempotency_key: btoa((meta.unit_id || '') + '|' + ((FORM.email?.value) || '') + '|' + (new Date().toISOString().slice(0,10)))
        };

        const res = await fetch(MAKE_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true
        });

        if (res.ok) {
          FORM.reset();
          clearErrors();
          if (SUCCESS) SUCCESS.hidden = false;
          if (ERR) ERR.hidden = true;
        } else {
          throw new Error('Response not OK');
        }
      } catch (err) {
        console.error(err);
        if (ERR) ERR.hidden = false;
        if (SUCCESS) SUCCESS.hidden = true;
      } finally {
        const spinner2 = SUBMIT ? SUBMIT.querySelector('.btn__spinner') : null;
        if (spinner2) spinner2.style.display = 'none';
        if (SUBMIT) SUBMIT.disabled = false;
      }
    }, { passive: false });
  });
});