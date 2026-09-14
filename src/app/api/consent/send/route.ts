import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const { firstName, lastName, docNumber, email, phone } = await request.json();

  const player = `${firstName} ${lastName}`.trim() || '(sin nombre)';
  console.log(`[consent/send] → Iniciando envío para: ${player} | DNI: ${docNumber || '—'} | email: ${email || '—'}`);

  // Step 1: GET the form page
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

  // Dump all inline script content that mentions frm or antispam so we can understand what JS vars are available
  const scriptMatches = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
  const relevantScripts = scriptMatches
    .map(m => m[1].trim())
    .filter(s => s.includes('frm') || s.includes('antispam') || s.includes('ajaxurl'));
  console.log(`[consent/send]   Scripts con vars frm/antispam: ${relevantScripts.length} encontrados`);
  relevantScripts.forEach((s, i) => {
    // Print up to 800 chars of each relevant script
    console.log(`[consent/send]   Script[${i}]: ${s.slice(0, 800).replace(/\s+/g, ' ')}`);
  });

  // Extract hidden field value
  function extractHidden(name: string): string {
    const escaped = name.replace(/[[\]]/g, '\\$&');
    const m =
      html.match(new RegExp(`name="${escaped}"[^>]*value="([^"]*)"`, 'i')) ??
      html.match(new RegExp(`value="([^"]*)"[^>]*name="${escaped}"`, 'i'));
    return m?.[1] ?? '';
  }

  // Extract from JS var/object in inline scripts (handles both JSON and var assignment)
  function extractFromJS(key: string): string {
    const escaped = key.replace(/[[\]]/g, '\\$&');
    const m =
      html.match(new RegExp(`"${escaped}"\\s*:\\s*"([^"]+)"`, 'i')) ??
      html.match(new RegExp(`${escaped}\\s*[=:]\\s*["']([^"']+)["']`, 'i'));
    return m?.[1] ?? '';
  }

  const nonce    = extractHidden('frm_submit_entry_2');
  const frmState = extractHidden('frm_state');

  let antispam = extractHidden('antispam_token') || extractFromJS('antispam_token');

  // Try to get antispam token via Formidable's AJAX endpoint
  if (!antispam) {
    const ajaxUrl = extractFromJS('ajaxurl') || 'https://fantasyskate.com.ar/wp-admin/admin-ajax.php';
    // nonce for AJAX — Formidable localizes it as frm_js.nonce or similar
    const ajaxNonce = extractFromJS('nonce') || extractFromJS('frm_nonce');
    console.log(`[consent/send]   Intentando obtener antispam_token vía AJAX | url: ${ajaxUrl} | nonce: ${ajaxNonce || '(sin nonce)'}`);

    try {
      const ajaxBody = new URLSearchParams();
      ajaxBody.set('action', 'frm_antispam_js');
      if (ajaxNonce) ajaxBody.set('nonce', ajaxNonce);
      ajaxBody.set('form_id', '2');

      const ajaxRes = await fetch(ajaxUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'cookie': cookies,
          'referer': 'https://fantasyskate.com.ar/consentimiento/',
          'x-requested-with': 'XMLHttpRequest',
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
        body: ajaxBody.toString(),
      });
      const ajaxText = await ajaxRes.text();
      console.log(`[consent/send]   AJAX response (${ajaxRes.status}): ${ajaxText.slice(0, 300)}`);

      // Response might be JSON {"success":true,"data":"token"} or plain token
      try {
        const ajaxJson = JSON.parse(ajaxText);
        antispam = ajaxJson?.data ?? ajaxJson?.token ?? ajaxJson?.antispam_token ?? '';
      } catch {
        antispam = ajaxText.trim().replace(/^"(.*)"$/, '$1'); // bare string
      }
      if (antispam) console.log(`[consent/send]   antispam_token obtenido vía AJAX: ${antispam.slice(0, 12)}…`);
    } catch (err) {
      console.warn(`[consent/send]   AJAX para antispam falló:`, err);
    }
  }

  let uniqueId = extractHidden('unique_id') || extractFromJS('unique_id');
  if (!uniqueId) {
    uniqueId = randomUUID();
    console.log(`[consent/send]   unique_id generado: ${uniqueId}`);
  }

  console.log(`[consent/send]   Tokens finales — nonce: ${nonce ? '✓' : '✗'} | frm_state: ${frmState ? '✓' : '✗'} | antispam: ${antispam ? `✓ (${antispam.slice(0, 8)}…)` : '✗ ausente'} | unique_id: ✓`);

  if (!nonce || !frmState) {
    console.error(`[consent/send] ✗ Tokens mínimos faltantes, abortando`);
    return NextResponse.json({ success: false, message: 'No se pudo obtener los tokens del formulario' }, { status: 502 });
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
    console.error(`[consent/send] ✗ Error al hacer POST:`, err);
    return NextResponse.json({ success: false, message: 'Error al enviar el formulario' }, { status: 502 });
  }

  console.log(`[consent/send]   POST → status ${submitRes.status} | url final: ${submitRes.url}`);

  const responseText = await submitRes.text();
  const hasMessage   = responseText.includes('frm_message');
  const hasSuccess   = responseText.includes('success');
  const hasError     = responseText.includes('frm_error');
  const redirectedAway = submitRes.url !== 'https://fantasyskate.com.ar/consentimiento/';

  console.log(`[consent/send]   Análisis — frm_message: ${hasMessage} | frm_error: ${hasError} | redirigió: ${redirectedAway}`);

  const isSuccess = submitRes.ok && (redirectedAway || hasMessage || hasSuccess || !hasError);

  if (isSuccess) {
    console.log(`[consent/send] ✓ Enviado exitosamente: ${player}`);
  } else {
    console.warn(`[consent/send] ✗ Fallo para: ${player}`);
    const errorIdx = responseText.indexOf('frm_error');
    if (errorIdx !== -1) {
      const snippet = responseText.slice(Math.max(0, errorIdx - 50), errorIdx + 400).replace(/\s+/g, ' ');
      console.warn(`[consent/send]   Error en respuesta: …${snippet}…`);
    }
  }

  return NextResponse.json({
    success: isSuccess,
    message: isSuccess ? 'Consentimiento enviado correctamente' : 'Error al enviar el consentimiento',
  });
}
