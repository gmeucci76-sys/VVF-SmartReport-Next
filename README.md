# VVF SmartReport Next

PWA offline-first: i dati rimangono esclusivamente sul dispositivo.

I cataloghi STAT-RI della versione precedente sono inclusi localmente in `js/catalogs.json`: l'app non li scarica dalla rete.

Per provarla in sviluppo, aprire questa cartella con un server locale (non aprire `index.html` direttamente dal Finder): il service worker funziona su `localhost` o HTTPS. Dopo il primo caricamento, l'app è disponibile anche senza connessione.

## Pubblicazione gratuita

Il file `.github/workflows/deploy-pages.yml` pubblica automaticamente l'app su GitHub Pages quando il progetto viene caricato nel ramo `main`. GitHub Pages distribuisce soltanto i file dell'app: interventi, foto, audio e video restano nel browser del singolo dispositivo.
