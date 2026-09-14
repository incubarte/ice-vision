import { NextResponse } from 'next/server';

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

  // Extract hidden field values using regex
  function extractHidden(name: string): string {
    const escaped = name.replace(/[[\]]/g, '\\$&');
    const match =
      html.match(new RegExp(`name="${escaped}"[^>]*value="([^"]*)"`, 'i')) ??
      html.match(new RegExp(`value="([^"]*)"[^>]*name="${escaped}"`, 'i'));
    return match?.[1] ?? '';
  }

  const nonce = extractHidden('frm_submit_entry_2');
  const frmState = extractHidden('frm_state');
  const antispam = extractHidden('antispam_token');
  const uniqueId = extractHidden('unique_id');

  console.log(`[consent/send]   Tokens extraídos — nonce: ${nonce ? '✓' : '✗ FALTA'} | frm_state: ${frmState ? '✓' : '✗ FALTA'} | antispam: ${antispam ? '✓' : '✗ FALTA'} | unique_id: ${uniqueId ? '✓' : '✗ FALTA'}`);

  if (!nonce || !frmState) {
    console.error(`[consent/send] ✗ Tokens insuficientes, abortando para: ${player}`);
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
  formData.append('antispam_token', antispam);
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

  // WordPress Formidable typically redirects on success or shows success message
  const responseText = await submitRes.text();

  const hasMessage = responseText.includes('frm_message');
  const hasSuccess = responseText.includes('success');
  const hasError = responseText.includes('frm_error');
  const redirectedAway = submitRes.url !== 'https://fantasyskate.com.ar/consentimiento/';

  console.log(`[consent/send]   Análisis respuesta — frm_message: ${hasMessage} | success: ${hasSuccess} | frm_error: ${hasError} | redirigió: ${redirectedAway}`);

  const isSuccess =
    submitRes.ok &&
    (redirectedAway || hasMessage || hasSuccess || !hasError);

  if (isSuccess) {
    console.log(`[consent/send] ✓ Enviado exitosamente: ${player}`);
  } else {
    console.warn(`[consent/send] ✗ Posible fallo para: ${player}`);
    // Log a snippet of the response for debugging
    const snippet = responseText.slice(0, 500).replace(/\s+/g, ' ');
    console.warn(`[consent/send]   Inicio de respuesta: ${snippet}`);
  }

  return NextResponse.json({
    success: isSuccess,
    message: isSuccess
      ? 'Consentimiento enviado correctamente'
      : 'Error al enviar el consentimiento',
  });
}
