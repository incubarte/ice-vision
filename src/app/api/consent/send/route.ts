import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const { firstName, lastName, docNumber, email, phone } = await request.json();

  const player = `${firstName} ${lastName}`.trim() || '(sin nombre)';
  console.log(`[consent/send] → Iniciando envío para: ${player} | DNI: "${docNumber || '—'}" | email: "${email || '—'}" | phone: "${phone || '—'}"`);

  // Step 1: GET the form page
  const pageRes = await fetch('https://fantasyskate.com.ar/consentimiento/', {
    headers: {
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  }).catch(err => { console.error('[consent/send] GET falló:', err); return null; });

  if (!pageRes) return NextResponse.json({ success: false, message: 'No se pudo conectar' }, { status: 502 });

  const cookies = pageRes.headers.get('set-cookie') ?? '';
  const html = await pageRes.text();

  function extractHidden(name: string): string {
    const escaped = name.replace(/[[\]]/g, '\\$&');
    return (
      html.match(new RegExp(`name="${escaped}"[^>]*value="([^"]*)"`, 'i'))?.[1] ??
      html.match(new RegExp(`value="([^"]*)"[^>]*name="${escaped}"`, 'i'))?.[1] ??
      ''
    );
  }

  // Extract frm_js localized object
  const frmJsMatch = html.match(/var\s+frm_js\s*=\s*(\{[\s\S]*?\});/);
  let frmJs: Record<string, string> = {};
  if (frmJsMatch) {
    try { frmJs = JSON.parse(frmJsMatch[1]); } catch {}
  }
  const ajaxUrl = frmJs.ajax_url ?? 'https://fantasyskate.com.ar/wp-admin/admin-ajax.php';
  const frmNonce = frmJs.nonce ?? '';
  console.log(`[consent/send]   frm_js.nonce: ${frmNonce} | ajax_url: ${ajaxUrl}`);

  const nonce    = extractHidden('frm_submit_entry_2');
  const frmState = extractHidden('frm_state');

  // The antispam_token comes from the form's data-token attribute (set by Formidable server-side)
  // Formidable JS reads it: object.getAttribute("data-token") and injects it as antispam_token
  const dataTokenMatch = html.match(/data-token="([^"]+)"/i);
  const dataToken = dataTokenMatch?.[1] ?? '';
  console.log(`[consent/send]   data-token del form: ${dataToken ? `✓ (${dataToken.slice(0, 12)}…)` : '✗ no encontrado'}`);

  if (!nonce || !frmState) {
    return NextResponse.json({ success: false, message: 'No se pudo obtener tokens del formulario' }, { status: 502 });
  }


  // antispam_token = form's data-token attribute (Formidable reads it and injects it as hidden field via JS)
  const antispam = dataToken || frmNonce;
  if (!dataToken) {
    console.warn(`[consent/send]   data-token no encontrado, usando frm_js.nonce como fallback`);
  }

  const uniqueId = extractHidden('unique_id') || randomUUID();

  console.log(`[consent/send]   Tokens — nonce: ✓ | frm_state: ✓ | antispam: ${antispam ? `✓ (${antispam.slice(0,8)}…)` : '✗'} | unique_id: ✓`);

  const today = new Date().toISOString().split('T')[0];

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

  const submitRes = await fetch('https://fantasyskate.com.ar/consentimiento/', {
    method: 'POST',
    headers: {
      'cookie': cookies,
      'origin': 'https://fantasyskate.com.ar',
      'referer': 'https://fantasyskate.com.ar/consentimiento/',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
    body: formData,
    redirect: 'follow',
  }).catch(err => { console.error('[consent/send] POST excepción:', err); return null; });

  if (!submitRes) return NextResponse.json({ success: false, message: 'Error al enviar el formulario' }, { status: 502 });

  console.log(`[consent/send]   POST → status ${submitRes.status} | url: ${submitRes.url}`);

  const responseText = await submitRes.text();
  const hasMessage     = responseText.includes('frm_message');
  const hasError       = responseText.includes('frm_error');
  const redirectedAway = submitRes.url !== 'https://fantasyskate.com.ar/consentimiento/';
  const responseSnippet = responseText.slice(0, 400).replace(/\s+/g, ' ');

  // Strict: only trust a redirect or an explicit success message. "no frm_error" alone is NOT enough —
  // Cloudflare/WP can return 200 with the original page and nothing gets processed.
  const isSuccess = submitRes.ok && (redirectedAway || (hasMessage && !hasError));
  const reason = redirectedAway ? 'redirigió' : hasMessage ? 'frm_message presente' : 'ninguno';

  if (isSuccess) {
    console.log(`[consent/send] ✓ Enviado: ${player} (razón: ${reason}) | respuesta: ${responseSnippet}`);
  } else {
    console.warn(`[consent/send] ✗ Fallo: ${player}`);
    // Extract ALL field-level error messages (Formidable puts them in <p class="frm_error"> or similar)
    const fieldErrors: string[] = [];
    const fieldErrorRegex = /class="[^"]*frm_error[^"]*"[^>]*>([^<]{1,200})</gi;
    let m: RegExpExecArray | null;
    while ((m = fieldErrorRegex.exec(responseText)) !== null) {
      const msg = m[1].trim();
      if (msg) fieldErrors.push(msg);
    }
    if (fieldErrors.length > 0) {
      console.warn(`[consent/send]   Errores de campo: ${fieldErrors.join(' | ')}`);
    }
    // Always log response snippet so we can diagnose in Vercel logs
    const idx = responseText.indexOf('frm_error');
    const diagSnippet = idx !== -1
      ? responseText.slice(Math.max(0, idx - 30), idx + 600).replace(/\s+/g, ' ')
      : responseSnippet;
    console.warn(`[consent/send]   Respuesta (status ${submitRes.status}, url: ${submitRes.url}): ${diagSnippet}`);
  }

  return NextResponse.json({
    success: isSuccess,
    message: isSuccess ? 'Consentimiento enviado correctamente' : 'Error al enviar el consentimiento',
  });
}
