# Centurio — Landing page + páginas legales

Sitio estático, bilingüe (ES/EN), sin dependencias, sin rastreadores, sin cookies de
terceros. Mismo lenguaje gráfico que la app ("Breathe"). Listo para hostear en
GitHub Pages, Netlify, Vercel o Cloudflare Pages.

## Estructura

```
web/
├── index.html              ← Landing (tema oscuro "Obsidian": hero + teléfonos + animaciones)
├── landing.css             ← Estilos de la landing (oscuro, glow, marcos de teléfono = pantallas exactas de la app)
├── styles.css              ← Design system de las páginas LEGALES (claro, iconos Lucide)
├── app.js                  ← Toggle ES/EN, FAQ, año, scroll, animaciones reveal (IntersectionObserver)
└── legal/
    ├── privacy.html         ← Política de Privacidad (LOPDP Ecuador + RGPD + CCPA)
    ├── terms.html           ← Términos del Servicio / EULA (ley de Ecuador)
    ├── disclaimer.html      ← Aviso Financiero y de IA ("herramienta, no asesoría")
    ├── cookies.html         ← Política de Cookies (sin rastreadores)
    ├── eliminar-cuenta.html ← Eliminación de cuenta/datos (requisito de Google Play)
    └── aviso-legal.html     ← Aviso legal / imprint + condiciones del sitio + accesibilidad
```

El idioma por defecto es español; el visitante puede cambiar a inglés con el botón
ES/EN (se guarda su preferencia en `localStorage`). La versión en español prevalece
legalmente para consumidores de Ecuador y LatAm (declarado en cada documento).

## Cómo probar localmente

```bash
cd web
python3 -m http.server 8080
# abre http://localhost:8080
```

## Cómo publicar (elige una)

- **GitHub Pages:** sube `web/` a un repo, Settings → Pages → carpeta `/web` (o mueve
  el contenido a la raíz). URL tipo `https://<usuario>.github.io/<repo>/`.
- **Netlify / Vercel / Cloudflare Pages:** "Add new site" → conecta el repo →
  *publish directory* = `web`. Sin build command (es estático).
- **Dominio propio (recomendado):** apunta tu dominio (p. ej. `centurio.app`) al host.

---

## ⚠️ ANTES DE PUBLICAR — completa estos datos

Estos campos están marcados como `[ENTRE CORCHETES]` dentro de los HTML legales. La
**LOPDP (Art. 12.8)** exige el nombre legal, domicilio y teléfono del responsable.

| Marcador | Qué poner | Dónde aparece |
|---|---|---|
| `[NOMBRE LEGAL COMPLETO]` | Tu nombre legal completo (persona natural) | privacy, terms, aviso-legal |
| `[DIRECCIÓN / CIUDAD], Ecuador` | Tu domicilio (al menos ciudad) | privacy, terms, aviso-legal |
| `[TELÉFONO DE CONTACTO]` | Un teléfono de contacto | privacy |

Busca rápido con: `grep -rn "\[" web/legal/`.

Otros pendientes:
- **URL pública del Privacy Policy** en Play Console (App content → Privacy policy):
  usa `…/legal/privacy.html`.
- **URL de eliminación de datos** en el formulario *Data safety*: `…/legal/eliminar-cuenta.html`.
- Cuando publiques la app, el botón "Google Play" ya apunta a
  `https://play.google.com/store/apps/details?id=com.zerion.centurio`.
- (Opcional) reemplaza el badge "Google Play" por el [badge oficial de Google](https://play.google.com/intl/en_us/badges/) para cumplir sus guías de marca.

---

## ✅ Checklist de aceptación en Google Play (documentos)

- [x] Privacy Policy en HTML público, no editable, sin login, sin geobloqueo.
- [x] Enumera responsable + contacto, datos recogidos, encargados (Supabase, Google Gemini),
      transferencia a EE. UU., retención, seguridad, derechos y eliminación.
- [x] Página web de eliminación de cuenta/datos (accesible sin instalar la app).
- [x] Coherencia con el formulario *Data safety* (sin analítica, sin venta de datos).
- [x] Términos + Aviso de IA/financiero para máxima protección.

### Mapa para el formulario *Data safety* (Play Console)
- **Email** → Info personal (recogido, vinculado, "funcionalidad de la app").
- **Montos/comercios/categorías/presupuesto/moneda** → Info financiera → "otra" (recogido, vinculado).
- **raw_transcript** (texto dictado/escrito) → Actividad en la app / otro (recogido, vinculado).
- **Audio + Fotos** → recogido/procesado, **transitorio, no almacenado**.
- **Cifrado en tránsito** = Sí. **Eliminación a solicitud** = Sí + URL de eliminación.
- **¿Se comparten datos?** = No (Supabase/Gemini son *encargados*, no terceros que reciben datos).
- **Financial features** (App content) → selecciona **"No ofrece funciones financieras"**.
  No marques banca/préstamos/pagos/inversión.

---

## 🛠️ Pendiente EN LA APP (cambios de código, fuera de estas páginas)

La auditoría legal detectó requisitos que **no se resuelven con documentos** sino con
cambios en la app React Native. Son importantes para que Google **acepte** la app y para
que los descargos sean **exigibles**. (Puedo implementarlos si me lo pides.)

1. **Bloqueo de permisos de fotos (Google Play, obligatorio desde 2025-05-28):**
   `app.json` declara `READ_EXTERNAL_STORAGE` y `READ_MEDIA_IMAGES`. Para escaneo de
   recibos (uso puntual) se debe usar el **Android Photo Picker** del sistema (sin pedir
   permiso). Quitar ambos permisos y ajustar `expo-image-picker`.
2. **Divulgación destacada antes del permiso de micrófono y cámara:** mostrar una
   pantalla en la app ("usamos el micrófono para registrar tu gasto; el audio se procesa
   y no se almacena") con botones *Permitir / Ahora no* **antes** del diálogo del sistema.
   Las cadenas de `app.json` no bastan.
3. **Clickwrap en el registro:** casilla "Acepto los Términos, la Política de Privacidad y
   el Aviso de IA" (enlazados) — convierte los documentos en contrato exigible.
4. **Línea de IA en el modal de confirmación:** texto permanente "La IA puede equivocarse;
   verifica antes de guardar."
5. **Enlaces legales dentro de la app:** en Perfil, enlazar a Privacidad, Términos y Aviso.
6. **Limpieza de los .md antiguos** (`docs/privacy-policy.*`): contienen errores (mencionan
   "OpenAI", "Usage Data"/analítica que no existe, y un email placeholder). Estas páginas
   web los reemplazan.

---

## Notas de la metodología (landing)

La landing sigue la estructura de página de producto de Ryan Deiss y posiciona al
**usuario como el héroe**:

1. **Promesa + mecanismo único** (hero): el resultado deseado del usuario + "registro invisible".
2. **Empatía con el problema** (agitar): por qué abandonas el presupuesto.
3. **La solución en 3 pasos**: Habla/Escribe/Escanea → la IA → Respira.
4. **Rejilla Antes/Después** (Tienes / Sientes / Tu día / Estatus) — el "grid" de Deiss.
5. **Funciones → beneficios** (bento) con los colores de categoría de la app.
6. **Prueba de confianza/privacidad** (manejo de objeciones).
7. **FAQ** (objeciones: gratis, privacidad, idioma, errores de IA, no-asesoría, borrado).
8. **CTA final** + footer con todos los enlaces legales.
