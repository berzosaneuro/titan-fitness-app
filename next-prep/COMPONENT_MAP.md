# Mapa componente → archivo fuente (antes de Next)

## Por pantalla / ruta

### `/inicio` — Dashboard

- Header con notificaciones
- Card alerta + agenda + nuevo ingreso + resumen semanal  
**Lógica:** `src/features/dashboard.js`

### `/atletas`

- SearchBar + lista `ClientListItem`  
**Lógica:** `src/features/athletes.js` (`filterAthletes`, `viewAthlete`)

### `/atletas/detalle` (futuro `[athleteId]`)

- Header avatar, LivePanel, gráfico, vault CTA, reportes, notas  
**Lógica:** `src/features/athlete-detail.js`, navegación en `athletes.js`

### `/creador`

- TabBar dieta/entreno, VariantTabs, cards de comidas/ejercicios, sticky actions  
**Lógica:** `src/features/creator.js`, `src/features/creator-actions.js`

### `/oficina`

- FinanceCard, ingresos, incidencias, proyección  
**Lógica:** `src/features/office.js`, `src/features/office-actions.js`

### Vault (overlay)

- Contenido en `#vault` dentro de `index.html`  
**Lógica UI modal:** `src/features/vault.js`  
**Lógica acciones:** `src/features/vault-actions.js`

## Transversales

| Concern | Vanilla | Next típico |
|---------|---------|-------------|
| Navegación | `src/features/navigation.js` + `src/lib/router.js` | `<Link>`, `useRouter`, `redirect()` |
| Rutas canónicas | `src/config/routes.js` | mismos paths en carpetas `app/` |
| Modal genérico | `src/core/modal.js` | componente cliente + estado |
| Métricas modales | `src/core/metrics.js` | props / formulario controlado |
