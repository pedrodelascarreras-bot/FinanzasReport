/**
 * fetch-data.js — Lee finanzas-data-sync.json desde Google Drive
 * Usa una Service Account para autenticar (sin intervención humana).
 * 
 * Requiere: GOOGLE_SERVICE_ACCOUNT_JSON (secret con el JSON de la SA)
 */

const { google } = require('googleapis');

const SYNC_FILE_NAME = 'finanzas-data-sync.json';
const SYNC_FOLDER_NAME = 'FinanzasApp';

async function fetchFinanceData() {
  // Autenticar con Service Account
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  const drive = google.drive({ version: 'v3', auth });

  // 1. Buscar la carpeta FinanzasApp
  const folderRes = await drive.files.list({
    q: `name='${SYNC_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
    supportsAllDrives: true,
  });

  if (!folderRes.data.files?.length) {
    throw new Error(
      `No se encontró la carpeta "${SYNC_FOLDER_NAME}" en Drive.\n` +
      `Asegurate de:\n` +
      `1. Haber abierto la app y conectado Google al menos una vez\n` +
      `2. Haber compartido la carpeta "${SYNC_FOLDER_NAME}" con la Service Account`
    );
  }

  const folderId = folderRes.data.files[0].id;

  // 2. Buscar el archivo de datos dentro de la carpeta
  const fileRes = await drive.files.list({
    q: `name='${SYNC_FILE_NAME}' and '${folderId}' in parents and trashed=false`,
    fields: 'files(id, name, modifiedTime)',
  });

  if (!fileRes.data.files?.length) {
    throw new Error(
      `No se encontró "${SYNC_FILE_NAME}" en la carpeta "${SYNC_FOLDER_NAME}".\n` +
      `Abrí la app, conectá Google, y hacé al menos un cambio para que se sincronice.`
    );
  }

  const file = fileRes.data.files[0];
  console.log(`📂 Archivo encontrado: ${file.name} (modificado: ${file.modifiedTime})`);

  // 3. Descargar contenido
  const content = await drive.files.get(
    { fileId: file.id, alt: 'media' },
    { responseType: 'json' }
  );

  const data = content.data;

  // Validación básica
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
