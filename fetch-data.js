/**
 * fetch-data.js — Lee finanzas-data-sync.json desde Google Drive
 * Usa una Service Account para autenticar (sin intervención humana).
 * 
 * Requiere: GOOGLE_SERVICE_ACCOUNT_JSON (secret con el JSON de la SA)
 */

const { google } = require('googleapis');

const SYNC_FILE_NAME = 'finanzas-data-sync.json';

async function fetchFinanceData() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  const drive = google.drive({ version: 'v3', auth });

  const fileRes = await drive.files.list({
    q: `name='${SYNC_FILE_NAME}' and trashed=false`,
    fields: 'files(id, name, modifiedTime)',
    supportsAllDrives: true,
  });

  if (!fileRes.data.files?.length) {
    throw new Error(
      `No se encontró "${SYNC_FILE_NAME}" en Drive.\n` +
      `Asegurate de:\n` +
      `1. Haber abierto la app y conectado Google al menos una vez\n` +
      `2. Haber hecho un cambio para que se sincronice\n` +
      `3. Haber compartido el archivo con la Service Account`
    );
  }

  const file = fileRes.data.files[0];
  console.log(`📂 Archivo encontrado: ${file.name} (modificado: ${file.modifiedTime})`);

  const content = await drive.files.get(
    { fileId: file.id, alt: 'media' },
    { responseType: 'json' }
  );

  const data = content.data;

  if (!data.transactions || !Array.isArray(data.transactions)) {
    throw new Error('El archivo no contiene transacciones válidas');
  }

  console.log(`✓ ${data.transactions.length} transacciones cargadas`);
  console.log(`✓ ${(data.categories || []).length} categorías`);
  console.log(`✓ ${(data.savAccounts || []).length} cuentas de ahorro`);
  console.log(`✓ TC USD/ARS: $${data.usdRate || 'no definido'}`);

  return {
    data,
    lastModified: file.modifiedTime,
  };
}

module.exports = { fetchFinanceData };
