<?php
/*
 * Peak Leads - public/api/hubspot-lead.php
 * Puts a qualified lead from /book-a-call/ into HubSpot and gives it an owner.
 * src/js/lead.js posts here (JSON) for every set of answers that opened the
 * booking calendar.
 *
 *   Contact   Found by email, or created. A new contact gets the name, phone,
 *             lifecycle stage "lead" and lead status "New"; an existing one
 *             only gets a phone it did not have, so a repeat visit never
 *             overwrites what the team has typed in.
 *   Owner     Brad and Jesse take turns, in the order the config lists them.
 *             A contact that already has an owner keeps them, so a retry or a
 *             repeat visit never moves a lead between the two or skips a turn.
 *   Note      Everything the questions asked, on the contact's timeline.
 *
 * The token and the owners live OUTSIDE the web root, in
 * peakleads-private/hubspot.php next to public_html, so a deploy can neither
 * overwrite nor publish them:
 *
 *   <?php return [
 *     'token'  => 'pat-eu1-...',
 *     'owners' => ['bradley@peakleads.agency', 'jesse@...'],  // emails or owner IDs
 *   ];
 *
 * The rotation counter and the ids of leads already handled are kept in the
 * same folder.
 */

ini_set('display_errors', '0');
header('Content-Type: application/json');
header('Cache-Control: no-store');

const MAX_BODY = 20000;
const ALLOWED_ORIGINS = ['https://peakleads.agency', 'https://www.peakleads.agency'];
const NOTE_TO_CONTACT = 202; // HubSpot-defined association type: note -> contact
const SEEN_KEEP = 200;

function reply($status, $body)
{
    http_response_code($status);
    echo json_encode($body);
    exit;
}

function private_dir()
{
    $candidates = [dirname(__DIR__, 2) . '/peakleads-private'];
    if (!empty($_SERVER['DOCUMENT_ROOT'])) {
        $candidates[] = dirname(rtrim($_SERVER['DOCUMENT_ROOT'], '/')) . '/peakleads-private';
    }
    foreach ($candidates as $dir) {
        if (is_file($dir . '/hubspot.php')) return $dir;
    }
    return null;
}

/* ------------------------------------------------------------------ *
 * HubSpot
 * ------------------------------------------------------------------ */
function hs($method, $path, $body = null)
{
    global $config;
    $base = isset($config['api_base']) ? $config['api_base'] : 'https://api.hubapi.com';
    $ch = curl_init($base . $path);
    $headers = ['Authorization: Bearer ' . $config['token'], 'Accept: application/json'];
    if ($body !== null) {
        $headers[] = 'Content-Type: application/json';
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
    ]);
    $raw = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $data = is_string($raw) ? json_decode($raw, true) : null;
    if ($code < 200 || $code >= 300) {
        error_log('hubspot-lead: ' . $method . ' ' . $path . ' -> HTTP ' . $code . ' ' . substr((string) $raw, 0, 500));
        throw new RuntimeException('HubSpot ' . $code);
    }
    return is_array($data) ? $data : [];
}

function find_contact($email)
{
    $res = hs('POST', '/crm/v3/objects/contacts/search', [
        'filterGroups' => [['filters' => [['propertyName' => 'email', 'operator' => 'EQ', 'value' => $email]]]],
        'properties' => ['email', 'phone', 'hubspot_owner_id'],
        'limit' => 1,
    ]);
    return !empty($res['results'][0]) ? $res['results'][0] : null;
}

/* An owner in the config is an owner ID or the email they log in with. */
function owner_id($owner)
{
    $owner = trim((string) $owner);
    if (ctype_digit($owner)) return $owner;
    $res = hs('GET', '/crm/v3/owners/?limit=1&email=' . rawurlencode($owner));
    if (empty($res['results'][0]['id'])) throw new RuntimeException('No HubSpot owner for ' . $owner);
    return (string) $res['results'][0]['id'];
}

/* ------------------------------------------------------------------ *
 * State: whose turn it is, and the leads already handled
 * ------------------------------------------------------------------ */
function with_state($dir, $fn)
{
    $fh = fopen($dir . '/hubspot-state.json', 'c+');
    if (!$fh) throw new RuntimeException('State file not writable');
    flock($fh, LOCK_EX);
    try {
        $state = json_decode(stream_get_contents($fh), true);
        if (!is_array($state)) $state = [];
        $state += ['next' => 0, 'seen' => []];
        $result = $fn($state);
        ftruncate($fh, 0);
        rewind($fh);
        fwrite($fh, json_encode($state));
        fflush($fh);
        return $result;
    } finally {
        flock($fh, LOCK_UN);
        fclose($fh);
    }
}

function clean($value, $max = 500)
{
    $value = is_string($value) ? trim(preg_replace('/\s+/u', ' ', $value)) : '';
    return mb_substr($value, 0, $max);
}

/* ------------------------------------------------------------------ *
 * Request
 * ------------------------------------------------------------------ */
if ($_SERVER['REQUEST_METHOD'] !== 'POST') reply(405, ['error' => 'POST only']);

$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
if ($origin !== '' && !in_array($origin, ALLOWED_ORIGINS, true)) reply(403, ['error' => 'origin']);

$raw = file_get_contents('php://input', false, null, 0, MAX_BODY + 1);
if ($raw === false || strlen($raw) > MAX_BODY) reply(413, ['error' => 'too large']);
$in = json_decode($raw, true);
if (!is_array($in)) reply(400, ['error' => 'not JSON']);

$email = strtolower(clean(isset($in['email']) ? $in['email'] : '', 254));
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) reply(400, ['error' => 'email']);
$leadId = clean(isset($in['leadId']) ? $in['leadId'] : '', 64);

$dir = private_dir();
if ($dir === null) reply(503, ['error' => 'not configured']);
$config = require $dir . '/hubspot.php';
if (empty($config['token']) || empty($config['owners']) || !is_array($config['owners'])) {
    reply(503, ['error' => 'not configured']);
}

$name = clean(isset($in['name']) ? $in['name'] : '', 120);
$parts = preg_split('/\s+/u', $name, 2);
$phone = clean(isset($in['phone']) ? $in['phone'] : '', 40);

try {
    /* The whole hand-off runs under the state lock, so two leads arriving
       together cannot both take the same turn, and a retry that crosses its
       own first attempt finds it already handled. */
    $result = with_state($dir, function (&$state) use ($config, $in, $email, $leadId, $name, $parts, $phone) {
        if ($leadId !== '' && in_array($leadId, $state['seen'], true)) {
            return ['ok' => true, 'duplicate' => true];
        }

        $contact = find_contact($email);
        $owners = array_values($config['owners']);

        if ($contact === null) {
            $ownerId = owner_id($owners[$state['next'] % count($owners)]);
            $state['next'] = ($state['next'] + 1) % count($owners);
            $props = [
                'email' => $email,
                'firstname' => isset($parts[0]) ? $parts[0] : '',
                'lastname' => isset($parts[1]) ? $parts[1] : '',
                'phone' => $phone,
                'lifecyclestage' => 'lead',
                'hs_lead_status' => 'NEW',
                'hubspot_owner_id' => $ownerId,
            ];
            $contact = hs('POST', '/crm/v3/objects/contacts', ['properties' => array_filter($props, 'strlen')]);
        } else {
            $props = [];
            if (empty($contact['properties']['hubspot_owner_id'])) {
                $props['hubspot_owner_id'] = owner_id($owners[$state['next'] % count($owners)]);
                $state['next'] = ($state['next'] + 1) % count($owners);
            }
            if ($phone !== '' && empty($contact['properties']['phone'])) $props['phone'] = $phone;
            if ($props) hs('PATCH', '/crm/v3/objects/contacts/' . rawurlencode($contact['id']), ['properties' => $props]);
        }

        $rows = [
            'Name' => $name,
            'Email' => $email,
            'Phone' => $phone,
            'About the business' => clean(isset($in['business']) ? $in['business'] : ''),
            'Help with' => clean(isset($in['helpWith']) ? $in['helpWith'] : ''),
            'Monthly revenue' => clean(isset($in['monthlyRevenue']) ? $in['monthlyRevenue'] : '', 120),
            'Came from' => clean(isset($in['cameFrom']) ? $in['cameFrom'] : ''),
        ];
        $html = '<p><strong>Book a call questions (peakleads.agency)</strong></p>';
        foreach ($rows as $label => $value) {
            if ($value === '') continue;
            $html .= '<p><strong>' . htmlspecialchars($label) . ':</strong> ' . htmlspecialchars($value) . '</p>';
        }
        hs('POST', '/crm/v3/objects/notes', [
            'properties' => ['hs_timestamp' => gmdate('Y-m-d\TH:i:s\Z'), 'hs_note_body' => $html],
            'associations' => [[
                'to' => ['id' => $contact['id']],
                'types' => [['associationCategory' => 'HUBSPOT_DEFINED', 'associationTypeId' => NOTE_TO_CONTACT]],
            ]],
        ]);

        if ($leadId !== '') {
            $state['seen'][] = $leadId;
            $state['seen'] = array_slice($state['seen'], -SEEN_KEEP);
        }
        return ['ok' => true];
    });
    reply(200, $result);
} catch (Throwable $e) {
    error_log('hubspot-lead: ' . $e->getMessage());
    reply(502, ['error' => 'hubspot']);
}
