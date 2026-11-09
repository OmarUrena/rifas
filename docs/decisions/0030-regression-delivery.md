# ADR 0030 — Regresión local y límites de entrega

La etapa 7 verifica los ajustes aprobados, sin convertir esa verificación en autorización de despliegue o de ventas. M6/M7 conservan sus requisitos externos. No se aplican cambios remotos ni se renueva la excepción temporal de MFA por ejecutar QA.

Se conserva una única rama main y el contrato generado 0.12.0. Las pruebas de inventario/pagos usan PostgreSQL desechable; la administración usa JWT/sesiones/MFA y protocolos Auth/Storage de prueba. Chromium, Firefox y WebKit se instalan en las versiones que pide Playwright, sin renombrar cobertura de otro navegador.

Las comprobaciones de carga/contención se ejecutan separadas de compilaciones y otros navegadores en el mismo equipo. No se amplían los timeouts transaccionales de producción para hacer pasar la suite. Las pruebas base serializan sus archivos; el subproceso de arranque usa ts-node en modo transpile-only, porque la comprobación completa de tipos se realiza expresamente en el control de calidad. Se conservan el plazo y las aserciones del diagnóstico EADDRINUSE.

Una regresión reproducible reveló que el watcher de desarrollo podía observar el vacío temporal entre truncar y escribir .env. Ahora espera una huella estable durante al menos un intervalo (mínimo 150 ms); el intervalo por defecto sigue siendo 750 ms. La prueba escribe deliberadamente ese estado intermedio y exige una sola notificación por cambio final. No se modifican reglas, sesiones ni límites de negocio.

Los conteos de recuperación/restauración se alinean al esquema actual de 26 tablas RLS y 16 migraciones locales; no se elimina ninguna aserción de preservación de datos. Se comprueba que la ACL restaurada no concede SELECT a PUBLIC/anon/authenticated sobre los límites de consulta, incluso en fixtures PostgreSQL sin roles propios de Supabase. Los casos de bendecidos cubren extremos, modo aleatorio, capacidad, congelación, reintento, cancelación y reasignación; los de lotería cubren conciliación pendiente y elegibilidad congelada.

Las capturas nuevas se guardan bajo .tmp y no sustituyen automáticamente evidencia histórica versionada. CI recoge únicamente imágenes DEMO e informes JSON conocidos. El verificador de entrega no imprime valores privados: informa coincidencias por ruta y conteos; su resultado es una comprobación acotada, no una certificación de seguridad total.
