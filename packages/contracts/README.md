# Contratos compartidos de Poke-Voice

Este paquete contiene los contratos de datos que compartirán la Pokédex, PokeDiscover, el editor de escenarios y un posible backend.

## Reglas

- Los contratos deben ser serializables como JSON y no contener funciones ni objetos ligados a React o Phaser.
- Cada contrato persistido o exportado declara `schemaVersion`.
- Las referencias entre entidades usan identificadores estables; las coordenadas o nombres visibles no actúan como claves.
- Especie, forma y entrada de Pokédex son entidades diferentes.
- Los requisitos compuestos utilizan `RequirementExpressionV1` con ramas `all` y `any`.
- Toda interacción expresiva obligatoria declara `fallbackActionId` para que el progreso no dependa del micrófono.
- Cambiar un contrato versionado requiere documentar y probar su migración antes de utilizarlo en partidas existentes.
