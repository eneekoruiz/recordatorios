# Historial de esquema y bloqueo del cron

`20261007000000_initial` describe las tablas que ya existían antes de esta
corrección. `20261008120000_add_cron_lease` añade únicamente `CronLease` y su
índice. No elimina tablas ni modifica datos de usuarios.

## Base de datos nueva

Con `DATABASE_URL` apuntando a una base vacía:

```sh
npx prisma migrate deploy
```

## Base existente creada mediante `db push`

El proyecto se gestionaba sin historial de migraciones. Para seguir ese flujo,
`npx prisma db push` aplica la tabla adicional. Revisa el resumen del comando:
esta corrección no necesita aceptar pérdida de datos. Aplica el esquema antes
de desplegar la nueva función de avisos; sin `CronLease`, el cron responde 503.

Si se adopta el historial de migraciones, primero compara el esquema existente
con la migración inicial. Cuando coincidan, registra la inicial como aplicada
sin ejecutar su SQL y después aplica la migración adicional:

```sh
npx prisma migrate resolve --applied 20261007000000_initial
npx prisma migrate deploy
```

Si `CronLease` ya se creó mediante `db push`, verifica también su esquema y
registra `20261008120000_add_cron_lease` como aplicada. No ejecutes `migrate
deploy` sobre una base con tablas existentes sin haber establecido su baseline.

La verificación local usa una base en memoria para concurrencia y reintentos;
la migración SQL todavía debe comprobarse en PostgreSQL antes del despliegue.
Un bloqueo evita ejecuciones simultáneas, pero un cierre del proceso entre el
envío push y su confirmación en base de datos puede provocar un reenvío.
