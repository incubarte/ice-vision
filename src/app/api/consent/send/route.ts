import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const { firstName, lastName, docNumber, email, phone } = await request.json();

  const player = `${firstName} ${lastName}`.trim() || '(sin nombre)';
  console.log(`[consent/send] → Iniciando envío para: ${player} | DNI: ${docNumber || '—'} | email: ${email || '—'}`);

  // Step 1: GET the form page and extract cookies + tokens
  let pageRes: Response;
  try {
    pageRes = await fetch('https://fantasyskate.com.ar/consentimiento/', {
      headers: {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
  } catch (err) {
    console.error(`[consent/send] ✗ No se pudo hacer GET al formulario:`, err);
    return NextResponse.json({ success: false, message: 'No se pudo conectar con el sitio del formulario' }, { status: 502 });
  }

  console.log(`[consent/send]   GET /consentimiento/ → status ${pageRes.status}`);

  const cookies = pageRes.headers.get('set-cookie') ?? '';
  const html = await pageRes.text();

  // Extract hidden field value — tries attribute order variations
  function extractHidden(name: string): string {
    const escaped = name.replace(/[[\]]/g, '\\$&');
    const m =
      html.match(new RegExp(`name="${escaped}"[^>]*value="([^"]*)"`, 'i')) ??
      html.match(new RegExp(`value="([^"]*)"[^>]*name="${escaped}"`, 'i'));
    return m?.[1] ?? '';
  }

  // Extract a value from inline <script> JSON blobs (wp_localize_script / inline vars)
  function extractFromScript(key: string): string {
    const escaped = key.replace(/[[\]]/g, '\\$&');
    // Matches: "key":"value" or "key": "value"
    const m = html.match(new RegExp(`"${escaped}"\\s*:\\s*"([^"]+)"`, 'i'));
    return m?.[1] ?? '';
  }

  const nonce     = extractHidden('frm_submit_entry_2');
  const frmState  = extractHidden('frm_state');

  // antispam_token: try hidden input first, then inline script JSON
  let antispam = extractHidden('antispam_token');
  if (!antispam) antispam = extractFromScript('antispam_token');

  // unique_id: try hidden input, then script JSON, then generate a UUID ourselves
  // (Formidable's JS generates this client-side to deduplicate submissions)
  let uniqueId = extractHidden('unique_id');
  if (!uniqueId) uniqueId = extractFromScript('unique_id');
  if (!uniqueId) {
    uniqueId = randomUUID();
    console.log(`[consent/send]   unique_id no encontrado en HTML — generando: ${uniqueId}`);
  }

  console.log(`[consent/send]   Tokens — nonce: ${nonce ? '✓' : '✗ FALTA'} | frm_state: ${frmState ? '✓' : '✗ FALTA'} | antispam: ${antispam ? `✓ (${antispam.slice(0, 8)}…)` : '✗ ausente'} | unique_id: ${uniqueId ? '✓' : '✗'}`);

  // Log HTML sections that mention antispam_token / unique_id so we can see the real format
  const antispamIdx = html.indexOf('antispam_token');
  if (antispamIdx !== -1) {
    console.log(`[consent/send]   HTML alrededor de antispam_token: …${html.slice(Math.max(0, antispamIdx - 80), antispamIdx + 120).replace(/\s+/g, ' ')}…`);
  } else {
    console.log(`[consent/send]   "antispam_token" no aparece en el HTML estático — probablemente inyectado por JS`);
  }

  if (!nonce || !frmState) {
    console.error(`[consent/send] ✗ Tokens mínimos faltantes (nonce/frm_state), abortando para: ${player}`);
    return NextResponse.json(
      { success: false, message: 'No se pudo obtener los tokens del formulario' },
      { status: 502 }
    );
  }

  const today = new Date().toISOString().split('T')[0];

  // Step 2: Build and POST the form
  const formData = new FormData();
  formData.append('frm_action', 'create');
  formData.append('form_id', '2');
  formData.append('frm_hide_fields_2', '["frm_field_19_container"]');
  formData.append('form_key', 'consentimiento-ingreso-pista');
  formData.append('item_meta[0]', '');
  formData.append('frm_submit_entry_2', nonce);
  formData.append('_wp_http_referer', '/consentimiento/');
  formData.append('item_meta[9][first]', firstName);
  formData.append('item_meta[9][last]', lastName);
  formData.append('item_meta[11]', docNumber);
  formData.append('item_meta[12]', email);
  formData.append('item_meta[13]', phone);
  formData.append('item_meta[35]', 'No');
  formData.append('item_meta[33]', today);
  formData.append('item_meta[34]', today);
  formData.append('item_meta[19][form]', '4');
  formData.append('item_meta[19][row_ids][]', '0');
  formData.append('item_meta[19][0][0]', '');
  formData.append('item_meta[19][0][21][first]', '');
  formData.append('item_meta[19][0][21][last]', '');
  formData.append('item_meta[26][]', 'Declaro haber leído y acepto el consentimiento informado y la asunción de riesgo.');
  formData.append('item_key', '');
  formData.append('item_meta[36]', '');
  formData.append('frm_state', frmState);
  if (antispam) formData.append('antispam_token', antispam);
  formData.append('unique_id', uniqueId);

  let submitRes: Response;
  try {
    submitRes = await fetch('https://fantasyskate.com.ar/consentimiento/', {
      method: 'POST',
      headers: {
        'cookie': cookies,
        'origin': 'https://fantasyskate.com.ar',
        'referer': 'https://fantasyskate.com.ar/consentimiento/',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      body: formData,
      redirect: 'follow',
    });
  } catch (err) {
    console.error(`[consent/send] ✗ Error al hacer POST del formulario para: ${player}`, err);
    return NextResponse.json({ success: false, message: 'Error al enviar el formulario' }, { status: 502 });
  }

  console.log(`[consent/send]   POST /consentimiento/ → status ${submitRes.status} | url final: ${submitRes.url}`);

  const responseText = await submitRes.text();

  const hasMessage   = responseText.includes('frm_message');
  const hasSuccess   = responseText.includes('success');
  const hasError     = responseText.includes('frm_error');
  const redirectedAway = submitRes.url !== 'https://fantasyskate.com.ar/consentimiento/';

  console.log(`[consent/send]   Análisis — frm_message: ${hasMessage} | success: ${hasSuccess} | frm_error: ${hasError} | redirigió: ${redirectedAway}`);

  const isSuccess = submitRes.ok && (redirectedAway || hasMessage || hasSuccess || !hasError);

  if (isSuccess) {
    console.log(`[consent/send] ✓ Enviado exitosamente: ${player}`);
  } else {
    console.warn(`[consent/send] ✗ Fallo para: ${player}`);
    // Log the section of the response that mentions frm_error for diagnosis
    const errorIdx = responseText.indexOf('frm_error');
    if (errorIdx !== -1) {
      const snippet = responseText.slice(Math.max(0, errorIdx - 100), errorIdx + 300).replace(/\s+/g, ' ');
      console.warn(`[consent/send]   Contexto del error en respuesta: …${snippet}…`);
    } else {
      console.warn(`[consent/send]   Inicio de respuesta: ${responseText.slice(0, 400).replace(/\s+/g, ' ')}`);
    }
  }

  return NextResponse.json({
    success: isSuccess,
    message: isSuccess
      ? 'Consentimiento enviado correctamente'
      : 'Error al enviar el consentimiento',
  });
}
