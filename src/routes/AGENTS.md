# Routes

## Mapa de rotas e redirecionamentos
Each redirect rule lives in exactly one place; do not add redirects in components (`useEffect`/`<Navigate>`).

| Rota | Quem vê | Redirecionamento e onde vive |
|---|---|---|
| `/` | todos | Com sessão: esqueleto + `useSignedInRedirect` → `resolveHome` → `destinationFor` (1 redirecionamento) |
| `/entrar` | todos | Mesmo `useSignedInRedirect` depois do login |
| `/medico` | todos (código do paciente) | Nenhum; Voltar leva profissional conectado a `/clinico` |
| `/_authenticated/*` (todas as telas do paciente) | com sessão | Sem sessão → `/entrar`: `src/routes/_authenticated/route.tsx` (sessão local) |
| `/inicio`, `/plano`, `/assinatura`, `/familia`, `/familia/$memberId` | paciente | Profissional → `/clinico`: `requireRole("paciente")` (`src/lib/require-role.ts`) no `beforeLoad`; `/inicio` também manda plano sem carteirinha → `/plano` via `destinationFor` |
| `/dispositivos*` | paciente com sessão | Só o guarda de sessão |
| `/documentos*`, `/compartilhar`, `/autorizar`, `/acessos`, `/consultas*`, `/perfil` | paciente com sessão | Só o guarda de sessão; nenhuma regra de perfil |
| `/clinico/*` | médico ou laboratório | Sem sessão → `/entrar`, paciente → `/inicio`: `requireRole("profissional")` no `beforeLoad` de `src/routes/clinico.tsx` |

