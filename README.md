# Kontobuch — persönliche Steuer- &amp; Buchhaltungs-App (MVP, Phase 1)

Eine lokal laufende Web-App für Einzelunternehmer/Freelancer in Deutschland:
Rechnungen, Einnahmen, Ausgaben (mit Foto + OCR), EÜR, Umsatzsteuer-Voranmeldung,
Fristenmanagement. Läuft komplett im Browser, **ohne Server, ohne Cloud, ohne
Konto** — alle Daten bleiben in der IndexedDB deines Browsers.

## ⚠️ Wichtiger Hinweis (bitte zuerst lesen)

Diese App ist ein **persönliches Werkzeug**, kein zertifiziertes Steuer- oder
GoBD-Archivierungsprodukt und **keine Steuerberatung**:

- Die EÜR- und USt-VA-Berechnungen bilden die **allgemeine Rechenlogik**
  (Einnahmen ./. Ausgaben, USt ./. Vorsteuer) ab, aber **nicht** die exakten,
  jährlich wechselnden amtlichen Formularfelder/Kennziffern von Elster.
  Übertrage die Werte manuell und prüfe sie, bevor du etwas einreichst.
- Fristen (§18 UStG, Steuererklärung) werden nach **allgemeinen Regelfristen**
  berechnet. Individuelle Verlängerungen (Dauerfristverlängerung,
  Steuerberater-Fristen) sind nicht berücksichtigt.
- Die OCR-Erkennung ist eine **Heuristik** (Regex auf erkanntem Text). Betrag,
  Datum und Händler immer manuell gegenprüfen.
- "GoBD-konform" ist hier ein **Best-Effort-Ansatz** (unveränderbare
  Historie, Hash pro Datensatz, kein Hart-Löschen von Rechnungen/Belegen),
  keine zertifizierte Verfahrensdokumentation im Sinne der GoBD.
- Für verbindliche Fragen (Kleinunternehmerregelung, Vorsteuerabzug,
  Fristen, Formularfelder) wende dich an dein Finanzamt, ELSTER-Hilfe oder
  eine steuerberatende Person.

## Voraussetzungen

- Ein aktueller Browser (Chrome, Edge, Firefox, Safari).
- Für die **erste** Nutzung von PDF-Export und Foto-OCR: eine Internetverbindung
  (lädt jsPDF bzw. das Tesseract.js-OCR-Modell von einem CDN). Danach
  funktioniert die App weitgehend offline (abhängig vom Browser-Cache).

## Installation / Start

Kein Build-Schritt nötig — reines HTML/CSS/JS.

1. Entpacke den Ordner `steuer-app/`.
2. Öffne `index.html` per Doppelklick im Browser
   **oder** starte lokal einen einfachen Webserver (empfohlen, vermeidet
   Browser-Eigenheiten mit `file://`):
   ```bash
   cd steuer-app
   python3 -m http.server 8000
   # dann im Browser: http://localhost:8000
   ```
3. Beim ersten Start: PIN vergeben (mind. 4 Stellen) → sperrt den
   Bildschirmzugriff in diesem Browser-Profil.
4. Unter **Einstellungen** Firmendaten (Name, Adresse, Steuernummer/USt-IdNr.,
   Kleinunternehmer-Status, Ist-/Soll-Versteuerung) hinterlegen — diese
   werden für Rechnungen und die USt-VA-Berechnung gebraucht.

## Funktionsüberblick (Phase 1 / MVP)

| Modul | Enthält |
|---|---|
| **Rechnungen** | Kundenauswahl, Positionen mit Menge/Preis/USt-Satz, automatische Rechnungsnummer (JAHR-0001), Netto/USt/Brutto, Status offen/bezahlt/überfällig/storniert, PDF-Export |
| **Kunden** | Name, Adresse, E-Mail, USt-IdNr. |
| **Einnahmen** | automatisch bei Zahlungseingang einer Rechnung, oder manuell mit Kategorie |
| **Ausgaben** | manuell oder per Foto/Upload + OCR-Vorbefüllung (Betrag, Datum, Händler), Kategorien, automatische Vorsteuerberechnung |
| **EÜR** | Jahresauswertung nach Kategorie, Gewinn/Verlust, CSV- &amp; PDF-Export |
| **USt-VA** | monatlich/vierteljährlich, Ist- oder Soll-Versteuerung wählbar, Zahllast/Erstattung, CSV-Export, Checkliste für Elster |
| **Fristen** | USt-VA- und Steuererklärungs-Countdown |
| **Einstellungen** | Firmendaten, Steuerprofil, PIN, JSON-Backup/-Import |

### Nicht enthalten (bewusst, siehe Anforderungsdokument)

Lohnabrechnung, Bilanzierung, komplexe Firmenstrukturen, Mehrbenutzerbetrieb,
direkte ELSTER/ERiC-Übertragung (siehe Roadmap).

## Datenhaltung &amp; Sicherheit

- Speicherung ausschließlich lokal in **IndexedDB** dieses Browsers/Geräts.
  Keine Server-Synchronisierung.
- Die App-PIN sperrt nur die Bildschirmansicht in diesem Browser-Profil —
  sie **verschlüsselt die Datenbank auf der Festplatte nicht**. Aktiviere
  zusätzlich die Festplatten-/Geräteverschlüsselung deines Rechners
  (BitLocker/FileVault) für echten Schutz ruhender Daten.
- Nutze regelmäßig **Einstellungen → Backup exportieren**, um ein
  JSON-Backup zu sichern (z. B. verschlüsselt in einem eigenen,
  DSGVO-konformen Cloud-Speicher deiner Wahl). Lokales Löschen des
  Browser-Speichers (z. B. "Browserdaten löschen") entfernt alle Daten
  unwiederbringlich, wenn kein Backup existiert.
- Belege werden als Base64-Bild direkt im Datensatz gespeichert (einfach,
  aber macht die Datenbank groß — für sehr viele/hochauflösende Belege ggf.
  Bildgröße vor dem Upload reduzieren).

## Architektur

Vanilla JS, keine Build-Pipeline, IndexedDB als Datenbank, jsPDF für PDF-Export,
Tesseract.js für OCR — beide per CDN eingebunden (siehe `index.html`).

```
steuer-app/
├── index.html
├── css/style.css
└── js/
    ├── db.js            Datenzugriff (IndexedDB), Hash/Versionierung
    ├── util.js           Formatierung, Modal-System, Toasts
    ├── security.js        PIN-Sperre
    ├── settings.js        Firmendaten & Steuerprofil
    ├── customers.js        Kundenverwaltung
    ├── invoices.js         Rechnungen, PDF-Export
    ├── income.js           Einnahmen
    ├── expenses.js         Ausgaben, Foto-Upload
    ├── ocr.js              Tesseract.js-Anbindung
    ├── euer.js             EÜR-Berechnung & Export
    ├── ustva.js            USt-VA-Berechnung & Export
    ├── reminders.js        Fristen-Engine
    ├── exportfiles.js      CSV/PDF-Hilfsfunktionen
    └── app.js              Router, Dashboard, Bootstrap
```

## Roadmap (aus deiner Planung übernommen)

- **Phase 2:** Bankkonto-Anbindung, automatische Zahlungszuordnung,
  Multi-Device-Sync, KI-Steuerschätzung, Kilometerpauschale.
- **Phase 3:** Direkte ELSTER-Übertragung via ERiC (Zertifikatsverwaltung,
  Fehlercodes, Übertragungsprotokolle). Das erfordert einen Server- oder
  Desktop-Baustein, da ERiC nicht im Browser läuft — separates Modul, das
  optional an dieses Frontend andockt.

## Bekannte Grenzen dieser ersten Version

- Keine Kilometerpauschale, keine AfA-Tabellen-Automatik (Kategorie
  "Abschreibung (AfA)" existiert, Berechnung ist aktuell manuell).
- OCR läuft rein clientseitig und ist bei schlechten Fotos ungenau.
- Kein automatischer Abgleich mit Bankkonten (Phase 2).
- EÜR-/USt-VA-Ansichten sind Vorbereitung, keine Formular-Reproduktion.
