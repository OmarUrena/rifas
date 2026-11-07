# Opciones de hosting para App Sorteos

Consulta: 2026-11-07. Recomendación técnica para decidir; no hay proveedor
seleccionado ni despliegue autorizado. Precios en USD, sin impuestos/dominio.

## Candidato recomendado

Next.js y NestJS como dos servicios Node en Render, manteniendo PostgreSQL,
Auth y Storage en Supabase; Cloudflare Turnstile como candidato para CAPTCHA.
Dos aplicaciones en un solo proveedor simplifican operación y diagnóstico.
Los dominios deben pertenecer al mismo sitio (por ejemplo, web y subdominio API
del dominio del propietario), con HTTPS y configuración exacta de cookies/CORS.

Render documenta un precio Starter de $7 por servicio/mes; dos servicios serían
$14 de cómputo base. Supabase Pro parte de $25/mes, por lo que la suma orientativa
sería $39/mes antes de otros cargos. No es un presupuesto de capacidad: las
instancias Starter de 512 MB deben medirse con el build y la carga reales, y
puede ser necesario ampliar memoria. Ver [comparación oficial de precios Render](https://render.com/articles/render-vs-railway)
y [precios Supabase](https://supabase.com/pricing).

Turnstile tiene plan gratuito y puede usarse sin otros servicios Cloudflare.
No sustituye protección de borde ni validación servidor: [planes oficiales](https://developers.cloudflare.com/turnstile/plans/).
El hosting y la configuración de borde deberán proteger el origen, además del
dominio público; las garantías concretas se comprueban en staging.

## Alternativas y límites

Vercel para Next.js y Render para NestJS puede resultar cómodo si se prioriza
el flujo de despliegue de Next. Introduce dos proveedores de ejecución y su
configuración de dominio/proxy. Vercel Hobby es para uso personal no comercial;
evaluar Pro para este negocio: [condiciones del plan](https://vercel.com/docs/plans/hobby).

Railway simplifica múltiples servicios, pero sus condiciones requieren revisar
expresamente la aceptación de este caso de rifas antes de recomendarlo para
operación. El acuerdo empresarial menciona gaming/gambling entre restricciones:
[condiciones oficiales](https://railway.com/legal/enterprise-agreement). No se
infiere que un plan distinto apruebe el caso. Render, Supabase y los demás
proveedores también deben confirmar las condiciones aplicables al proyecto.

Los planes gratuitos son útiles para desarrollo, con límites que afectan una
operación: [Render Free](https://render.com/docs/free) duerme servicios inactivos
y [Supabase Free](https://supabase.com/pricing) pausa proyectos tras una semana
sin actividad. No basar una venta real en un entorno de ensayo que puede dormir.

## Antes de contratar

Elegir presupuesto mensual y dominio, confirmar aceptación del caso con los
proveedores y medir recursos en staging. Preparar secretos de servidor, buckets
separados, backup de datos/objetos, alertas de consumo, CAPTCHA y origen protegido.
La autorización del despliegue será específica y posterior a la configuración
revisable. No se compran planes ni se activan ventas por esta recomendación.
