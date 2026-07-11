# Synapse

Active second brain for lifelong learners who hoard tabs and never revise.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Demo paths

1. **Atlas** `/` — Neural Atlas brain map, vitality, due today, blind spots
2. **Today** `/today` — teach cards → mixed quiz (new + prior)
3. **Fake LinkedIn page** `/demo/fake-linkedin.html` — use with the extension

## Chrome extension

1. Chrome → `chrome://extensions` → Enable Developer mode
2. Load unpacked → select the `extension/` folder
3. Open `/demo/fake-linkedin.html`, click Synapse → **Alchemize this page**
4. **Simulate daily revisit ping** fires a notification → opens `/today`

Requires the Next.js app running on port 3000.

## API smoke tests

```bash
curl -s http://localhost:3000/api/atlas | head
curl -s http://localhost:3000/api/today | head
curl -s -X POST http://localhost:3000/api/ingest \
  -H 'content-type: application/json' \
  -d '{"title":"Test","sourceUrl":"http://x","rawText":"Long enough text about streaming lakehouse partitioning and watermarks for learning."}'
curl -s -X POST http://localhost:3000/api/reset
```

## 3D Neural Atlas

Home uses React Three Fiber + a FreeSurfer DK atlas mesh (`public/models/brain.glb`, generated via `freesurfer-to-glb` / Brainder.org meshes, CC BY-SA). Concepts overlay as glowing loci on lobe anchors.

```bash
# regenerate brain mesh if needed
npx freesurfer-to-glb --output public/models/brain.glb
```

## Integrations

| Service | Role | Status |
|---------|------|--------|
| **xAI Grok** | Refine ingest into learnable cards | Live via `XAI_API_KEY` |
| **EverOS** | Practice memory + blind-spot search | Live via `EVEROS_API_KEY` |
| **Butterbase** | Vault tables (sources, concepts, cards, quiz, events) | App `app_udoyhr049g50` |

Check: `curl -s http://localhost:3000/api/integrations | jq`

With `SYNAPSE_FORCE_FIXTURE=0`, ingest uses Grok and falls back to fixtures only on failure.

## Env

Copy `.env.example` → `.env.local` and fill keys. Never commit `.env.local`.
