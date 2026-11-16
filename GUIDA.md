# Włoski z Dominiką – come modificare il sito da sola

Il sito ha due parti riservate a te: il **pannello `/admin`** per i contenuti e la **Gestione** per prenotazioni e studenti (vedi punto 6).

Il **pannello di amministrazione** è all'indirizzo `/admin`
(per esempio `https://wloskizdominika.netlify.app/admin`).
Dal pannello modifichi escursioni, case vacanze, foto, video, lezioni, contatti e tutti i testi nelle 5 lingue.
Quando premi **Pubblica**, il sito si aggiorna da solo in circa 1 minuto.

Per farlo funzionare servono 2 account gratuiti: **GitHub** (dove sono salvati i file) e **Netlify** (che mette il sito online).
La preparazione si fa **una volta sola** e dura circa 20 minuti.

---

## 1. Metti i file su GitHub
1. Crea un account su https://github.com
2. In alto a destra: **+ → New repository**. Nome: `wloski-z-dominika`. Lascia **Public** e premi **Create repository**.
3. Nella pagina che si apre, clicca **uploading an existing file**.
4. Trascina **tutto il contenuto** della cartella del sito (index.html, logo.jpg, sun.jpg e le cartelle admin, content, media) e premi **Commit changes**.

## 2. Collega GitHub a Netlify
1. Crea un account su https://app.netlify.com (puoi entrare direttamente con GitHub).
2. **Add new site → Import an existing project → GitHub** → scegli `wloski-z-dominika`.
3. Non cambiare nulla e premi **Deploy**.
4. In **Site configuration → Change site name** scrivi `wloskizdominika` (oppure un altro nome libero).

## 3. Attiva il login del pannello
1. Su GitHub: foto profilo → **Settings → Developer settings → OAuth Apps → New OAuth App**
   - Application name: `Pannello Dominika`
   - Homepage URL: `https://wloskizdominika.com`
   - Authorization callback URL: `https://api.netlify.com/auth/done`
   - Premi **Register application**, poi **Generate a new client secret**. Copia **Client ID** e **Client secret**.
2. Su Netlify: **Site configuration → Access & security → OAuth → Install provider → GitHub**, poi incolla Client ID e Client secret.

## 4. Un'ultima modifica
Non serve: il tuo nome utente GitHub (**wloskidominika**) e il nome del repository (**wloski-z-dominika**) sono già scritti in `admin/config.yml`.
Se un giorno cambi nome utente o repository, aggiorna la riga `repo:` di quel file.

Poi premi **Commit changes**.

## 5. Fatto!
Vai su `https://wloskizdominika.netlify.app/admin` (poi, col dominio collegato, `https://wloskizdominika.com/admin`) → **Accedi con GitHub**.

---

## Lancio del sito (quando è tutto pronto)
Finché prepari i contenuti, il sito è online solo all'indirizzo provvisorio `….netlify.app`. Lo conosci solo tu, e il file `robots.txt` dice a Google di non leggerlo. Quando hai inserito tutto:
1. **Collega il dominio wloskizdominika.com**: su Netlify vai su **Domain management → Add a domain**, scrivi `wloskizdominika.com` e conferma. Netlify ti mostra i record DNS da inserire.
2. Nel pannello di **Aruba** (Gestione DNS del dominio) inserisci i record che ti ha dato Netlify. Di solito sono un record **A** per `wloskizdominika.com` e un record **CNAME** per `www`. Se hai dubbi, mandami uno screenshot. In poche ore il sito si apre col tuo indirizzo, e Netlify attiva da solo il lucchetto https.
3. Su GitHub apri **robots.txt**, clicca la matita ✏️ e sostituisci tutto il testo con:
   ```
   User-agent: *
   Allow: /
   Sitemap: https://wloskizdominika.com/sitemap.xml
   ```
   Poi premi **Commit changes**. Da quel momento Google può leggere il sito.
4. (Consigliato) Registra il sito su **Google Search Console** (search.google.com/search-console) e invia `https://wloskizdominika.com/sitemap.xml`.
5. Condividi l'indirizzo con i clienti e sui social. 🎉

## 6. Attiva l'area riservata (clienti e studenti)
L'area riservata (`/area.html`) e la tua pagina di gestione (`/gestione.html`) usano un database gratuito, **Supabase**.

1. Crea un account su https://supabase.com → **New project**. Nome: `wloski-z-dominika`, regione: **Europe (Frankfurt)**. Scegli una password del database e salvala.
2. Quando il progetto è pronto: menu a sinistra **SQL Editor → New query**. Apri il file `supabase/setup.sql`, copia tutto, incollalo e premi **Run**. Deve comparire "Success".
3. Menu **Authentication → URL Configuration**:
   - Site URL: `https://wloskizdominika.com/area.html`
   - Redirect URLs: aggiungi `https://wloskizdominika.com/area.html` e anche `https://wloskizdominika.netlify.app/area.html` (l'indirizzo provvisorio, per le prove)
4. Menu **Project Settings → API**: copia **Project URL** e la chiave **anon public**.
5. Su GitHub apri `config.js`, clicca la matita ✏️, incolla i due valori al posto di `INSERISCI-QUI…` e premi **Commit changes**.
6. Vai su `https://wloskizdominika.netlify.app/area.html` → **Registrati** con la tua e-mail e conferma l'e-mail che ricevi.
7. Torna su Supabase → **SQL Editor** e esegui questa riga, con la tua e-mail:
   `update public.profiles set role = 'admin' where email = 'LA-TUA-EMAIL';`
8. Ricarica l'area riservata: in alto compare **⚙️ Gestione**. Fatto!

### Come funziona l'area riservata
- **Clienti e studenti** si registrano da soli (pulsante "Area riservata" nel menu del sito), in una delle 5 lingue.
- Possono **chiedere una prenotazione** (escursione, lezione di italiano o polacco, casa vacanze, altro). Dopo l'invio possono avvisarti con un clic su WhatsApp.
- Vedono lo stato delle loro prenotazioni e i tuoi messaggi, e possono annullare quelle ancora in attesa.
- **Non possono modificare niente del sito**, né vedere i dati di altre persone. Non possono neanche confermarsi da soli una prenotazione.
- Vedono i **materiali** solo dei corsi a cui li hai iscritti.

### La tua pagina Gestione (`/gestione.html`)
- **📅 Prenotazioni**: confermi o annulli, segni "Pagata" e scrivi un messaggio che il cliente vede nella sua area. Puoi contattarlo con un clic via e-mail o WhatsApp.
- **👥 Clienti e studenti**: spunti **Italiano** o **Polacco** per iscrivere una persona a un corso.
- **📚 Materiali corsi**: carichi file (PDF, Word, audio…), video di YouTube, link o testi. Puoi nasconderli o eliminarli.

Nota: il sito non ti manda una e-mail quando arriva una nuova prenotazione. Le nuove richieste le vedi in Gestione (col numero rosso), e i clienti possono avvisarti su WhatsApp.

---

## 8. Pagamenti online (Stripe o PayPal)
I clienti pagano su una pagina sicura di Stripe (o PayPal). Il sito non tocca mai i dati delle carte.
1. Crea un account su **stripe.com** come attività italiana, con la P.IVA e l'IBAN dove vuoi ricevere i soldi.
2. In Stripe: **Payment Links → Nuovo**. Scegli il servizio e il prezzo. Puoi chiedere al cliente data, numero di persone o nome dell'hotel con i **campi personalizzati**. Copia il link `https://buy.stripe.com/…`.
3. **Servizi a prezzo fisso** (transfer, corsi…): nel pannello `/admin` incolla il link nel campo **💳 Link di pagamento**. Sul sito compare il pulsante **"Prenota e paga"**.
4. **Alloggi ed escursioni con date**: è meglio non far pagare subito, per non incassare per una data già occupata. Il cliente manda la richiesta dall'Area riservata. Tu controlli la disponibilità, poi in **Gestione** confermi e incolli il link di pagamento. Il cliente vede **"💳 Paga ora"** nella sua area.
5. Quando arriva il pagamento, Stripe ti manda un'e-mail. In Gestione spunta **Pagata**.

⚠️ Per vendere online servono anche le **Condizioni di vendita**: prezzi, cancellazioni e rimborsi. E chiedi al commercialista come emettere ricevute o fatture per i pagamenti online.

## 7. Privacy e Cookie
La pagina **Privacy e Cookie** (`/privacy.html`) è in italiano, inglese e polacco. Il link è in fondo a ogni pagina, e la casella di consenso compare quando qualcuno si registra.
1. Nel pannello `/admin` → **☎️ Contatti e social** inserisci **nome e cognome della titolare** e **indirizzo della sede**: finché mancano, nella pagina sono evidenziati in giallo.
2. Su Supabase scegli la regione **Europe**: la privacy dice che i dati restano nell'Unione Europea.
3. Il sito non ha cookie di statistica o pubblicità, quindi **non serve il banner dei cookie**. Se un giorno aggiungi Google Analytics, il Pixel di Facebook o simili, il banner diventa obbligatorio.
4. Se qualcuno chiede di cancellare il proprio account: Supabase → **Authentication → Users** → cerca l'e-mail → **Delete user**. Le sue prenotazioni si cancellano insieme all'account. Prima conserva i dati che ti servono per le fatture.

⚠️ Il testo è un modello preparato sui servizi che il sito usa davvero. Fallo controllare dal tuo commercialista o da un consulente privacy prima di pubblicarlo.

---

### Come si usa il pannello
- **🎨 Aspetto del sito:** colori (principale, secondario, sfondo, accento, testo), foto grande della Home, foto di Dominika, icona e logo, quali sezioni mostrare nella Home, quali voci mostrare nel menu e quanti elementi mettere in Home.
- **Le pagine del sito:** Home, **Blog** (`blog.html`), **Escursioni** (`escursioni.html`), **Case vacanze** (`case-vacanze.html`), **Transfer** (`transfer.html`), **Noleggio** (`noleggio.html`) e **Servizi** (`servizi.html`). Si aggiornano da sole con quello che inserisci nel pannello. Nella Home compaiono le prime 6 escursioni, le prime 6 case e i primi 3 servizi, con il pulsante "Vedi tutte".
- **Servizi:** per ogni servizio scegli se è un **Transfer**, un **Noleggio** o un **Altro servizio**. Così compare nella pagina giusta.
- **Bozze (lavorare dietro le quinte):** quando premi **Salva**, la modifica resta una **bozza** e non va online. Nella scheda **Workflow** in alto vedi le colonne *Bozze → In revisione → Pronto*. Quando è tutto a posto, apri la bozza e premi **Pubblica**: in circa 1 minuto è online.
  💡 Il piano gratuito di Netlify consente circa 15 pubblicazioni al mese. Prepara più bozze e pubblicale insieme.
- **🏡 Alloggi:** case, appartamenti, ville, hotel, B&B, agriturismi, residence. Scegli il **Tipo**: sul sito compaiono i filtri (Tutti / Appartamento / Hotel…). Se metti il link, il pulsante porta al sito esterno (anche holidayscalabria.com). Se lo lasci vuoto, il pulsante porta al modulo contatti.
- **🎬 Video:** i video caricati nel sito consumano i crediti mensili di Netlify ogni volta che qualcuno li guarda. Quelli nuovi conviene caricarli su **YouTube** e incollare il link nella Galleria: si vedono uguale e non costano niente.
- **🧭 Servizi:** transfer, corsi di cucina, noleggi… qualsiasi cosa offri. Se non ci sono servizi, la sezione si nasconde da sola.
- **🚐 Escursioni**: aggiungi, modifica, riordina (trascinando) o elimina le escursioni. Il titolo in italiano è obbligatorio. Se una traduzione è vuota, il sito mostra l'italiano.
- **🏡 Case vacanze**: per ogni casa ti bastano nome, località e il **link** al sito esterno (Booking, Airbnb…).
- **📸 Galleria**: scegli **Foto** o **Video**. Per i video incolla il link di YouTube, oppure carica un file .mp4 (meglio YouTube: i file pesanti rallentano il sito).
- **📚 Lezioni**: i punti elenco dei corsi di italiano e di polacco.
- **☎️ Contatti e social**: e-mail, telefono, WhatsApp, Facebook, Instagram…
- **✍️ Testi delle pagine**: tutti i titoli e le frasi del sito, lingua per lingua.

**Foto:** prima di caricarle, rimpiccioliscile a circa 1600 px di larghezza (va bene anche https://squoosh.app). Così il sito resta veloce.

**Dominio personale** (es. `wloskizdominika.it`): lo compri da un registrar e lo colleghi su Netlify in **Domain management → Add a domain**. Poi aggiorna l'indirizzo in `admin/config.yml` e nella OAuth App di GitHub.

---

## 📝 Il blog e il Correttore SEO
Nel pannello `/admin` apri **📝 Blog → Nuovo articolo**. A sinistra scrivi, a destra il **🔍 Correttore SEO** ti dà un punteggio da 0 a 100, ti mostra come apparirà l'articolo su Google e ti dice cosa sistemare (❌ prima, poi ⚠️).

**Come scrivere un articolo che sale su Google**
1. **Scegli la frase chiave**: le 2–4 parole che un turista scrive su Google, **nella sua lingua** (es. «Tropea co zobaczyć», «Tropea Sehenswürdigkeiten»). Un articolo = una frase chiave = una lingua.
2. **Titolo** di 30–60 caratteri, con la frase chiave all'inizio.
3. **Descrizione per Google** di 120–155 caratteri: deve far venire voglia di cliccare.
4. **Testo** di almeno 300 parole (meglio 600+), con 2–5 **sottotitoli** (pulsante «H»).
5. **Link** ad almeno 2 pagine del sito (escursioni, case vacanze, transfer…).
6. **Foto di copertina** con una breve descrizione.
7. Premi **Pubblica**: in circa 1 minuto l'articolo diventa una pagina del sito, compare nella Home e nella mappa per Google.

Gli articoli in polacco, tedesco o inglese hanno la loro pagina: scrivi ogni lingua come articolo separato (puoi partire dalla traduzione di uno italiano).

## 🚀 Piano per salire su Google (da fare con calma)
1. **Google Search Console** (search.google.com/search-console): aggiungi il sito e invia `https://wloskizdominika.com/sitemap.xml`. Ti dice per quali parole compari e quante persone cliccano.
2. **Profilo dell'attività su Google** (business.google.com): è la scheda che compare su Google Maps. Inserisci foto, orari, sito e chiedi ai clienti soddisfatti di lasciare una **recensione**. Per un'attività turistica locale è spesso la cosa più efficace.
3. **Un articolo a settimana** (o almeno due al mese), con il punteggio del Correttore sopra 80.
4. **Scrivi per il tuo pubblico straniero**: i turisti polacchi e tedeschi cercano nella loro lingua. Traduci per primi gli articoli più utili, come «Cosa vedere a Tropea» e «Isole Eolie da Tropea».
5. **Link verso il tuo sito**: chiedi al sito partner holidayscalabria.com di mettere un link a wloskizdominika.com. Mettilo anche su Facebook, Instagram, nei gruppi di viaggiatori e nei profili su TripAdvisor o simili.
6. **Aggiorna** ogni tanto gli articoli vecchi (prezzi, orari, foto nuove): Google premia i contenuti aggiornati.
7. **Pazienza**: i primi risultati arrivano di solito dopo alcune settimane o qualche mese, e crescono con la costanza.

---

## Il sito è tuo al 100%
- **Il dominio** wloskizdominika.com è registrato a tuo nome su Aruba.
- **I file del sito** sono nel tuo account GitHub. Puoi scaricarli quando vuoi (pulsante verde **Code → Download ZIP**) e portarli su qualsiasi altro hosting.
- **La pubblicazione** avviene sul tuo account Netlify.
- **I dati dei clienti** (area riservata e prenotazioni) sono nel tuo progetto Supabase.
- Non ci sono abbonamenti con me o con altri, e nessuno può bloccarti.

**Cosa cambi dal pannello:** tutti i contenuti, le foto, i testi in 5 lingue, i colori, le sezioni e il menu.
**Cosa richiede di toccare il codice:** cambiare la disposizione grafica, aggiungere un tipo di pagina nuovo o funzioni nuove. Il codice è tuo: puoi chiedere a Claude o a qualsiasi programmatore di modificarlo, partendo dai file su GitHub.

## Le pagine del sito (menu)

| Voce del menu | Pagina | Cosa mostra |
|---|---|---|
| Case vacanze | case-vacanze.html | gli alloggi di tipo Appartamento, Casa, Villa… |
| Hotel e B&B | hotel-bb.html | gli alloggi di tipo **Hotel** o **B&B** |
| Escursioni | escursioni.html | le escursioni con «In quale pagina» = *Escursioni* |
| Guida turistica ed esperienze locali | esperienze.html | le escursioni con «In quale pagina» = *Guida turistica ed esperienze* |
| Transfer | transfer.html | i servizi con pagina *Transfer* |
| Noleggio auto, scooter e bici | noleggio.html | i servizi con pagina *Noleggio auto, scooter e bici* |
| Noleggio nautico | noleggio-nautico.html | i servizi con pagina *Noleggio nautico* |
| Foto e video | foto-e-video.html | tutta la galleria |

Ogni casa, hotel, B&B, escursione ed esperienza ha **la sua pagina** (cartelle `casa/` e `escursione/`):
si crea da sola quando aggiungi l'elemento nel pannello e pubblichi.
La Home mostra in alto le **Lezioni di italiano e polacco** e i riquadri **Vacanze in Calabria**;
le foto dei riquadri si cambiano in 🎨 Aspetto del sito → «Foto dei riquadri».
