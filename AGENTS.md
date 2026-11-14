<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Design deliverables
- Deliver the Figma generator as a standalone local plugin, separate from the web app; native Figma nodes keep the design editable without requiring a live connector.

## Web app
- Patient screens wrap content in `src/components/vita/AppShell` (sidebar ≥lg, bottom bar on mobile) so navigation stays consistent across pages.
- Health-range rules live as pure functions in `src/lib/vitals.ts` with tests beside them; UI only displays their result.
- Share-code and access rules (incl. which documents a code exposes) live as pure functions in `src/lib/share.ts` with tests.
- Documents and share codes live in Lovable Cloud with owner-only RLS; files go in the private `medical-documents` bucket under `<userId>/`. The doctor view reads them only through the `openShare` server function after code validation, so doctors need no account.
- Document reading runs in `extractDocument` (server) via the AI gateway with a strict JSON schema; the patient always confirms before saving.
- Only wearable data may be demo data (`src/lib/vita-data.ts`); medical records never ship sample rows.
- Health profiles use owner-only `patient_profiles` RLS and authenticated server functions with shared validation; birth date determines age, and questionnaire completion is optional. This keeps sensitive self-reported data private without blocking document uploads.
- Existing share codes do not expose health profiles; profile sharing requires a separate explicit consent option so adding personal data never broadens existing access.
- The authenticated home loader sends accounts without a health profile to the optional questionnaire; deferral persists only the existing profile or empty answers and returns home. This covers password, email-confirmation and OAuth entry without forcing medical disclosure.
- Doctor accounts: `doctor_profiles` marks a professional; doctors see only `doctor_patients` (name + ref ID) and never store patient records. Doctor-initiated 6-digit requests (`access_requests`) are read/answered only through `clinic.functions.ts` (rate-limited lookups); authorizing creates a normal patient-owned share code, so all viewing still goes through `openShare`. Rules live in `src/lib/clinic.ts` with tests.
