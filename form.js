
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

    // Dynamisches Asset-Loading (für Datepicker)
    function loadCSS(href){
      return new Promise((resolve, reject) => {
        if (document.querySelector(`link[data-dyn-css="${href}"]`)) return resolve();
        const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.setAttribute('data-dyn-css', href);
        l.onload = () => resolve(); l.onerror = reject; document.head.appendChild(l);
      });
    }
    function loadJS(src){
      return new Promise((resolve, reject) => {
        if (document.querySelector(`script[data-dyn-js="${src}"]`)) return resolve();
        const s = document.createElement('script'); s.src = src; s.async = true; s.defer = true; s.setAttribute('data-dyn-js', src);
        s.onload = () => resolve(); s.onerror = reject; document.head.appendChild(s);
      });
    }

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
    const NEXT    = q('#nextStepBtn');
    const PREV    = q('#prevStepBtn');
    const SUCCESS = q('#formSuccess');
    const ERR     = q('#formError');
    if (!FORM) return;

    // Zeitmessung für Anti-Spam (minimale Ausfüllzeit)
    const formInitAt = Date.now();

    // Falls im Button kein Spinner vorhanden ist, füge ihn hinzu
    if (SUBMIT && !SUBMIT.querySelector('.btn__spinner')) {
      const sp = document.createElement('span');
      sp.className = 'btn__spinner';
      sp.setAttribute('aria-hidden', 'true');
      SUBMIT.appendChild(sp);
    }

    // ===== Config =====
    const DEFAULT_WEBHOOK = 'https://hook.eu2.make.com/y7htkxrcwrj8yrgr35gtkumxpluat6r4';
    const MAKE_WEBHOOK_URL = (WRAP.dataset.webhook || window.MAKE_WEBHOOK_URL || DEFAULT_WEBHOOK).trim();
    const isWebhookConfigured = /^https?:\/\//.test(MAKE_WEBHOOK_URL);
    const DEFAULT_REQUIRED = ['full_name', 'email', 'phone', 'move_in', 'occupants', 'income', 'employment', 'privacy'];
    let REQUIRED = DEFAULT_REQUIRED.slice();

    // Sprache aus data-lang, URL (?lang=de/en) oder Browser ableiten
    const urlLang = (new URLSearchParams(location.search).get('lang') || '').toLowerCase();
    let LANG = (WRAP.dataset.lang || urlLang || (navigator.language || 'de')).slice(0,2).toLowerCase();
    LANG = (LANG === 'en') ? 'en' : 'de';

    // i18n Wörterbuch
    const I18N = {
      de: {
        title: `Jetzt bewerben – ${WRAP?.dataset.name || ''}`.trim(),
        subtitle: 'Schnell & unverbindlich anfragen. Wir melden uns zeitnah zurück.',
        labels: {
          full_name: 'Vollständiger Name *',
          email: 'E-Mail *',
          phone: 'Telefon (mobil) *',
          move_in: 'Gewünschter Einzug *',
          occupants: 'Personen im Haushalt *',
          income: 'Monatl. Nettoeinkommen (gesamt) *',
          employment: 'Beschäftigung *',
          message: 'Kurzvorstellung',
          privacy: 'Ich willige in die Verarbeitung meiner Daten zum Zweck der Wohnungsbewerbung ein. Hinweise in der <a href="/datenschutz" target="_blank" rel="noopener">Datenschutzerklärung</a>.',
          street: 'Straße und Hausnummer',
          postal_code: 'PLZ',
          city: 'Ort',
          earliest_move_in: 'Frühester Einzug',
          latest_move_in: 'Spätester Einzug',
          pets: 'Haustiere',
          smoker: 'Rauchen',
          
          parking: 'Parkmöglichkeit',
          budget: 'Monatl. Budget (Warmmiete)',
          how_did_you_hear: 'Wie hast du uns gefunden?',
          viewing_times: 'Verfügbarkeit zur Besichtigung',
          co_applicant_names: 'Namen weiterer einziehender Personen'
        },
        placeholders: {
          full_name: 'Max Mustermann',
          email: 'max@example.com',
          phone: '+49…',
          message: 'Wer zieht ein? Aktuelle Situation, Wunschtermin, Fragen …',
          street: 'Musterstraße 1',
          postal_code: '12345',
          city: 'Berlin',
          viewing_times: 'Bevorzugte Tage/Uhrzeiten',
          co_applicant_names: 'Mitbewohner:innen, Partner:in, Kinder …',
          budget: 'z. B. 1500'
        },
        selects: {
          employment: ['Bitte wählen','Angestellt (unbefristet)','Angestellt (befristet)','Selbstständig/Freiberuflich','Studierend/Auszubildend','Sonstiges'],
          pets: ['Bitte wählen','Nein','Ja'],
          
          
          parking: ['Bitte wählen','Kein Bedarf','Außenstellplatz','Tiefgarage'],
          how_did_you_hear: ['Bitte wählen','Website','Immobilienscout24','Immowelt','Empfehlung','Social Media','Sonstiges']
        },
        submit: 'Anfrage senden',
        note: '* Pflichtfelder',
        success_h3: 'Vielen Dank!',
        success_p: 'Deine Anfrage ist eingegangen. Wir melden uns zeitnah.',
        error_h3: 'Uups, da ging was schief.',
        error_p: 'Bitte später nochmal versuchen oder <a href="/kontakt">Kontakt aufnehmen</a>.',
        errs: {
          required: 'Erforderlich.',
          email: 'Ungültige E-Mail.',
          phone: 'Bitte gültige Telefonnummer angeben.',
          min_time: 'Bitte nimm dir einen Moment Zeit, bevor du absendest.',
          cooldown: 'Bitte kurz warten, bevor du erneut sendest.'
        }
      },
      en: {
        title: `Apply now – ${WRAP?.dataset.name || ''}`.trim(),
        subtitle: 'Quick, non-binding inquiry. We will get back to you shortly.',
        labels: {
          full_name: 'Full name *',
          email: 'Email *',
          phone: 'Phone (mobile) *',
          move_in: 'Desired move-in *',
          occupants: 'People in household *',
          income: 'Monthly net income (total) *',
          employment: 'Employment *',
          message: 'Message',
          privacy: 'I consent to the processing of my data for the purpose of renting application. See the <a href="/datenschutz" target="_blank" rel="noopener">privacy policy</a>.',
          street: 'Street and number',
          postal_code: 'Postal code',
          city: 'City',
          earliest_move_in: 'Earliest move-in',
          latest_move_in: 'Latest move-in',
          pets: 'Pets',
          smoker: 'Smoking',
          
          parking: 'Parking',
          budget: 'Monthly budget (warm rent)',
          how_did_you_hear: 'How did you hear about us?',
          viewing_times: 'Availability for viewing',
          co_applicant_names: 'Names of additional occupants'
        },
        placeholders: {
          full_name: 'John Doe',
          email: 'john@example.com',
          phone: '+1…',
          message: 'Who moves in? Current situation, preferred date, questions …',
          street: '123 Main St',
          postal_code: '12345',
          city: 'City',
          viewing_times: 'Preferred days/times',
          co_applicant_names: 'Roommates, partner, children …',
          budget: 'e.g., 1500'
        },
        selects: {
          employment: ['Please choose','Employed (permanent)','Employed (fixed-term)','Self-employed/Freelance','Student/Apprentice','Other'],
          pets: ['Please choose','No','Yes'],
          
          
          parking: ['Please choose','No need','Outdoor space','Underground parking'],
          how_did_you_hear: ['Please choose','Website','Immobilienscout24','Immowelt','Recommendation','Social media','Other']
        },
        submit: 'Send inquiry',
        note: '* Required fields',
        success_h3: 'Thank you!',
        success_p: 'Your request has been received. We will get back to you soon.',
        error_h3: 'Something went wrong.',
        error_p: 'Please try again later or <a href="/kontakt">contact us</a>.',
        errs: {
          required: 'Required.',
          email: 'Invalid email.',
          phone: 'Please enter a valid phone number.',
          min_time: 'Please take a moment before submitting.',
          cooldown: 'Please wait a bit before sending again.'
        }
      }
    };

    function applyI18n() {
      const t = I18N[LANG];
      // Header
      const title = q('.zam-apply__title'); if (title) title.textContent = t.title;
      const subtitle = q('.zam-apply__subtitle'); if (subtitle) subtitle.textContent = t.subtitle;
      const summary = q('.zam-apply__toggle summary'); if (summary) summary.textContent = (LANG==='en'?'Apply now!':'Jetzt bewerben!');
      // Gruppenüberschriften (optional vorhanden)
      const setH = (id, de, en) => { const h = q('#'+id); if (h) h.textContent = (LANG==='en'? en : de); };
      setH('grp-contact', 'Kontakt', 'Contact');
      setH('grp-move', 'Einzug', 'Move-in');
      setH('grp-household', 'Haushalt & Einkommen', 'Household & income');
      setH('grp-address', 'Adresse', 'Address');
      setH('grp-prefs', 'Präferenzen', 'Preferences');
      setH('grp-notes', 'Zusatzinformationen', 'Additional information');
      // Labels
      const setLabel = (name, html) => { const lab = q(`label[for="${name}"]`); if (lab) lab.innerHTML = html; };
      setLabel('full_name', t.labels.full_name);
      setLabel('email', t.labels.email);
      setLabel('phone', t.labels.phone);
      setLabel('move_in', t.labels.move_in);
      setLabel('occupants', t.labels.occupants);
      setLabel('income', t.labels.income);
      setLabel('employment', t.labels.employment);
      setLabel('message', t.labels.message);
      setLabel('street', t.labels.street);
      setLabel('postal_code', t.labels.postal_code);
      setLabel('city', t.labels.city);
      setLabel('country', LANG==='en' ? 'Country' : 'Land');
      setLabel('earliest_move_in', t.labels.earliest_move_in);
      setLabel('latest_move_in', t.labels.latest_move_in);
      setLabel('pets', t.labels.pets);
      setLabel('smoker', t.labels.smoker);
      
      setLabel('parking', t.labels.parking);
      setLabel('budget', t.labels.budget);
      setLabel('how_did_you_hear', t.labels.how_did_you_hear);
      setLabel('viewing_times', t.labels.viewing_times);
      setLabel('co_applicant_names', t.labels.co_applicant_names);
      const privacySpan = q('.checks .check span'); if (privacySpan) privacySpan.innerHTML = t.labels.privacy;
      // Placeholders
      const setPH = (name, ph) => { const el = q(`#${name}`); if (el && 'placeholder' in el) el.placeholder = ph; };
      setPH('full_name', t.placeholders.full_name);
      setPH('email', t.placeholders.email);
      setPH('phone', t.placeholders.phone);
      const msg = q('#message'); if (msg) msg.placeholder = t.placeholders.message;
      setPH('street', t.placeholders.street);
      setPH('postal_code', t.placeholders.postal_code);
      setPH('city', t.placeholders.city);
      const phCountry = LANG==='en' ? 'Germany' : 'Deutschland';
      setPH('country', phCountry);
      const vt = q('#viewing_times'); if (vt) vt.placeholder = t.placeholders.viewing_times;
      const co = q('#co_applicant_names'); if (co) co.placeholder = t.placeholders.co_applicant_names;
      const bud = q('#budget'); if (bud) bud.placeholder = t.placeholders.budget;
      // Select options (first option is placeholder)
      // income ist nun number input, keine Select-Befüllung mehr
      const employmentSel = q('#employment');
      if (employmentSel && t.selects.employment?.length) {
        const vals = t.selects.employment;
        employmentSel.innerHTML = '';
        vals.forEach((label, idx) => {
          const opt = document.createElement('option');
          opt.textContent = label;
          if (idx === 0) { opt.value = ''; opt.disabled = true; opt.selected = true; }
          employmentSel.appendChild(opt);
        });
      }
      const setSelect = (id, arr) => {
        const sel = q('#' + id);
        if (sel && Array.isArray(arr) && arr.length) {
          const current = sel.value;
          sel.innerHTML = '';
          arr.forEach((label, idx) => {
            const opt = document.createElement('option');
            opt.textContent = label;
            if (idx === 0) { opt.value = ''; opt.disabled = true; opt.selected = true; }
            sel.appendChild(opt);
          });
          const canRestore = Array.from(sel.options).some(o => o.textContent === current);
          if (canRestore) sel.value = current;
        }
      };
      setSelect('pets', t.selects.pets);
      
      
      // Parking-Select wird im HTML definiert; keine Außenstellplatz-Option mehr
      setSelect('how_did_you_hear', t.selects.how_did_you_hear);
      // Viewing selects befüllen
      const daySel = q('#viewing_day');
      if (daySel) {
        const arr = (LANG==='en') ? ['Please choose','Weekdays','Weekend'] : ['Bitte wählen','Unter der Woche','Am Wochenende'];
        const cur = daySel.value; daySel.innerHTML='';
        arr.forEach((label, idx)=>{ const o=document.createElement('option'); o.textContent=label; if(idx===0){o.value='';o.disabled=true;o.selected=true;} daySel.appendChild(o); });
        if (Array.from(daySel.options).some(o=>o.textContent===cur)) daySel.value = cur;
      }
      const timeSel = q('#viewing_time');
      if (timeSel) {
        const arr = (LANG==='en') ? ['Please choose','Morning','Midday','Evening'] : ['Bitte wählen','Morgens','Mittags','Abends'];
        const cur = timeSel.value; timeSel.innerHTML='';
        arr.forEach((label, idx)=>{ const o=document.createElement('option'); o.textContent=label; if(idx===0){o.value='';o.disabled=true;o.selected=true;} timeSel.appendChild(o); });
        if (Array.from(timeSel.options).some(o=>o.textContent===cur)) timeSel.value = cur;
      }
      // Buttons & Notes
      const note = q('.form-note'); if (note) note.textContent = t.note;
      if (SUBMIT) SUBMIT.firstChild && (SUBMIT.firstChild.nodeType === 3) && (SUBMIT.firstChild.textContent = t.submit + ' ');
      if (NEXT) NEXT.textContent = (LANG==='en' ? 'Next' : 'Weiter');
      if (PREV) PREV.textContent = (LANG==='en' ? 'Back' : 'Zurück');
      // Feedback
      if (SUCCESS) { const h = SUCCESS.querySelector('h3'); const p = SUCCESS.querySelector('p'); if (h) h.textContent = t.success_h3; if (p) p.textContent = t.success_p; }
      if (ERR) { const h = ERR.querySelector('h3'); const p = ERR.querySelector('p'); if (h) h.textContent = t.error_h3; if (p) p.innerHTML = t.error_p; }
    }

    // ===== Multi-Step: Gruppen definieren =====
    const GROUPS = [
      ['grp-contact','full_name','email','phone'],
      ['grp-move','move_in','earliest_move_in'],
      ['grp-household','occupants','income','employment'],
      ['grp-address','street','postal_code','city','country'],
      ['grp-prefs','pets','how_did_you_hear','parking'],
      ['grp-notes','viewing_day','viewing_time','privacy']
    ];
    let currentStep = 0;
    let isRestoringDraft = false;
    function isFieldValid(name){
      const el = getField(name);
      if (!el) return true;
      if (el.type === 'checkbox') return !!el.checked;
      if (!el.value) return false;
      if (name === 'email') return isEmail(el.value);
      if (name === 'phone') return isPhoneLike(el.value);
      
      // Datumsvalidierung
      if (el.type === 'date' && el.value) {
        const date = new Date(el.value);
        const availableFrom = WRAP.dataset.verfuegbarAb;
        
        if (name === 'move_in') {
          // Gewünschter Einzug: muss >= verfügbar-ab sein
          if (availableFrom) {
            const parts = availableFrom.split('.');
            if (parts.length === 3) {
              const day = parts[0].padStart(2, '0');
              const month = parts[1].padStart(2, '0');
              const year = parts[2];
              const isoDate = `${year}-${month}-${day}`;
              const availableFromDate = new Date(isoDate);
              return date >= availableFromDate;
            }
          }
        } else if (name === 'earliest_move_in') {
          // Frühester Einzug: muss zwischen verfügbar-ab und gewünschtem Einzug sein
          const moveInField = getField('move_in');
          if (!moveInField?.value) return false; // Muss gewünschter Einzug gesetzt sein
          
          const moveInDate = new Date(moveInField.value);
          if (availableFrom) {
            const parts = availableFrom.split('.');
            if (parts.length === 3) {
              const day = parts[0].padStart(2, '0');
              const month = parts[1].padStart(2, '0');
              const year = parts[2];
              const isoDate = `${year}-${month}-${day}`;
              const availableFromDate = new Date(isoDate);
              return date >= availableFromDate && date <= moveInDate;
            }
          }
          return date <= moveInDate;
        }
      }
      
      return true;
    }
    // Tracke pro Feld, ob der Benutzer die Eingabe bewusst "bestätigt" hat
    const confirmed = new Set();
    function markConfirmed(name){ if (!name) return; confirmed.add(name); }
    function isFieldConfirmed(name){ return confirmed.has(name); }
    function isStepComplete(idx){
      const group = GROUPS[idx] || [];
      const groupId = group[0];
      const names = group.slice(1);
      // Spezialregel: Im Einzugs-Step erst weiter, wenn ALLE drei Datumsfelder gesetzt sind
      if (groupId === 'grp-move') {
        const mustHave = ['move_in','earliest_move_in'];
        return mustHave.every(n => {
          const el = getField(n);
          return el && !!el.value;
        });
      }
      for (const name of names) {
        if (!REQUIRED.includes(name)) continue;
        if (!isFieldValid(name) || !isFieldConfirmed(name)) return false;
      }
      return true;
    }
    function isFormComplete(){
      // Für die Anzeige des Submit-Buttons genügt Validität aller Pflichtfelder.
      // (Bestätigungs-Status wird weiterhin für Auto-Advance genutzt.)
      for (const name of REQUIRED) { if (!isFieldValid(name)) return false; }
      return true;
    }
    function updateControlsVisibility(){
      const isFirst = currentStep === 0;
      const isLast = currentStep === GROUPS.length - 1;
      if (PREV) { PREV.hidden = isFirst; PREV.disabled = isFirst; }
      // "Weiter" nur zeigen, wenn nicht letzter Step
      if (NEXT) { NEXT.hidden = isLast; }
      const actions = q('.form-actions');
      const showSubmit = isLast && isFormComplete();
      if (actions) actions.hidden = !showSubmit;
      if (SUBMIT) SUBMIT.hidden = !showSubmit;
      const NAV = q('.form-steps-nav');
      if (NAV) NAV.hidden = (!!(PREV && PREV.hidden)) && (!!(NEXT && NEXT.hidden));
    }

    function showStep(idx){
      currentStep = Math.max(0, Math.min(GROUPS.length-1, idx));
      const titles = new Set(GROUPS.map(g=>g[0]));
      qa('.form-grid > *').forEach(node => {
        if (node.classList.contains('group-title')) {
          const h = node.querySelector('h3');
          node.hidden = !(h && titles.has(h.id) && h.id === GROUPS[currentStep][0]);
          return;
        }
        const input = node.querySelector('input, select, textarea, .check input');
        if (!input) { node.hidden = true; return; }
        const name = input.name || input.id;
        node.hidden = GROUPS[currentStep].indexOf(name) === -1;
      });
      updateControlsVisibility();
    }
    function validateStep(){
      let ok = true; let firstInvalid = null;
      const names = GROUPS[currentStep].slice(1);
      names.forEach(name => {
        if (!REQUIRED.includes(name)) return;
        const el = getField(name); if (!el) return;
        if (el.type === 'checkbox' && !el.checked) { ok = false; showError(name, I18N[LANG].errs.required); if (!firstInvalid) firstInvalid = el; return; }
        if (!el.value && el.type !== 'checkbox') { ok = false; showError(name, I18N[LANG].errs.required); if (!firstInvalid) firstInvalid = el; return; }
        if (name === 'email' && !isEmail(el.value)) { ok = false; showError(name, I18N[LANG].errs.email); if (!firstInvalid) firstInvalid = el; return; }
        if (name === 'phone' && !isPhoneLike(el.value)) { ok = false; showError(name, I18N[LANG].errs.phone); if (!firstInvalid) firstInvalid = el; return; }
        
        // Datumsvalidierung
        if (el.type === 'date' && el.value) {
          const availableFrom = WRAP.dataset.verfuegbarAb;
          
          if (name === 'move_in' && availableFrom) {
            const date = new Date(el.value);
            const parts = availableFrom.split('.');
            if (parts.length === 3) {
              const day = parts[0].padStart(2, '0');
              const month = parts[1].padStart(2, '0');
              const year = parts[2];
              const isoDate = `${year}-${month}-${day}`;
              const availableFromDate = new Date(isoDate);
              if (date < availableFromDate) {
                ok = false; 
                showError(name, LANG === 'en' ? 'Move-in date must be on or after availability date' : 'Einzugsdatum muss am oder nach dem Verfügbarkeitsdatum liegen'); 
                if (!firstInvalid) firstInvalid = el; 
                return;
              }
            }
          } else if (name === 'earliest_move_in') {
            const moveInField = getField('move_in');
            if (!moveInField?.value) {
              ok = false; 
              showError(name, LANG === 'en' ? 'Please select desired move-in date first' : 'Bitte wählen Sie zuerst das gewünschte Einzugsdatum'); 
              if (!firstInvalid) firstInvalid = el; 
              return;
            }
            
            const date = new Date(el.value);
            const moveInDate = new Date(moveInField.value);
            if (date > moveInDate) {
              ok = false; 
              showError(name, LANG === 'en' ? 'Earliest move-in must be on or before desired move-in date' : 'Frühester Einzug muss am oder vor dem gewünschten Einzugsdatum liegen'); 
              if (!firstInvalid) firstInvalid = el; 
              return;
            }
            
            if (availableFrom) {
              const parts = availableFrom.split('.');
              if (parts.length === 3) {
                const day = parts[0].padStart(2, '0');
                const month = parts[1].padStart(2, '0');
                const year = parts[2];
                const isoDate = `${year}-${month}-${day}`;
                const availableFromDate = new Date(isoDate);
                if (date < availableFromDate) {
                  ok = false; 
                  showError(name, LANG === 'en' ? 'Earliest move-in must be on or after availability date' : 'Frühester Einzug muss am oder nach dem Verfügbarkeitsdatum liegen'); 
                  if (!firstInvalid) firstInvalid = el; 
                  return;
                }
              }
            }
          }
        }
      });
      if (!ok && firstInvalid && typeof firstInvalid.focus === 'function') firstInvalid.focus();
      return ok;
    }
    if (NEXT) NEXT.addEventListener('click', ()=>{ if (validateStep()) showStep(currentStep+1); });
    if (PREV) PREV.addEventListener('click', ()=> showStep(currentStep-1));

    let lastInteractedStep = null;
    function getStepIndexForField(name){
      for (let i=0;i<GROUPS.length;i++) { if (GROUPS[i].includes(name)) return i; }
      return null;
    }
    function checkAutoAdvance(){
      if (isRestoringDraft) { updateControlsVisibility(); return; }
      // Update Sichtbarkeit für alle Controls
      updateControlsVisibility();
      // Auto-Advance entfernt - funktioniert nicht zuverlässig
    }
    // ===== Mobile: Auto-Fokus auf nächstes Feld =====
    const IS_MOBILE = (typeof window.matchMedia === 'function' && window.matchMedia('(pointer:coarse)').matches) || (window.innerWidth <= 680);
    function stepFieldNames(idx){ return (GROUPS[idx] || []).slice(1).filter(n => !!getField(n)); }
    function focusFieldByName(name){
      const el = getField(name);
      if (!el) return false;
      if (el.offsetParent === null) return false;
      try { 
        el.focus({ preventScroll: false }); 
        // Bei Input/Textarea: Text selektieren und Cursor positionieren
        if (typeof el.select === 'function' && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
          el.select();
          // Cursor ans Ende setzen
          setTimeout(() => {
            if (el.setSelectionRange) {
              el.setSelectionRange(el.value.length, el.value.length);
            }
          }, 10);
        }
      } catch {}
      return true;
    }
    function focusNextFieldFrom(name){
      if (!IS_MOBILE) return;
      
      // Prüfe ob der aktuelle Step Datepicker oder Selects enthält
      const currentFields = stepFieldNames(currentStep);
      const hasDatepickerOrSelect = currentFields.some(fieldName => {
        const el = getField(fieldName);
        return el && (el.type === 'date' || el.tagName === 'SELECT');
      });
      
      // Kein Auto-Springen bei Steps mit Datepicker oder Selects
      if (hasDatepickerOrSelect) return;
      
      const fields = currentFields;
      const i = fields.indexOf(name);
      if (i >= 0 && i < fields.length - 1) { 
        focusFieldByName(fields[i + 1]); 
        return; 
      }
      // Auto-Advance zu nächstem Step entfernt - nur noch Fokus auf Submit am Ende
      if (currentStep === GROUPS.length - 1 && isFormComplete() && SUBMIT) { 
        try { SUBMIT.focus(); } catch {} 
      }
    }
    // Auf Eingaben reagieren
    FORM.addEventListener('input', (e)=>{ 
      saveDraftDebounced(); 
      const t = e.target; const name = t?.name || t?.id;
      // Bei Autofill/Paste sofort zum nächsten (nur mobil), wenn Feld valide ist
      if (IS_MOBILE && name && isFieldValid(name)) {
        const it = e.inputType || '';
        if (/insert(From|Replacement|Composition)/i.test(it)) { 
          // Kurze Verzögerung für Autofill, damit das Feld vollständig gefüllt ist
          setTimeout(() => focusNextFieldFrom(name), 100);
        }
      }
      checkAutoAdvance(); 
    }, { passive: true });
    FORM.addEventListener('change', (e)=>{
      const t = e.target;
      if (!t) return;
      const name = t.name || t.id;
      if (!name) return;
      // Bestätigung: bei Enter, Blur, Auswahl von Selects, und bei Date nach Change
      if (t.tagName === 'SELECT' || t.type === 'checkbox' || t.type === 'date') {
        markConfirmed(name);
      }
      saveDraftDebounced();
      lastInteractedStep = getStepIndexForField(name);
      if (IS_MOBILE && isFieldValid(name)) {
        // Kurze Verzögerung für Change-Events
        setTimeout(() => focusNextFieldFrom(name), 50);
      }
      checkAutoAdvance();
    }, { passive: true });
    FORM.addEventListener('keydown', (e)=>{
      if (e.key === 'Enter') {
        const t = e.target; const name = t?.name || t?.id; if (name) { markConfirmed(name); lastInteractedStep = getStepIndexForField(name); }
        e.preventDefault(); // Enter soll nicht submitten zwischen Steps
        saveDraftDebounced();
        if (IS_MOBILE && name && isFieldValid(name)) {
          // Kurze Verzögerung für Enter
          setTimeout(() => focusNextFieldFrom(name), 50);
        }
        checkAutoAdvance();
      }
    });
    FORM.addEventListener('blur', (e)=>{
      const t = e.target; const name = t?.name || t?.id; if (name) { markConfirmed(name); lastInteractedStep = getStepIndexForField(name); }
      saveDraftDebounced();
      if (IS_MOBILE && name && isFieldValid(name)) {
        // Kurze Verzögerung für Blur
        setTimeout(() => focusNextFieldFrom(name), 50);
      }
      checkAutoAdvance();
    }, true);

    // Progressbar aktualisieren
    const PROG = q('#progressBar');
    function updateProgress(){
      const pct = Math.round(((currentStep) / (GROUPS.length - 1)) * 100);
      if (PROG) {
        PROG.style.width = pct + '%';
        PROG.setAttribute('aria-valuenow', String(pct));
      }
    }
    const showStepOrig = showStep;
    showStep = function(idx){
      showStepOrig(idx);
      updateProgress();
    };

    // ===== Draft-Persistenz (24h) =====
    const DRAFT_KEY = `zam_apply_draft_${WRAP.dataset.unitId || 'global'}`;
    function collectDraft(){
      const data = {};
      Array.from(FORM.elements).forEach(el => {
        if (!el || !el.name) return;
        if (el.type === 'submit' || el.type === 'button') return;
        if (el.type === 'checkbox') data[el.name] = !!el.checked;
        else data[el.name] = (el.value || '');
      });
      return data;
    }
    function applyDraft(data){
      if (!data) return;
      Object.keys(data).forEach(name => {
        const el = getField(name);
        if (!el) return;
        const val = data[name];
        if (el.type === 'checkbox') { el.checked = !!val; }
        else { if (typeof val === 'string') el.value = val; }
      });
    }
    function saveDraft(){
      try {
        const payload = { saved_at: Date.now(), data: collectDraft() };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
      } catch {}
    }
    const saveDraftDebounced = (()=>{ let t=null; return ()=>{ clearTimeout(t); t=setTimeout(saveDraft, 200); }; })();
    function clearDraft(){ try { localStorage.removeItem(DRAFT_KEY); } catch {} }
    function loadDraft(){
      try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (!raw) return null;
        const obj = JSON.parse(raw);
        if (!obj || !obj.saved_at || !obj.data) return null;
        if ((Date.now() - obj.saved_at) > 24*60*60*1000) { localStorage.removeItem(DRAFT_KEY); return null; }
        return obj.data;
      } catch { return null; }
    }
    function findFirstIncompleteStep(){
      for (let i=0; i<GROUPS.length; i++){
        const names = GROUPS[i].slice(1);
        for (const name of names){
          if (!REQUIRED.includes(name)) continue;
          if (!isFieldValid(name)) return i;
        }
      }
      return GROUPS.length - 1;
    }

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

    // ===== Dynamische Felder / Pflichtfelder (pro Unit) =====
    const extraFieldsRaw = WRAP.dataset.extraFields || '';
    const requiredFieldsRaw = WRAP.dataset.requiredFields || '';
    let extraFields = [];
    try { if (extraFieldsRaw) extraFields = JSON.parse(extraFieldsRaw); } catch {}
    if (!Array.isArray(extraFields)) extraFields = [];

    let extraRequired = [];
    try {
      if (requiredFieldsRaw) {
        const parsed = JSON.parse(requiredFieldsRaw);
        if (Array.isArray(parsed)) extraRequired = parsed;
      }
    } catch {
      if (requiredFieldsRaw && typeof requiredFieldsRaw === 'string') {
        extraRequired = requiredFieldsRaw.split(',').map(s => s.trim()).filter(Boolean);
      }
    }
    REQUIRED = Array.from(new Set([...REQUIRED, ...extraRequired]));

    // Render dynamische Zusatzfelder
    const extraFieldNames = [];
    function renderExtraFields() {
      if (!extraFields.length) return;
      const grid = q('.form-grid');
      const checks = q('.checks');
      const insertBefore = checks || grid.lastElementChild;
      extraFields.forEach((cfg) => {
        if (!cfg || !cfg.name) return;
        const type = (cfg.type || 'text').toLowerCase();
        const name = String(cfg.name);
        const id = name;
        const isRequired = !!cfg.required || REQUIRED.includes(name);
        const labelTxt = (typeof cfg.label === 'object') ? (cfg.label[LANG] || cfg.label.de || cfg.label.en || name) : (cfg.label || name);
        const placeholderTxt = (typeof cfg.placeholder === 'object') ? (cfg.placeholder[LANG] || cfg.placeholder.de || cfg.placeholder.en || '') : (cfg.placeholder || '');

        const wrap = document.createElement('div');
        wrap.className = 'field' + (cfg.fullWidth ? ' field--full' : '');

        const label = document.createElement('label');
        label.setAttribute('for', id);
        label.innerHTML = labelTxt + (isRequired ? ' *' : '');
        wrap.appendChild(label);

        let inputEl;
        if (type === 'textarea') {
          inputEl = document.createElement('textarea');
          inputEl.rows = cfg.rows || 3;
        } else if (type === 'select') {
          inputEl = document.createElement('select');
          const opts = Array.isArray(cfg.options) ? cfg.options : [];
          // First placeholder option if provided
          const ph = placeholderTxt || (LANG === 'en' ? 'Please choose' : 'Bitte wählen');
          const opt0 = document.createElement('option');
          opt0.value = '';
          opt0.textContent = ph;
          opt0.disabled = true;
          opt0.selected = true;
          inputEl.appendChild(opt0);
          opts.forEach((o) => {
            const opt = document.createElement('option');
            if (typeof o === 'string') { opt.value = o; opt.textContent = o; }
            else { opt.value = o.value ?? ''; const lbl = (typeof o.label === 'object') ? (o.label[LANG] || o.label.de || o.label.en || String(o.value || '')) : (o.label || String(o.value || '')); opt.textContent = lbl; }
            inputEl.appendChild(opt);
          });
        } else if (type === 'checkbox') {
          inputEl = document.createElement('input');
          inputEl.type = 'checkbox';
        } else {
          inputEl = document.createElement('input');
          inputEl.type = type;
          if (placeholderTxt) inputEl.placeholder = placeholderTxt;
        }

        inputEl.id = id;
        inputEl.name = name;
        if (isRequired) inputEl.required = true;
        wrap.appendChild(inputEl);

        const err = document.createElement('p');
        err.className = 'error';
        err.dataset.for = name;
        err.setAttribute('role', 'status');
        err.setAttribute('aria-live', 'polite');
        wrap.appendChild(err);

        if (insertBefore && insertBefore.parentNode === grid) grid.insertBefore(wrap, insertBefore);
        else grid.appendChild(wrap);

        extraFieldNames.push({ name, type });
      });
    }

    // ===== Facts füllen (lokal) =====
    // Verfügbar ab Datum formatieren (DD.MM.JJJJ -> DD.MM.JJJJ)
    const availableFromRaw = WRAP?.dataset.verfuegbarAb || '';
    const availableFromFormatted = availableFromRaw || '—';
    setText('#availableFrom', availableFromFormatted);
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

    // Amenities-Liste (Dropdown)
    const amenitiesList = q('#amenitiesList');

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

    // === Ausstattung: strukturierte Erkennung (Kategorie: Wert; ...) ===
    const KEY_MAP = {
      'einbauküche': 'Einbauküche',
      'ebk': 'Einbauküche',
      'balkon/loggia/terrasse': 'Außenbereich',
      'balkon': 'Außenbereich',
      'loggia': 'Außenbereich',
      'terrasse': 'Außenbereich',
      'außenliegender sonnenschutz': 'Sonnenschutz',
      'sonnenschutz': 'Sonnenschutz',
      'heizung': 'Heizung',
      'fußbodenheizung': 'Heizung',
      'boden': 'Boden',
      'bodenbelag': 'Boden',
      'lüftung': 'Lüftung',
      'handtuchheizkörper': 'Weitere Ausstattung',
      'sanitär': 'Sanitär',
      'duschkabine': 'Duschkabine',
      'zweite abtrennung': 'Duschkabine',
      'abtrennung': 'Duschkabine',
      'zweite duschkabine': 'Duschkabine',
      'bad/wc': 'Bad/WC',
      'bad': 'Bad/WC',
      'wc': 'Bad/WC'
    };

    const normalize = (s) => (s || '')
      .replace(/\u00A0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const canonicalizeKey = (rawKey) => {
      const k = normalize(String(rawKey).toLowerCase());
      return KEY_MAP[k] || (rawKey || '').trim();
    };

    function parseAmenitiesPairs(text){
      const rows = [];
      if (!text) return rows;
      // Teile an ";" oder Zeilenumbrüchen
      const parts = text.split(/;|\n/).map(p => normalize(p)).filter(Boolean);
      for (const part of parts) {
        const idx = part.indexOf(':');
        if (idx === -1) {
          // freies Tag
          rows.push({ key: 'Ausstattung', value: part });
          continue;
        }
        const left = part.slice(0, idx);
        const right = normalize(part.slice(idx+1));
        let key = canonicalizeKey(left);
        let value = right;
        // Spezialfall Außenbereich
        if (/balkon\/?loggia\/?terrasse/i.test(left)) {
          key = 'Außenbereich';
        }
        rows.push({ key, value });
      }
      return rows;
    }

    function formatValueByKey(key, value){
      let out = value || '';
      // Duschkabine: 90 → 90 x 90 cm; Eck-/Fronteinstieg → Eck- und Fronteinstieg
      if (/^duschkabine$/i.test(key)) {
        out = out.replace(/\b(\d{2,3})(?!\s*[x×])\b/g, (m, n) => `${n} x ${n} cm`);
        out = out.replace(/Eck-?\/?Fronteinstieg/gi, 'Eck- und Fronteinstieg');
        out = out.replace(/Eckeinstieg\s+/gi, '');
        out = out.replace(/\s-\s/g, ' – ');
      }
      // Bad/WC: bei Menge > 1 → 'Bad' → 'Bäder'
      if (/^bad\/wc$/i.test(key)) {
        const numMatch = out.match(/(\d+[\.,]?\d*)/);
        const num = numMatch ? parseFloat(String(numMatch[1]).replace(',', '.')) : NaN;
        if (!isNaN(num) && num > 1) {
          out = out.replace(/\bBad\b/g, 'Bäder');
        }
      }
      return out;
    }

    function addAmenityKV(key, value){
      if (!amenitiesList) return;
      const li = document.createElement('li');
      const k = document.createElement('span'); k.className = 'amenity-key'; k.textContent = key;
      const sep = document.createElement('span'); sep.className = 'amenity-sep'; sep.textContent = ' – ';
      const v = document.createElement('span'); v.className = 'amenity-value'; v.textContent = value;
      li.appendChild(k); li.appendChild(sep); li.appendChild(v);
      amenitiesList.appendChild(li);
    }

    (function renderAmenitiesFromRTE(){
      if (!amenitiesList) return;     // Safety
      amenitiesList.replaceChildren();

      if (!rte) return;               // kein RTE → keine Liste

      // 0) Versuche strukturierte Paare zu parsen
      const textAll = normalize(rte.innerText || '');
      const rows = parseAmenitiesPairs(textAll);

      if (rows && rows.length) {
        const acc = new Map(); // key -> Set of values
        rows.forEach(({ key, value }) => {
          const k = (key || '').trim();
          let v = formatValueByKey(k, value || '');
          const nkey = normalize(k).toLowerCase();
          const nval = normalize(v).toLowerCase();
          if (!nkey || !nval) return;
          if (!acc.has(k)) acc.set(k, new Set());
          acc.get(k).add(v);
        });
        acc.forEach((set, k) => {
          const joined = Array.from(set.values()).join(', ');
          addAmenityKV(k, joined);
        });
        return;
      }

      // 1) Fallback: Listeneinträge priorisieren und als reine Zeilen rendern
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
        addAmenity(s.replace(/\s+/g, ' ').trim());
      });
    })();

    // ===== Bild aus CMS binden =====
    (async function bindUnitGallery(){
      const IMG_WRAP = q('.zam-apply__image');
      if (!IMG_WRAP) return;
      // Quelle: Multi-Image-Block im Webflow-Item (hidden) mit Klasse .gallery-source
      const container = WRAP.closest('.collection-item') || WRAP.parentElement || document;
      // Priorität 1: Datenfelder data-img1..3 (nur gültige URLs)
      const isValidUrl = (s) => {
        if (!s) return false;
        const v = String(s).trim();
        if (!v || v.includes('{{')) return false; // ungefülltes Template
        return /^(https?:|\/\/|\/|data:image\/)/i.test(v);
      };
      const urls = [WRAP.dataset.img1, WRAP.dataset.img2, WRAP.dataset.img3]
        .map(v => (v||'').trim())
        .filter(isValidUrl);
      // Priorität 2: Multi-Image-Quelle im DOM
      if (!urls.length) {
        const srcImgs = Array.from(container.querySelectorAll('.gallery-source img'));
        urls.push(...srcImgs.map(i => i.currentSrc || i.src).filter(Boolean));
      }
      // Fallback: Einzelbild suchen
      if (!urls.length) {
        const fallback = container.querySelector('img.rte-image, .unit-main-image img, .w-dyn-item img, .w-richtext img');
        if (fallback && fallback.src) urls.push(fallback.src);
      }
      if (!urls.length) { IMG_WRAP.style.display = 'none'; console.warn('[ZAM] Keine gültigen Slider-Bilder gefunden.'); return; }

      // Slider-Markup
      const slider = document.createElement('div'); slider.className = 'zam-apply__slider';
      const track = document.createElement('div'); track.className = 'zam-apply__slides';
      // Preload und Slides erstellen
      const preloaded = new Map();
      await Promise.all(urls.map(u => new Promise((res)=>{ const img = new Image(); img.onload=()=>{ preloaded.set(u, true); res(); }; img.onerror=()=>res(); img.src=u; })));
      urls.forEach((u) => { 
        const s = document.createElement('div'); 
        s.className = 'zam-apply__slide'; 
        s.style.backgroundImage = `url("${u.replace(/"/g,'\\"')}")`; 
        track.appendChild(s); 
      });
      const nav = document.createElement('div'); nav.className = 'zam-apply__nav';
      const prev = document.createElement('button'); prev.type='button'; prev.className='zam-apply__btn zam-apply__btn--prev'; prev.setAttribute('aria-label', LANG==='en'?'Previous image':'Vorheriges Bild');
      const next = document.createElement('button'); next.type='button'; next.className='zam-apply__btn zam-apply__btn--next'; next.setAttribute('aria-label', LANG==='en'?'Next image':'Nächstes Bild');
      nav.appendChild(prev); nav.appendChild(next);
      const dots = document.createElement('div'); dots.className = 'zam-apply__dots';
      urls.forEach((_, i)=>{ const d=document.createElement('button'); d.type='button'; d.className='zam-apply__dot'; d.setAttribute('aria-label', (LANG==='en'? 'Go to image ':'Zum Bild ') + (i+1)); if(i===0) d.setAttribute('aria-current','true'); dots.appendChild(d); });
      slider.appendChild(track); slider.appendChild(nav); slider.appendChild(dots);
      IMG_WRAP.replaceChildren(slider);

      // Slider-Logic
      let idx = 0;
      function update(){
        track.style.transform = `translateX(-${idx*100}%)`;
        Array.from(dots.children).forEach((d, i)=>{ if (i===idx) d.setAttribute('aria-current','true'); else d.removeAttribute('aria-current'); });
      }
      function go(n){ idx = (n+urls.length)%urls.length; update(); }
      prev.addEventListener('click', ()=> go(idx-1));
      next.addEventListener('click', ()=> go(idx+1));
      Array.from(dots.children).forEach((d, i)=> d.addEventListener('click', ()=> go(i)));
      update();
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
        if (el.type === 'checkbox' && !el.checked) { ok = false; showError(name, I18N[LANG].errs.required); if (!firstInvalid) firstInvalid = el; return; }
        if (!el.value && el.type !== 'checkbox') { ok = false; showError(name, I18N[LANG].errs.required); if (!firstInvalid) firstInvalid = el; return; }
        if (name === 'email' && !isEmail(el.value)) { ok = false; showError(name, I18N[LANG].errs.email); if (!firstInvalid) firstInvalid = el; return; }
        if (name === 'phone' && !isPhoneLike(el.value)) { ok = false; showError(name, I18N[LANG].errs.phone); if (!firstInvalid) firstInvalid = el; return; }
      });

      // Hinweis: Rauchen ist verboten (kein Feld mehr, nur Info)

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
      // Zeitbasierte Schranke
      const MIN_MS = 2500;
      if (Date.now() - formInitAt < MIN_MS) {
        if (ERR) { ERR.hidden = false; const p = ERR.querySelector('p'); if (p) p.textContent = I18N[LANG].errs.min_time; }
        return;
      }

      // Cooldown (lokal, per Unit)
      const cdKey = `zam_apply_cd_${meta.unit_id || 'global'}`;
      const COOLDOWN_MS = 8000;
      try {
        const last = Number(localStorage.getItem(cdKey) || '0');
        if (Date.now() - last < COOLDOWN_MS) {
          if (ERR) { ERR.hidden = false; const p = ERR.querySelector('p'); if (p) p.textContent = I18N[LANG].errs.cooldown; }
          return;
        }
      } catch {}

      if (!validate()) return;

      const spinner = SUBMIT ? SUBMIT.querySelector('.btn__spinner') : null;
      if (SUBMIT) SUBMIT.disabled = true;
      if (spinner) spinner.style.display = 'inline-block';

      try {
        // Sammle Extras
        const extras = {};
        extraFieldNames.forEach(({ name, type }) => {
          const el = getField(name);
          if (!el) return;
          if (type === 'checkbox') extras[name] = !!el.checked;
          else extras[name] = (el.value || '').toString();
        });

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
            
            street:     (FORM.street?.value || '').trim(),
            postal_code: (FORM.postal_code?.value || '').trim(),
            city:       (FORM.city?.value || '').trim(),
            country:    (FORM.country?.value || '').trim(),
            earliest_move_in: FORM.earliest_move_in?.value || '',
            latest_move_in:   '',
            pets:       FORM.pets?.value || '',
            smoker:     FORM.smoker?.value || '',
            
            parking:    FORM.parking?.value || '',
            
            how_did_you_hear: FORM.how_did_you_hear?.value || '',
            viewing_day: FORM.viewing_day?.value || '',
            viewing_time: FORM.viewing_time?.value || '',
            
            privacy:    !!FORM.privacy?.checked,
            page_url:   hf('page_url')?.value || '',
            utm_source: hf('utm_source')?.value || '',
            utm_medium: hf('utm_medium')?.value || '',
            utm_campaign: hf('utm_campaign')?.value || '',
            utm_content:  hf('utm_content')?.value || ''
          },
          lang: LANG,
          extras,
          idempotency_key: btoa((meta.unit_id || '') + '|' + ((FORM.email?.value) || '') + '|' + (new Date().toISOString().slice(0,10)))
        };

        let sentOk = false;
        const bodyStr = JSON.stringify(payload);
        if (isWebhookConfigured) {
          try {
            // Variante 1: multipart/form-data mit flachen Keys → Make.com erkennt Felder zuverlässig
            const fd = new FormData();
            const add = (k, v) => fd.append(k, v == null ? '' : String(v));
            add('submitted_at', payload.submitted_at);
            // Unit (geflacht)
            add('unit_unit_id', meta.unit_id || '');
            add('unit_name', meta.name || '');
            add('unit_haus', meta.haus || '');
            add('unit_stockwerk', meta.stockwerk || '');
            add('unit_zimmer', meta.zimmer || '');
            add('unit_wohnflaeche', meta.wohnflaeche || '');
            add('unit_kaltmiete', meta.kaltmiete || '');
            add('unit_nebenkosten', meta.nebenkosten || '');
            add('unit_warmmiete', meta.warmmiete || '');
            add('unit_ausrichtung', meta.ausrichtung || '');
            add('unit_status', meta.status || '');
            add('unit_form_aktiv', meta.form_aktiv || '');
            // Form (geflacht)
            Object.entries(payload.form).forEach(([k, v]) => add(`form_${k}`, v));
            // Extras (geflacht)
            if (extras && typeof extras === 'object') {
              Object.entries(extras).forEach(([k, v]) => add(`extra_${k}`, v));
            }
            add('lang', payload.lang);
            add('idempotency_key', payload.idempotency_key);
            // Zusätzlich Roh-JSON als Debug-Feld
            add('raw_json', bodyStr);

        const res = await fetch(MAKE_WEBHOOK_URL, {
          method: 'POST',
              body: fd,
              mode: 'cors',
          keepalive: true
        });
            sentOk = res.ok;
          } catch (err1) {
            // Fallback: text/plain + sendBeacon/no-cors
            try {
              const ok = navigator.sendBeacon && navigator.sendBeacon(MAKE_WEBHOOK_URL, new Blob([bodyStr], { type: 'text/plain;charset=UTF-8' }));
              if (ok) { sentOk = true; }
            } catch {}
            if (!sentOk) {
              try {
                await fetch(MAKE_WEBHOOK_URL, { method: 'POST', body: bodyStr, mode: 'no-cors', keepalive: true });
                sentOk = true;
              } catch (err2) {
                sentOk = false;
                throw err2;
              }
            }
          }
        } else {
          console.warn('[ZAM] Kein Webhook konfiguriert. Submission wird lokal simuliert.');
          sentOk = true;
        }

        if (sentOk) {
          FORM.reset();
          clearErrors();
          if (SUCCESS) SUCCESS.hidden = false;
          if (ERR) ERR.hidden = true;
          try { localStorage.setItem(cdKey, String(Date.now())); } catch {}
          // Draft löschen nach erfolgreicher Absendung
          clearDraft();
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

    // Toggle: Formular ein-/ausblenden
    const TOGGLE = q('.zam-apply__toggle');
    if (TOGGLE) {
      TOGGLE.addEventListener('toggle', () => {
        if (TOGGLE.open) {
          FORM.hidden = false;
        } else {
          FORM.hidden = true;
        }
      });
    } else {
      FORM.hidden = false;
    }

    // Initial i18n anwenden & dynamische Felder einfügen
    applyI18n();
    renderExtraFields();
    // Datepicker: moderne UI via Flatpickr (mit Fallback auf native showPicker)
    (async function enhanceDatePickers(){
      const dates = qa('input[type="date"]', FORM);
      if (!dates.length) return;
      try {
        await loadCSS('https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css');
        await loadJS('https://cdn.jsdelivr.net/npm/flatpickr');
        await loadJS('https://cdn.jsdelivr.net/npm/flatpickr/dist/l10n/de.js');
      } catch {}

      // Verfügbar-ab Datum aus data-* Attribut (Format: DD.MM.JJJJ)
      const availableFrom = WRAP.dataset.verfuegbarAb || '';
      let availableFromDate = null;
      if (availableFrom) {
        // Konvertiere DD.MM.JJJJ zu YYYY-MM-DD für Date-Objekt
        const parts = availableFrom.split('.');
        if (parts.length === 3) {
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          const year = parts[2];
          const isoDate = `${year}-${month}-${day}`;
          availableFromDate = new Date(isoDate);
        }
      }

      dates.forEach((input) => {
        if (!input || input.dataset.enhanced === '1') return;
        input.dataset.enhanced = '1';
        // Wrapper
        const wrap = document.createElement('div');
        wrap.className = 'date-input';
        const parent = input.parentNode; if (!parent) return;
        parent.insertBefore(wrap, input); wrap.appendChild(input);
        // Trigger
        const btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'date-trigger';
        btn.setAttribute('aria-label', LANG === 'en' ? 'Open calendar' : 'Kalender öffnen');
        wrap.appendChild(btn);
        
        // Overlay für earliest_move_in Feld
        let overlay = null;
        if (input.name === 'earliest_move_in') {
          overlay = document.createElement('div');
          overlay.className = 'date-overlay';
          overlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.1);
            cursor: not-allowed;
            z-index: 10;
            border-radius: 6px;
          `;
          wrap.appendChild(overlay);
        }

        let fp = null;
        const initFP = () => {
          try {
            // Datumsbeschränkungen basierend auf Feldname
            let minDate = null;
            let maxDate = null;
            let disabled = false;

            if (input.name === 'move_in') {
              // Gewünschter Einzug: mindestens verfügbar-ab Datum
              minDate = availableFromDate;
            } else if (input.name === 'earliest_move_in') {
              // Frühester Einzug: zwischen verfügbar-ab und gewünschtem Einzug
              minDate = availableFromDate;
              // Max-Datum wird dynamisch gesetzt, wenn gewünschter Einzug eingegeben wird
              disabled = !getField('move_in')?.value;
            }

            fp = window.flatpickr(input, {
              dateFormat: 'Y-m-d',
              altInput: true,
              altFormat: LANG === 'en' ? 'M j, Y' : 'd.m.Y',
              allowInput: true,
              locale: (window.flatpickr && window.flatpickr.l10ns) ? (LANG === 'en' ? (window.flatpickr.l10ns.default || undefined) : (window.flatpickr.l10ns.de || window.flatpickr.l10ns.default || undefined)) : undefined,
              disableMobile: true,
              clickOpens: true,
              appendTo: wrap,
              positionElement: wrap,
              minDate: minDate,
              maxDate: maxDate,
              disabled: disabled,
              onReady: [function(){
                if (input.value) {
                  try { fp.setDate(input.value, false, 'Y-m-d'); } catch {}
                }
                const alt = wrap.querySelector('.flatpickr-input[readonly]');
                if (alt) { alt.addEventListener('focus', openPicker, { passive: true }); alt.addEventListener('click', openPicker, { passive: true }); }
              }]
            });
          } catch {}
        };
        if (window.flatpickr) initFP();

        // Hinweis: Native Picker auf Mobile unterdrücken (nur Flatpickr verwenden)
        try { input.readOnly = true; input.setAttribute('inputmode', 'none'); } catch {}

        const openPicker = () => {
          // Nicht öffnen wenn Overlay vorhanden ist (earliest_move_in)
          if (overlay && overlay.parentNode) return;
          
          // Lazy-Init: falls Lib inzwischen verfügbar ist
          if (!fp && window.flatpickr) initFP();

          if (fp && typeof fp.open === 'function') { fp.open(); return; }
          // Kein Fallback mehr auf nativen Datepicker
        };

        btn.addEventListener('click', openPicker);
        // Öffnen nur per Button/Klick, nicht beim bloßen Fokus
        input.addEventListener('click', openPicker, { passive: true });
        // Falls altInput aktiv ist (Flatpickr), auch darauf reagieren
        setTimeout(() => {
          const alt = wrap.querySelector('.flatpickr-input[readonly]');
          if (alt) { alt.addEventListener('focus', openPicker, { passive: true }); alt.addEventListener('click', openPicker, { passive: true }); }
        }, 0);
      });

      // Event-Listener für Abhängigkeiten zwischen Datumsfeldern
      const moveInField = getField('move_in');
      const earliestMoveInField = getField('earliest_move_in');
      
      if (moveInField && earliestMoveInField) {
        const updateEarliestMoveInConstraints = () => {
          const moveInValue = moveInField.value;
          const earliestMoveInFP = earliestMoveInField._flatpickr;
          const earliestMoveInOverlay = earliestMoveInField.parentNode?.querySelector('.date-overlay');
          
          if (earliestMoveInFP) {
            if (moveInValue) {
              // Gewünschter Einzug ist gesetzt: Overlay entfernen und Max-Datum setzen
              const moveInDate = new Date(moveInValue);
              earliestMoveInFP.config.maxDate = moveInDate;
              earliestMoveInFP.config.disabled = false;
              // Overlay entfernen
              if (earliestMoveInOverlay) {
                earliestMoveInOverlay.remove();
              }
            } else {
              // Gewünschter Einzug ist leer: Overlay wieder hinzufügen
              earliestMoveInFP.config.disabled = true;
              if (!earliestMoveInOverlay) {
                const overlay = document.createElement('div');
                overlay.className = 'date-overlay';
                overlay.style.cssText = `
                  position: absolute;
                  top: 0;
                  left: 0;
                  right: 0;
                  bottom: 0;
                  background: rgba(0, 0, 0, 0.1);
                  cursor: not-allowed;
                  z-index: 10;
                  border-radius: 6px;
                `;
                earliestMoveInField.parentNode?.appendChild(overlay);
              }
            }
            earliestMoveInFP.redraw();
          }
        };

        // Initiale Konfiguration - mit Verzögerung, damit Flatpickr initialisiert ist
        setTimeout(updateEarliestMoveInConstraints, 200);
        
        // Bei Änderungen des gewünschten Einzugs
        moveInField.addEventListener('change', updateEarliestMoveInConstraints);
        moveInField.addEventListener('input', updateEarliestMoveInConstraints);
        
        // Auch bei Draft-Wiederherstellung prüfen
        const originalApplyDraft = applyDraft;
        applyDraft = function(data) {
          originalApplyDraft(data);
          // Kurze Verzögerung, damit die Felder gesetzt sind
          setTimeout(updateEarliestMoveInConstraints, 100);
        };
      }
    })();
    // Multi-Step initial anzeigen
    // Draft laden und anwenden
    (function restoreDraftIfAny(){
      const data = loadDraft();
      if (!data) { showStep(0); return; }
      isRestoringDraft = true;
      applyDraft(data);
      // zum ersten unvollständigen Step springen
      const startStep = findFirstIncompleteStep();
      showStep(startStep);
      isRestoringDraft = false;
      updateControlsVisibility();
      
      // Nach Draft-Wiederherstellung auch die Datums-Constraints aktualisieren
      setTimeout(() => {
        const moveInField = getField('move_in');
        const earliestMoveInField = getField('earliest_move_in');
        if (moveInField && earliestMoveInField) {
          const earliestMoveInFP = earliestMoveInField._flatpickr;
          const earliestMoveInOverlay = earliestMoveInField.parentNode?.querySelector('.date-overlay');
          
          if (earliestMoveInFP && moveInField.value) {
            // Gewünschter Einzug ist gesetzt: Overlay entfernen
            if (earliestMoveInOverlay) {
              earliestMoveInOverlay.remove();
            }
          }
        }
      }, 300);
    })();
  });
});