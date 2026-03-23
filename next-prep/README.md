# Preparación migración Next.js (App Router)

Este directorio **no** es una app Next ejecutable: documenta el destino de la estructura actual.

## Árbol objetivo (App Router)

```
app/
  layout.tsx              # fuentes, Theme, providers, shell común
  page.tsx                # redirect → /inicio
  inicio/page.tsx         # Dashboard
  atletas/
    page.tsx              # lista
    [athleteId]/page.tsx  # detalle (sustituye /atletas/detalle + ?)
  creador/page.tsx
  oficina/page.tsx
```

## Equivalencia con rutas actuales (vanilla)

| URL SPA (`src/config/routes.js`) | Segmento Next sugerido |
|----------------------------------|-------------------------|
| `/inicio` | `app/inicio/page.tsx` |
| `/atletas` | `app/atletas/page.tsx` |
| `/atletas/detalle` | `app/atletas/[athleteId]/page.tsx` |
| `/creador` | `app/creador/page.tsx` |
| `/oficina` | `app/oficina/page.tsx` |

## Probar la SPA vanilla (rutas `/inicio`, etc.)

Los ES modules y `history.pushState` requieren servir la carpeta del proyecto por HTTP (no abras `index.html` como `file://` si fallan los imports).

```bash
npx --yes serve .
```

Luego entra a `http://localhost:3000/inicio` (o el puerto que indique `serve`).

## Historial y despliegue

La app vanilla usa `history.pushState` y rutas limpias. Para que **recargar** en `/creador` funcione hace falta **fallback a `index.html`** en el servidor (Vercel, nginx, `serve -s`, etc.). Next.js lo resuelve solo.

## Módulos JS → capas en Next

- `src/core/modal.js` → componente cliente + hook o server actions según caso.
- `src/core/toast.js` → `sonner` / `react-hot-toast` / UI propia.
- `src/features/*.js` → colocation en `app/.../actions.ts` (server) o hooks en cliente.
- `styles.css` → `app/globals.css` (o Tailwind + tokens CSS).

## Vault

Hoy es overlay (`#vault`). Opciones en Next:

- Ruta anidada `app/atletas/[id]/vault/page.tsx`
- Parallel route `@vault`
- Modal cliente con URL query `?vault=1`

Ver también `COMPONENT_MAP.md` y `src/components/README.md`.
