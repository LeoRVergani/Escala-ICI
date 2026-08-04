# Seed inicial

O seed usa somente o SDK cliente do Firebase. Não utiliza Admin SDK.

1. Crie manualmente o gestor e os nove colaboradores em **Authentication →
   Users**.
2. Crie o documento `usuarios/{uid_do_gestor}` com `nivelHierarquico: 4` e
   `equipeId: "EQ_SOC"`.
3. Substitua em `usuarios.json` os valores `SUBSTITUA_UID_*` pelos UIDs reais.
4. Preencha `.env.local` usando `.env.example`.
5. Publique temporariamente as regras de bootstrap:

   ```bash
   npx firebase-tools deploy --config seed/firebase.bootstrap.json --only firestore:rules
   ```

6. Execute `npm run seed`.
7. Publique imediatamente as regras finais e os índices:

   ```bash
   npx firebase-tools deploy --only firestore:rules,firestore:indexes
   ```

O usuário definido em `FIREBASE_SEED_EMAIL` precisa ser o gestor já cadastrado,
pois as regras temporárias autorizam o bootstrap somente para essa conta.
Não deixe as regras de bootstrap publicadas após concluir a carga.
