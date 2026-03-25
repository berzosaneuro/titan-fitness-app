# Despliegue operativo (TITAN iOS + Coach Web)

## Binario iOS (TITAN iOS)

- Despliegue en **TestFlight / App Store** bajo el **nombre certificado de misión**, alineado con la **versión de UI inmutable** del mandato vigente.
- Cada **nueva versión de misión** exige checklist documentado:
  1. **Latencia real** de feedback háptico/visual: **&lt; 100 ms** (medición en dispositivo de referencia certificado).
  2. **Latencia** de corte de sesión / **Dead Man’s Switch**: **&lt; 300 ms** desde detección hasta acción de seguridad.
  3. **Validación** de que **no** se ha modificado la **jerarquía de vistas** ni la **posición de elementos críticos** respecto a la baseline certificada.
- Cualquier cambio estructural en **CNS‑R**, **ICO**, **motor de lesión**, **umbrales** o **DMS** requiere **aprobación explícita del Master del ecosistema** antes de **producción**.

## Panel web del coach

- Servicio **SaaS independiente**; consume **APIs de agregados** del backend asociado al ecosistema TITAN iOS.
- **No** expone lógica crítica de latencia ni de seguridad en tiempo real; ámbitos típicos: **planes**, **historial**, **leads**, **sesiones (metadatos)**, **visualización de CNS‑R / ICO / riesgo agregados**.
- Ciclo **CI/CD estándar**; no exige el mismo nivel de certificación que el binario iOS, salvo cambios en **permisos o RBAC** vinculados al Master.

## Contrato de datos (Coach Web)

- El despliegue del panel debe declarar la versión del contrato agregado (p. ej. `contracts/titan-mission-contract.json`).
- El backend solo publica campos y semántica compatibles con esa versión.

## Flujo recomendado

1. TITAN iOS: tests de **latencia** y **UI inmutable** en **staging**.
2. Master: validación de la **versión de misión** en TestFlight (o entorno de prueba enterprise).
3. Publicación del binario iOS a **producción**.
4. Backend: nuevas versiones de **datos agregados** (CNS‑R, ICO, riesgo, etc.) para el panel.
5. Panel web: despliegue con la **versión de contrato** correspondiente.
