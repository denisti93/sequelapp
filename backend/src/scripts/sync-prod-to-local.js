import 'dotenv/config';
import mongoose from 'mongoose';

function getArgValue(flagName) {
  const prefix = `${flagName}=`;
  const argument = process.argv.find((item) => item.startsWith(prefix));
  return argument ? argument.slice(prefix.length) : '';
}

function boolArg(flagName) {
  return process.argv.includes(flagName);
}

function normalizeUri(value) {
  return String(value || '').trim();
}

async function openConnection(uri, label) {
  if (!uri) {
    throw new Error(`URI ausente para ${label}.`);
  }
  return mongoose.createConnection(uri).asPromise();
}

function safeUserLabel(user) {
  const username = String(user?.username || '');
  const name = String(user?.name || '');
  if (username && name) return `${username} (${name})`;
  if (username) return username;
  if (name) return name;
  return '<sem identificação>';
}

async function run() {
  const prodUri = normalizeUri(getArgValue('--prod-uri') || process.env.PROD_MONGO_URI);
  const localUri = normalizeUri(
    getArgValue('--local-uri') || process.env.LOCAL_MONGO_URI || process.env.MONGO_URI
  );
  const dryRun = boolArg('--dry-run');
  const confirmed = boolArg('--yes');

  if (!prodUri) {
    throw new Error('Informe a URI de produção com --prod-uri=... ou PROD_MONGO_URI.');
  }

  if (!localUri) {
    throw new Error('Informe a URI local com --local-uri=... ou LOCAL_MONGO_URI/MONGO_URI.');
  }

  if (!dryRun && !confirmed) {
    throw new Error(
      'A operação altera o banco local. Execute com --yes para confirmar ou --dry-run para simular.'
    );
  }

  const prodConn = await openConnection(prodUri, 'produção');
  const localConn = await openConnection(localUri, 'local');

  try {
    const prodUsersCol = prodConn.collection('users');
    const prodPeladasCol = prodConn.collection('peladas');
    const localUsersCol = localConn.collection('users');
    const localPeladasCol = localConn.collection('peladas');

    const [localAdmins, prodPlayers, prodPeladas, localPlayerCount, localPeladaCount] = await Promise.all([
      localUsersCol.find({ role: 'ADM' }).toArray(),
      prodUsersCol.find({ role: 'JOGADOR' }).toArray(),
      prodPeladasCol.find({}).toArray(),
      localUsersCol.countDocuments({ role: 'JOGADOR' }),
      localPeladasCol.countDocuments({})
    ]);

    const localAdminUsernames = new Set(localAdmins.map((admin) => String(admin.username || '').trim()));
    const localAdminIds = new Set(localAdmins.map((admin) => String(admin._id)));

    const usernameConflicts = prodPlayers.filter((player) =>
      localAdminUsernames.has(String(player.username || '').trim())
    );
    const idConflicts = prodPlayers.filter((player) => localAdminIds.has(String(player._id)));

    if (usernameConflicts.length > 0) {
      const details = usernameConflicts.map((user) => safeUserLabel(user)).join(', ');
      throw new Error(
        `Conflito de username entre jogadores da produção e ADMs locais: ${details}. Ajuste antes de sincronizar.`
      );
    }

    if (idConflicts.length > 0) {
      throw new Error(
        'Conflito de _id entre jogadores da produção e ADMs locais. Ajuste os dados antes de sincronizar.'
      );
    }

    // eslint-disable-next-line no-console
    console.log('');
    // eslint-disable-next-line no-console
    console.log('Resumo da sincronização');
    // eslint-disable-next-line no-console
    console.log(`- DB produção: ${prodConn.name}`);
    // eslint-disable-next-line no-console
    console.log(`- DB local: ${localConn.name}`);
    // eslint-disable-next-line no-console
    console.log(`- ADMs locais preservados: ${localAdmins.length}`);
    // eslint-disable-next-line no-console
    console.log(`- Jogadores locais atuais: ${localPlayerCount}`);
    // eslint-disable-next-line no-console
    console.log(`- Rachas locais atuais: ${localPeladaCount}`);
    // eslint-disable-next-line no-console
    console.log(`- Jogadores vindos da produção: ${prodPlayers.length}`);
    // eslint-disable-next-line no-console
    console.log(`- Rachas vindos da produção: ${prodPeladas.length}`);

    if (dryRun) {
      // eslint-disable-next-line no-console
      console.log('');
      // eslint-disable-next-line no-console
      console.log('Dry-run finalizado. Nenhuma alteração foi aplicada.');
      return;
    }

    const deleteLocalPlayersResult = await localUsersCol.deleteMany({ role: 'JOGADOR' });
    const deleteLocalPeladasResult = await localPeladasCol.deleteMany({});

    if (prodPlayers.length > 0) {
      await localUsersCol.insertMany(prodPlayers, { ordered: true });
    }

    if (prodPeladas.length > 0) {
      await localPeladasCol.insertMany(prodPeladas, { ordered: true });
    }

    // eslint-disable-next-line no-console
    console.log('');
    // eslint-disable-next-line no-console
    console.log('Sincronização concluída com sucesso.');
    // eslint-disable-next-line no-console
    console.log(`- Jogadores locais removidos: ${deleteLocalPlayersResult.deletedCount}`);
    // eslint-disable-next-line no-console
    console.log(`- Rachas locais removidos: ${deleteLocalPeladasResult.deletedCount}`);
    // eslint-disable-next-line no-console
    console.log(`- Jogadores inseridos da produção: ${prodPlayers.length}`);
    // eslint-disable-next-line no-console
    console.log(`- Rachas inseridos da produção: ${prodPeladas.length}`);
    // eslint-disable-next-line no-console
    console.log(`- ADMs locais preservados: ${localAdmins.length}`);
  } finally {
    await Promise.allSettled([prodConn.close(), localConn.close()]);
  }
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(`Erro na sincronização: ${error.message || error}`);
  process.exit(1);
});
