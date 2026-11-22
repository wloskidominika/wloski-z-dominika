<?php
/* =====================================================================
   Włoski z Dominiką – il "motore" del sito e dell'app, tutto su Aruba.
   I dati stanno nella cartella /dati (protetta: nessuno la può aprire
   dal browser). Niente servizi esterni obbligatori.
   ===================================================================== */
declare(strict_types=1);
mb_internal_encoding('UTF-8');
date_default_timezone_set('UTC');
const DATA = __DIR__ . '/../dati';
const GUARD = "<?php exit; ?>\n";
const SITE_URL = 'https://wloskizdominika.com';
const NOTIFY_TO = 'info@wloskizdominika.com';          // dove arrivano le richieste del sito
const MAIL_FROM = 'info@wloskizdominika.com';          // casella del dominio (Aruba la richiede)
const LANG_NAMES = ['it' => 'Italiano 🇮🇹', 'de' => 'Tedesco 🇩🇪 (Deutsch)', 'en' => 'Inglese 🇬🇧 (English)', 'pl' => 'Polacco 🇵🇱 (Polski)', 'es' => 'Spagnolo 🇪🇸 (Español)'];

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Robots-Tag: noindex');
header('X-Content-Type-Options: nosniff');

/* ---------------- archivio ---------------- */
function boot(): void {
    foreach ([DATA, DATA . '/files', DATA . '/files/materials', DATA . '/files/documents', DATA . '/visite', __DIR__ . '/../media/up'] as $d)
        if (!is_dir($d)) @mkdir($d, 0755, true);
    if (!file_exists(DATA . '/.htaccess')) @file_put_contents(DATA . '/.htaccess', "Require all denied\nDeny from all\n");
    if (!file_exists(DATA . '/index.html')) @file_put_contents(DATA . '/index.html', '');
}
function fpath(string $name): string { return DATA . '/' . $name . '.php'; }
function readf(string $name, $def = []) {
    $f = fpath($name);
    if (!is_file($f)) return $def;
    $s = (string)file_get_contents($f);
    if (strncmp($s, GUARD, strlen(GUARD)) === 0) $s = substr($s, strlen(GUARD));
    $v = json_decode($s, true);
    return $v === null ? $def : $v;
}
function writef(string $name, $val): void {
    $f = fpath($name); $tmp = $f . '.' . bin2hex(random_bytes(4)) . '.tmp';
    file_put_contents($tmp, GUARD . json_encode($val, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    rename($tmp, $f);
}
/* lettura-modifica-scrittura con lucchetto, così due salvataggi insieme non si perdono */
function locked(string $name, callable $fn) {
    $h = fopen(DATA . '/.lock-' . $name, 'c'); flock($h, LOCK_EX);
    try { return $fn(); } finally { flock($h, LOCK_UN); fclose($h); }
}
function cfg(): array {
    return locked('config', function () {
        $c = readf('config', []);
        if (empty($c['secret'])) { $c['secret'] = bin2hex(random_bytes(32)); writef('config', $c); }
        return $c;
    });
}
function setting(string $k): string { $s = readf('t_app_settings', ['rows' => []]); foreach ($s['rows'] as $r) if (($r['key'] ?? '') === $k) return (string)($r['value'] ?? ''); return ''; }
function now(): string { return gmdate('Y-m-d\TH:i:s\Z'); }
function uuid(): string { $b = random_bytes(16); $b[6] = chr(ord($b[6]) & 0x0f | 0x40); $b[8] = chr(ord($b[8]) & 0x3f | 0x80); return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4)); }
function out($data = null, $error = null, $extra = []): void { echo json_encode(array_merge(['data' => $data, 'error' => $error ? ['message' => $error] : null], $extra), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }
function fail(string $msg, int $code = 400): void { http_response_code($code); out(null, $msg); }
function ip(): string { return (string)($_SERVER['REMOTE_ADDR'] ?? ''); }
/* freno anti-abuso: al massimo $max azioni in $secs secondi dallo stesso indirizzo */
function throttle(string $what, int $max, int $secs): void {
    $k = 'rl_' . substr(hash('sha256', $what . ip() . cfg()['secret']), 0, 20);
    $f = sys_get_temp_dir() . '/wzd_' . $k; $now = time();
    $hits = array_values(array_filter(array_map('intval', @file($f) ?: []), fn($t) => $t > $now - $secs));
    if (count($hits) >= $max) fail('Troppi tentativi: riprova tra qualche minuto.', 429);
    $hits[] = $now; @file_put_contents($f, implode("\n", $hits));
}

/* ---------------- tabelle ---------------- */
const TABLES = ['profiles', 'bookings', 'materials', 'documents', 'requests', 'reviews', 'site_content', 'site_posts', 'app_settings'];
const PK = ['profiles' => 'id', 'site_content' => 'key', 'site_posts' => 'slug', 'app_settings' => 'key'];
function pk(string $t): string { return PK[$t] ?? 'id'; }
function tload(string $t): array { $d = readf('t_' . $t, ['next' => 1, 'rows' => []]); $d['rows'] = $d['rows'] ?? []; $d['next'] = $d['next'] ?? 1; return $d; }
function tsave(string $t, array $d): void { writef('t_' . $t, $d); }

/* ---------------- utenti e accesso ---------------- */
function sess(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    @ini_set('session.save_path', DATA . '/sessioni'); if (!is_dir(DATA . '/sessioni')) @mkdir(DATA . '/sessioni', 0700, true);
    @ini_set('session.gc_maxlifetime', '2592000');
    session_name('wzd');
    session_set_cookie_params(['lifetime' => 2592000, 'path' => '/', 'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off', 'httponly' => true, 'samesite' => 'Lax']);
    session_start();
}
function me(): ?array {
    if (!isset($_COOKIE['wzd'])) return null;   // visitatori del sito: nessuna sessione
    sess(); $id = $_SESSION['uid'] ?? null; if (!$id) return null;
    foreach (tload('profiles')['rows'] as $p) if ($p['id'] === $id) return $p;
    return null;
}
function isAdmin(?array $u): bool { return $u && ($u['role'] ?? '') === 'admin'; }
function auths(): array { return readf('auth', []); }                 // email → {uid, hash}
function pubUser(array $p): array { return ['id' => $p['id'], 'email' => $p['email'] ?? '', 'user_metadata' => ['full_name' => $p['full_name'] ?? '']]; }
function session_out(?array $p): array { return $p ? ['user' => pubUser($p), 'access_token' => 'cookie'] : []; }
function login_as(array $p): void { sess(); session_regenerate_id(true); $_SESSION['uid'] = $p['id']; }
function new_user(string $email, string $pw, array $fields, string $role = 'client'): array {
    $email = mb_strtolower(trim($email));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('E-mail non valida.');
    if (mb_strlen($pw) < 8) fail('La password deve avere almeno 8 caratteri.');
    return locked('users', function () use ($email, $pw, $fields, $role) {
        $a = auths(); if (isset($a[$email])) fail('Questa e-mail ha già un accesso.');
        $p = ['id' => uuid(), 'email' => $email, 'full_name' => $fields['full_name'] ?? null, 'phone' => $fields['phone'] ?? null,
              'lang' => $fields['lang'] ?? 'it', 'role' => $role, 'courses' => array_values((array)($fields['courses'] ?? [])), 'created_at' => now()];
        $t = tload('profiles'); $t['rows'][] = $p; tsave('profiles', $t);
        $a[$email] = ['uid' => $p['id'], 'hash' => password_hash($pw, PASSWORD_DEFAULT)]; writef('auth', $a);
        return $p;
    });
}
function set_password(string $uid, string $pw): void {
    if (mb_strlen($pw) < 8) fail('La password deve avere almeno 8 caratteri.');
    locked('users', function () use ($uid, $pw) {
        $a = auths(); foreach ($a as $em => $v) if ($v['uid'] === $uid) { $a[$em]['hash'] = password_hash($pw, PASSWORD_DEFAULT); unset($a[$em]['reset']); }
        writef('auth', $a);
    });
}
function send_mail(string $to, string $subject, string $body, string $replyTo = '', string $replyName = ''): bool {
    $enc = fn($s) => mb_encode_mimeheader($s, 'UTF-8', 'B');
    $h = 'From: ' . $enc('Włoski z Dominiką') . ' <' . MAIL_FROM . ">\r\n";
    if ($replyTo !== '' && filter_var($replyTo, FILTER_VALIDATE_EMAIL)) $h .= 'Reply-To: ' . $enc(str_replace(['"', '<', '>', "\n", "\r"], '', $replyName ?: $replyTo)) . ' <' . $replyTo . ">\r\n";
    $h .= "MIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n";
    return @mail($to, $enc($subject), $body, $h, '-f' . MAIL_FROM);
}

/* ---------------- regole: chi può vedere e cambiare cosa ---------------- */
function can_see(string $t, array $r, ?array $u): bool {
    if (isAdmin($u)) return true;
    switch ($t) {
        case 'site_content': return true;
        case 'site_posts':   return !in_array(($r['data']['draft'] ?? false), [true, 'true', 'True'], true);
        case 'reviews':      return !empty($r['approved']);
        case 'profiles':     return $u && $r['id'] === $u['id'];
        case 'bookings':     return $u && ($r['user_id'] ?? '') === $u['id'];
        case 'documents':    return $u && ($r['user_id'] ?? '') === $u['id'] && !empty($r['visible']);
        case 'materials':
            if (!$u || empty($r['published'])) return false;
            if (!empty($r['student_id'])) return $r['student_id'] === $u['id'];
            return in_array($r['course'] ?? '', (array)($u['courses'] ?? []), true);
    }
    return false;
}
function cut($v, int $n) { return $v === null ? null : mb_substr(trim((string)$v), 0, $n); }
/* nuova riga: cosa può scrivere chi non è Dominika */
function prepare_insert(string $t, array $v, ?array $u): array {
    if (isAdmin($u)) return $v;
    switch ($t) {
        case 'requests':
            throttle('req', 8, 600);
            $o = ['name' => cut($v['name'] ?? '', 120), 'email' => cut($v['email'] ?? null, 200), 'phone' => cut($v['phone'] ?? null, 40),
                  'topic' => cut($v['topic'] ?? null, 120), 'message' => cut($v['message'] ?? null, 5000), 'lang' => cut($v['lang'] ?? null, 5),
                  'page' => cut($v['page'] ?? null, 300), 'status' => 'new', 'note' => null];
            if ($o['name'] === '' || (!$o['email'] && strlen(preg_replace('/\D/', '', (string)$o['phone'])) < 6)) fail('Inserisci il nome e almeno un\'e-mail o un telefono.');
            if ($o['email'] && !filter_var($o['email'], FILTER_VALIDATE_EMAIL)) fail('E-mail non valida.');
            return $o;
        case 'reviews':
            throttle('rev', 5, 3600);
            $o = ['name' => cut($v['name'] ?? '', 80), 'country' => cut($v['country'] ?? null, 2), 'rating' => max(1, min(5, (int)($v['rating'] ?? 5))),
                  'topic' => cut($v['topic'] ?? null, 20), 'body' => cut($v['body'] ?? '', 2000), 'lang' => cut($v['lang'] ?? null, 5),
                  'source' => 'site', 'email' => cut($v['email'] ?? null, 200), 'approved' => false];
            if ($o['name'] === '' || mb_strlen($o['body']) < 5) fail('Scrivi il nome e la recensione.');
            return $o;
        case 'bookings':
            if (!$u) fail('Accedi per prenotare.', 401);
            return ['user_id' => $u['id'], 'kind' => cut($v['kind'] ?? 'other', 20), 'item' => cut($v['item'] ?? null, 200), 'mode' => cut($v['mode'] ?? null, 20),
                    'date_from' => cut($v['date_from'] ?? null, 10), 'date_to' => cut($v['date_to'] ?? null, 10), 'people' => max(1, min(99, (int)($v['people'] ?? 1))),
                    'notes' => cut($v['notes'] ?? null, 2000), 'status' => 'pending', 'paid' => false];
    }
    fail('Operazione non permessa.', 403);
}
function prepare_update(string $t, array $row, array $v, ?array $u): array {
    if (isAdmin($u)) return $v;
    if ($t === 'profiles' && $u && $row['id'] === $u['id'])
        return array_intersect_key($v, array_flip(['full_name', 'phone', 'lang']));
    if ($t === 'bookings' && $u && ($row['user_id'] ?? '') === $u['id'] && ($v['status'] ?? '') === 'cancelled' && count($v) === 1)
        return ['status' => 'cancelled'];
    fail('Operazione non permessa.', 403);
}

/* ---------------- filtri come in Supabase ---------------- */
function cmpv($a, $b): int {
    if (is_bool($a) || is_bool($b)) return ((bool)$a) <=> ((bool)$b);
    if (is_numeric($a) && is_numeric($b)) return $a + 0 <=> $b + 0;
    return strcmp((string)$a, (string)$b);
}
function match_row(array $r, array $filters): bool {
    foreach ($filters as [$col, $op, $val]) {
        $x = $r[$col] ?? null;
        switch ($op) {
            case 'eq':  if ($x === null || cmpv($x, $val) !== 0) return false; break;
            case 'neq': if ($x !== null && cmpv($x, $val) === 0) return false; break;
            case 'gt':  if ($x === null || cmpv($x, $val) <= 0) return false; break;
            case 'gte': if ($x === null || cmpv($x, $val) < 0) return false; break;
            case 'lt':  if ($x === null || cmpv($x, $val) >= 0) return false; break;
            case 'lte': if ($x === null || cmpv($x, $val) > 0) return false; break;
            case 'in':  $ok = false; foreach ((array)$val as $w) if ($x !== null && cmpv($x, $w) === 0) $ok = true; if (!$ok) return false; break;
            case 'is':  if ($val === null ? $x !== null : $x !== $val) return false; break;
            default: fail('Filtro non supportato: ' . $op);
        }
    }
    return true;
}
function apply_order(array $rows, array $order): array {
    if (!$order) return $rows;
    usort($rows, function ($a, $b) use ($order) {
        foreach ($order as $o) {
            $c = $o[0]; $asc = $o[1] ?? true; $nf = $o[2] ?? !$asc;
            $x = $a[$c] ?? null; $y = $b[$c] ?? null;
            if ($x === null && $y === null) continue;
            if ($x === null) return $nf ? -1 : 1;
            if ($y === null) return $nf ? 1 : -1;
            $r = cmpv($x, $y); if ($r) return $asc ? $r : -$r;
        }
        return 0;
    });
    return $rows;
}
function project(array $rows, string $sel, string $t): array {
    $sel = trim($sel ?: '*');
    $join = null;
    if (preg_match('/profiles\(([^)]*)\)/', $sel, $m)) { $join = array_map('trim', explode(',', $m[1])); $sel = trim(preg_replace('/,?\s*profiles\([^)]*\)/', '', $sel), " ,"); }
    $cols = ($sel === '' || $sel === '*') ? null : array_map('trim', explode(',', $sel));
    $profiles = $join ? array_column(tload('profiles')['rows'], null, 'id') : [];
    return array_map(function ($r) use ($cols, $join, $profiles) {
        $o = $cols ? array_intersect_key($r, array_flip($cols)) : $r;
        if ($cols) foreach ($cols as $c) if (!array_key_exists($c, $o)) $o[$c] = null;
        if ($join) { $p = $profiles[$r['user_id'] ?? ''] ?? null; $o['profiles'] = $p ? array_intersect_key($p, array_flip($join)) : null; }
        return $o;
    }, $rows);
}

/* ---------------- visite (un file per mese, si aggiunge una riga per volta) ---------------- */
function visit_file(string $ym): string { return DATA . '/visite/' . $ym . '.php'; }
function visit_append(array $row): void {
    $f = visit_file(gmdate('Y-m'));
    $new = !is_file($f);
    $h = fopen($f, 'a'); flock($h, LOCK_EX);
    if ($new) fwrite($h, GUARD);
    fwrite($h, json_encode($row, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n");
    flock($h, LOCK_UN); fclose($h);
}
function visits_since(string $since): array {
    $rows = []; $dur = [];
    $start = strtotime(substr($since, 0, 7) . '-01') ?: strtotime('-1 year');
    for ($m = $start; $m <= time(); $m = strtotime('+1 month', $m)) {
        $f = visit_file(gmdate('Y-m', $m)); if (!is_file($f)) continue;
        foreach (file($f, FILE_IGNORE_NEW_LINES) as $line) {
            if ($line === '' || $line[0] !== '{') continue;
            $r = json_decode($line, true); if (!$r) continue;
            if (isset($r['_dur'])) { $dur[$r['_dur']] = $r['s']; continue; }
            if (($r['created_at'] ?? '') < $since) continue;
            $rows[] = $r;
        }
    }
    foreach ($rows as &$r) if (!empty($r['vid']) && isset($dur[$r['vid']])) $r['duration_s'] = $dur[$r['vid']];
    return $rows;
}
/* città e Paese dall'indirizzo internet (l'indirizzo NON viene salvato) */
function geo(string $ip): array {
    if ($ip === '' || preg_match('/^(127\.|10\.|192\.168\.|::1)/', $ip)) return [];
    $key = substr(hash('sha256', $ip . cfg()['secret']), 0, 24);
    $cache = readf('geo_cache', []);
    if (isset($cache[$key]) && $cache[$key]['t'] > time() - 30 * 86400) return $cache[$key]['g'];
    $tok = setting('geo_key');
    $url = 'https://ipapi.co/' . rawurlencode($ip) . '/json/' . ($tok !== '' ? '?key=' . rawurlencode($tok) : '');
    $ctx = stream_context_create(['http' => ['timeout' => 3, 'header' => "User-Agent: wloskizdominika.com\r\n", 'ignore_errors' => true]]);
    $j = json_decode((string)@file_get_contents($url, false, $ctx), true);
    $g = [];
    if (is_array($j) && empty($j['error'])) $g = ['city' => cut($j['city'] ?? null, 80), 'region' => cut($j['region'] ?? null, 80), 'country' => cut($j['country_code'] ?? $j['country'] ?? null, 2)];
    locked('geo', function () use ($key, $g) { $c = readf('geo_cache', []); if (count($c) > 20000) $c = array_slice($c, -10000, null, true); $c[$key] = ['t' => time(), 'g' => $g]; writef('geo_cache', $c); });
    return $g;
}

/* ---------------- file caricati ---------------- */
function safe_path(string $p): string {
    $p = str_replace('\\', '/', $p);
    $parts = array_filter(explode('/', $p), fn($x) => $x !== '' && $x !== '.' && $x !== '..');
    $p = implode('/', array_map(fn($x) => preg_replace('/[^A-Za-z0-9._@-]/', '_', $x), $parts));
    if ($p === '' || preg_match('/\.(php\d?|phtml|phar|htaccess|cgi|pl|py|sh)$/i', $p)) fail('Nome di file non permesso.');
    return $p;
}
function bucket_dir(string $b): string {
    if ($b === 'site') return __DIR__ . '/../media/up';
    if (in_array($b, ['materials', 'documents'], true)) return DATA . '/files/' . $b;
    fail('Cartella sconosciuta.');
}
function sign(string $b, string $p, int $exp): string { return hash_hmac('sha256', "$b|$p|$exp", cfg()['secret']); }
function can_file(string $b, string $p, ?array $u): bool {
    if (isAdmin($u)) return true;
    if (!$u) return false;
    $t = $b === 'materials' ? 'materials' : 'documents';
    foreach (tload($t)['rows'] as $r) if (($r['file_path'] ?? '') === $p && can_see($t, $r, $u)) return true;
    return false;
}

/* ---------------- traduzioni (DeepL) ---------------- */
function deepl(array $texts, string $target, string $source = 'IT'): array {
    $key = setting('deepl_key'); if ($key === '') fail('Manca la chiave DeepL: inseriscila in ⚙️ Impostazioni dell\'app.');
    $host = str_ends_with($key, ':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
    $map = ['de' => 'DE', 'en' => 'EN-GB', 'pl' => 'PL', 'es' => 'ES', 'it' => 'IT'];
    $body = json_encode(['text' => array_values($texts), 'target_lang' => $map[$target] ?? strtoupper($target), 'source_lang' => strtoupper($source), 'preserve_formatting' => true]);
    $ch = curl_init($host . '/v2/translate');
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $body, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 30,
        CURLOPT_HTTPHEADER => ['Authorization: DeepL-Auth-Key ' . $key, 'Content-Type: application/json']]);
    $res = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
    $j = json_decode((string)$res, true);
    if ($code !== 200 || !isset($j['translations'])) fail($code === 403 ? 'Chiave DeepL non valida.' : ($code === 456 ? 'Hai finito i caratteri DeepL di questo mese.' : 'Traduzione non riuscita (DeepL ' . $code . ').'));
    return array_map(fn($x) => $x['text'], $j['translations']);
}

/* ===================================================================== */
boot();
$in = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($in)) $in = $_POST;
$a = (string)($in['a'] ?? $_GET['a'] ?? '');

/* file privato con link firmato (si apre nel browser) */
if ($a === 'file') {
    $b = (string)($_GET['b'] ?? ''); $p = safe_path((string)($_GET['p'] ?? '')); $e = (int)($_GET['e'] ?? 0); $s = (string)($_GET['s'] ?? '');
    if ($e < time() || !hash_equals(sign($b, $p, $e), $s)) { http_response_code(403); exit('Link scaduto: riaprilo dall\'app.'); }
    $f = bucket_dir($b) . '/' . $p; if (!is_file($f)) { http_response_code(404); exit('File non trovato.'); }
    $mime = (function_exists('mime_content_type') ? @mime_content_type($f) : '') ?: 'application/octet-stream';
    header_remove('Content-Type'); header('Content-Type: ' . $mime); header('Content-Length: ' . filesize($f));
    header('Content-Disposition: inline; filename="' . str_replace('"', '', basename($p)) . '"');
    readfile($f); exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Usa POST.', 405);
$u = in_array($a, ['visit', 'visit_dur'], true) ? null : me();

switch ($a) {

/* ---------- accesso ---------- */
case 'session': out(['session' => $u ? session_out($u) : null, 'setup' => !array_filter(tload('profiles')['rows'], fn($p) => ($p['role'] ?? '') === 'admin')]);

case 'setup': {  // primo avvio: crea l'accesso di Dominika (serve il codice del file dati/config.php)
    throttle('setup', 5, 900);
    $c = cfg();
    if (array_filter(tload('profiles')['rows'], fn($p) => ($p['role'] ?? '') === 'admin')) fail('L\'accesso è già stato creato.');
    if (empty($c['setup_code']) || !hash_equals((string)$c['setup_code'], trim((string)($in['code'] ?? '')))) fail('Codice di attivazione sbagliato.');
    $p = new_user((string)($in['email'] ?? ''), (string)($in['password'] ?? ''), ['full_name' => 'Dominika'], 'admin');
    login_as($p); out(['session' => session_out($p)]);
}
case 'login': {
    throttle('login', 10, 900);
    $email = mb_strtolower(trim((string)($in['email'] ?? ''))); $pw = (string)($in['password'] ?? '');
    $rec = auths()[$email] ?? null;
    if (!$rec || !password_verify($pw, $rec['hash'])) fail('Invalid login credentials', 400);
    foreach (tload('profiles')['rows'] as $p) if ($p['id'] === $rec['uid']) { login_as($p); out(['session' => session_out($p), 'user' => pubUser($p)]); }
    fail('Invalid login credentials', 400);
}
case 'signup': {
    throttle('signup', 5, 3600);
    $m = (array)($in['data'] ?? []);
    $p = new_user((string)($in['email'] ?? ''), (string)($in['password'] ?? ''), ['full_name' => cut($m['full_name'] ?? null, 120), 'phone' => cut($m['phone'] ?? null, 40), 'lang' => cut($m['lang'] ?? 'it', 5)]);
    login_as($p); out(['session' => session_out($p), 'user' => pubUser($p)]);
}
case 'logout': sess(); $_SESSION = []; session_destroy(); out(true);
case 'reset_request': {
    throttle('reset', 5, 3600);
    $email = mb_strtolower(trim((string)($in['email'] ?? '')));
    $back = (string)($in['redirect'] ?? '/area.html'); if (!preg_match('#^/[A-Za-z0-9/._-]*$#', $back)) $back = '/area.html';
    locked('users', function () use ($email, $back) {
        $a = auths(); if (!isset($a[$email])) return;
        $tok = bin2hex(random_bytes(24)); $a[$email]['reset'] = ['h' => hash('sha256', $tok), 'exp' => time() + 3600]; writef('auth', $a);
        send_mail($email, 'Nuova password – Włoski z Dominiką',
            "Ciao!\n\nPer scegliere una nuova password apri questo link (vale 1 ora):\n" . SITE_URL . $back . '?reset=' . $tok .
            "\n\nSe non l'hai chiesto tu, ignora questa e-mail.\n\nWłoski z Dominiką");
    });
    out(true);  // stessa risposta anche se l'e-mail non esiste
}
case 'reset_login': {
    throttle('reset', 10, 3600);
    $h = hash('sha256', (string)($in['token'] ?? ''));
    $uid = locked('users', function () use ($h) {
        $a = auths(); foreach ($a as $em => $v) if (!empty($v['reset']) && hash_equals($v['reset']['h'], $h) && $v['reset']['exp'] > time()) { $a[$em]['reset']['exp'] = time() + 900; writef('auth', $a); return $v['uid']; }
        return null;
    });
    if (!$uid) fail('Il link è scaduto: chiedi di nuovo «Password dimenticata».');
    foreach (tload('profiles')['rows'] as $p) if ($p['id'] === $uid) { login_as($p); $_SESSION['recovery'] = true; out(['session' => session_out($p)]); }
    fail('Utente non trovato.');
}
case 'update_password': if (!$u) fail('Accedi di nuovo.', 401); set_password($u['id'], (string)($in['password'] ?? '')); unset($_SESSION['recovery']); out(['user' => pubUser($u)]);

/* ---------- tabelle ---------- */
case 'db': {
    $t = (string)($in['table'] ?? ''); $op = (string)($in['op'] ?? 'select');
    if (!in_array($t, TABLES, true)) fail('Tabella sconosciuta: ' . $t);
    $filters = array_map(fn($f) => [(string)$f[0], (string)$f[1], $f[2] ?? null], (array)($in['filters'] ?? []));
    $order = (array)($in['order'] ?? []); $limit = isset($in['limit']) ? (int)$in['limit'] : null;
    $pkc = pk($t);

    if ($op === 'select') {
        $rows = array_values(array_filter(tload($t)['rows'], fn($r) => can_see($t, $r, $u) && match_row($r, $filters)));
        $count = count($rows);
        $rows = apply_order($rows, $order); if ($limit !== null) $rows = array_slice($rows, 0, $limit);
        if (!empty($in['head'])) out(null, null, ['count' => $count]);
        out(project($rows, (string)($in['select'] ?? '*'), $t), null, ['count' => $count]);
    }
    $res = locked('t_' . $t, function () use ($t, $op, $in, $u, $filters, $pkc) {
        $d = tload($t); $changed = []; $vals = $in['values'] ?? [];
        if ($op === 'insert' || $op === 'upsert') {
            $list = (is_array($vals) && array_is_list($vals)) ? $vals : [$vals];
            foreach ($list as $v) {
                $v = (array)$v;
                if ($op === 'upsert' && isset($v[$pkc])) {
                    $i = null; foreach ($d['rows'] as $k => $r) if (cmpv($r[$pkc] ?? null, $v[$pkc]) === 0) { $i = $k; break; }
                    if ($i !== null) { if (!empty($in['ignoreDuplicates'])) continue; if (!isAdmin($u)) fail('Operazione non permessa.', 403);
                        $d['rows'][$i] = array_merge($d['rows'][$i], $v); $changed[] = $d['rows'][$i]; continue; }
                }
                if ($op === 'upsert' && !isAdmin($u)) fail('Operazione non permessa.', 403);
                $v = prepare_insert($t, $v, $u);
                if (!isset(PK[$t])) { $v['id'] = $d['next']++; }
                elseif (empty($v[$pkc])) fail('Manca ' . $pkc);
                else foreach ($d['rows'] as $r) if (cmpv($r[$pkc] ?? null, $v[$pkc]) === 0) fail('Esiste già.');
                $v['created_at'] = $v['created_at'] ?? now();
                $d['rows'][] = $v; $changed[] = $v;
            }
        } elseif ($op === 'update') {
            foreach ($d['rows'] as $k => $r) if (match_row($r, $filters)) {
                if (!can_see($t, $r, $u) && !isAdmin($u)) continue;
                $upd = prepare_update($t, $r, (array)$vals, $u); unset($upd[$pkc]);
                $d['rows'][$k] = array_merge($r, $upd); $changed[] = $d['rows'][$k];
            }
        } elseif ($op === 'delete') {
            if (!isAdmin($u)) fail('Operazione non permessa.', 403);
            if (!$filters) fail('Manca il filtro.');
            $keep = []; foreach ($d['rows'] as $r) { if (match_row($r, $filters)) $changed[] = $r; else $keep[] = $r; } $d['rows'] = $keep;
            if ($t === 'profiles') locked('users', function () use ($changed) { $a = auths(); foreach ($changed as $c) foreach ($a as $em => $v) if ($v['uid'] === $c['id']) unset($a[$em]); writef('auth', $a); });
        } else fail('Operazione sconosciuta.');
        tsave($t, $d);
        return $changed;
    });
    if ($t === 'requests' && $op === 'insert') foreach ($res as $r) notify_request($r);
    if ($t === 'reviews' && $op === 'insert' && !isAdmin($u)) foreach ($res as $r) send_mail(NOTIFY_TO, 'Nuova recensione da approvare – ' . $r['name'], "{$r['name']} ha lasciato una recensione (" . str_repeat('★', (int)$r['rating']) . "):\n\n{$r['body']}\n\nApprovala nella tua app: " . SITE_URL . "/app/#reviews");
    out(!empty($in['returning']) ? $res : null);
}

/* ---------- funzioni ---------- */
case 'rpc': {
    $fn = (string)($in['fn'] ?? ''); $p = (array)($in['params'] ?? []);
    if (!isAdmin($u)) fail('Operazione non permessa.', 403);
    if ($fn === 'admin_create_user') {
        $np = new_user((string)$p['p_email'], (string)$p['p_password'], ['full_name' => $p['p_full_name'] ?? null, 'phone' => $p['p_phone'] ?? null, 'lang' => $p['p_lang'] ?? 'it', 'courses' => $p['p_courses'] ?? []]);
        out($np['id']);
    }
    if ($fn === 'admin_set_password') { set_password((string)$p['p_user'], (string)$p['p_password']); out(true); }
    fail('Funzione sconosciuta.');
}

/* ---------- visite ---------- */
case 'visit': {
    throttle('visit', 120, 3600);
    $v = (array)($in['row'] ?? []);
    $row = ['created_at' => now()];
    foreach (['page' => 200, 'site_lang' => 5, 'browser_lang' => 20, 'country' => 2, 'tz' => 60, 'device' => 10, 'os' => 20, 'browser' => 20, 'source' => 100, 'sid' => 40, 'vid' => 40] as $k => $n)
        $row[$k] = isset($v[$k]) && $v[$k] !== null ? cut($v[$k], $n) : null;
    $row['entry'] = !empty($v['entry']);
    $g = geo(ip());
    if (!empty($g['country'])) $row['country'] = $g['country'];
    $row['city'] = $g['city'] ?? null; $row['region'] = $g['region'] ?? null;
    visit_append($row); out(true);
}
case 'visit_dur': {
    $vid = cut($in['vid'] ?? '', 40); $s = max(0, min(86400, (int)($in['secs'] ?? 0)));
    if ($vid) visit_append(['_dur' => $vid, 's' => $s]);
    out(true);
}
case 'visits': if (!isAdmin($u)) fail('Operazione non permessa.', 403); out(visits_since((string)($in['since'] ?? gmdate('Y-m-d', strtotime('-30 days')))));

/* ---------- file ---------- */
case 'upload': {
    if (!isAdmin($u)) fail('Operazione non permessa.', 403);
    $b = (string)($_POST['bucket'] ?? ''); $p = safe_path((string)($_POST['path'] ?? ''));
    if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) fail('Caricamento non riuscito (file troppo grande?).');
    $dir = bucket_dir($b); $dest = $dir . '/' . $p;
    if (!is_dir(dirname($dest))) mkdir(dirname($dest), 0755, true);
    if (file_exists($dest)) fail('Esiste già un file con questo nome.');
    if (!move_uploaded_file($_FILES['file']['tmp_name'], $dest)) fail('Non riesco a salvare il file.');
    out(['path' => $p]);
}
case 'signed': {
    $b = (string)($in['bucket'] ?? ''); $p = safe_path((string)($in['path'] ?? ''));
    if (!can_file($b, $p, $u)) fail('File non disponibile.', 403);
    $e = time() + max(60, min(86400, (int)($in['expires'] ?? 600)));
    out(['signedUrl' => '/api/db.php?a=file&b=' . rawurlencode($b) . '&p=' . rawurlencode($p) . '&e=' . $e . '&s=' . sign($b, $p, $e)]);
}
case 'remove': {
    if (!isAdmin($u)) fail('Operazione non permessa.', 403);
    $b = (string)($in['bucket'] ?? ''); $dir = bucket_dir($b);
    foreach ((array)($in['paths'] ?? []) as $p) { $f = $dir . '/' . safe_path((string)$p); if (is_file($f)) @unlink($f); }
    out(true);
}

/* ---------- traduzioni ---------- */
case 'translate': {
    if (!isAdmin($u)) fail('Operazione non permessa.', 403);
    $texts = array_map('strval', (array)($in['texts'] ?? [])); $to = (array)($in['to'] ?? ['de', 'en', 'pl', 'es']);
    $src = (string)($in['from'] ?? 'it');
    if (!$texts) out([]);
    if (mb_strlen(implode('', $texts)) > 100000) fail('Testo troppo lungo: traducilo a pezzi.');
    $res = [];
    foreach ($to as $l) { $l = (string)$l; if ($l === $src) continue; $res[$l] = [];
        foreach (array_chunk($texts, 40) as $chunk) $res[$l] = array_merge($res[$l], deepl($chunk, $l, $src)); }
    out($res);
}
case 'settings_status': if (!isAdmin($u)) fail('Operazione non permessa.', 403); out(['deepl' => setting('deepl_key') !== '', 'geo' => setting('geo_key') !== '']);

/* ---------- importazione da Supabase (una volta sola) ---------- */
case 'import': {
    if (!isAdmin($u)) fail('Operazione non permessa.', 403);
    $t = (string)($in['table'] ?? ''); $rows = (array)($in['rows'] ?? []);
    if ($t === 'visits') {   // non copio due volte la stessa visita
        $n = locked('imp_visits', function () use ($rows) { $seen = readf('imp_visits', []); $n = 0;
            foreach ($rows as $r) { $r = (array)$r; $k = (string)($r['id'] ?? ''); if ($k !== '' && isset($seen[$k])) continue; if ($k !== '') $seen[$k] = 1; unset($r['id']); visit_append($r); $n++; }
            writef('imp_visits', $seen); return $n; });
        out($n);
    }
    if (!in_array($t, TABLES, true)) fail('Tabella sconosciuta.');
    $n = locked('t_' . $t, function () use ($t, $rows, $u) {
        $d = tload($t); $pkc = pk($t); $have = array_column($d['rows'], $pkc); $n = 0;
        foreach ($rows as $r) {
            $r = (array)$r;
            if ($t === 'profiles') { if (mb_strtolower((string)($r['email'] ?? '')) === mb_strtolower((string)$u['email'])) continue; }
            if (in_array($r[$pkc] ?? null, $have, true)) continue;
            $d['rows'][] = $r; $n++;
            if (!isset(PK[$t]) && is_numeric($r['id'] ?? null)) $d['next'] = max($d['next'], (int)$r['id'] + 1);
        }
        tsave($t, $d); return $n;
    });
    if ($t === 'profiles') locked('users', function () use ($rows, $u) {   // i clienti avranno una password nuova
        $a = auths(); foreach ($rows as $r) { $r = (array)$r; $em = mb_strtolower((string)($r['email'] ?? '')); if ($em && !isset($a[$em]) && $em !== mb_strtolower((string)$u['email'])) $a[$em] = ['uid' => $r['id'], 'hash' => password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT)]; }
        writef('auth', $a);
    });
    out($n);
}

default: fail('Azione sconosciuta.', 404);
}

/* e-mail a Dominika per ogni richiesta dal sito */
function notify_request(array $r): void {
    $lang = (string)($r['lang'] ?? '');
    $body = "Nuova richiesta da wloskizdominika.com\n"
          . "----------------------------------------\n"
          . 'Argomento: ' . ($r['topic'] ?? '') . "\n"
          . 'Nome: ' . $r['name'] . "\n"
          . (!empty($r['email']) ? 'E-mail: ' . $r['email'] . "\n" : '')
          . (!empty($r['phone']) ? 'Telefono/WhatsApp: ' . $r['phone'] . "\n" : '')
          . 'Lingua scelta dal cliente: ' . (LANG_NAMES[$lang] ?? ($lang ?: '—')) . "\n"
          . (!empty($r['page']) ? 'Pagina: ' . SITE_URL . $r['page'] . "\n" : '')
          . "\n" . ($r['message'] ?? '') . "\n\n"
          . "----------------------------------------\n"
          . 'La trovi anche nella tua app: ' . SITE_URL . "/app/#requests\n"
          . (!empty($r['email']) ? "Per rispondere basta premere «Rispondi».\n" : '');
    $flag = ['it' => '🇮🇹', 'de' => '🇩🇪', 'en' => '🇬🇧', 'pl' => '🇵🇱', 'es' => '🇪🇸'][$lang] ?? '';
    send_mail(NOTIFY_TO, trim($flag . ' Richiesta dal sito: ' . ($r['topic'] ?: 'messaggio') . ' – ' . $r['name']), $body, (string)($r['email'] ?? ''), (string)$r['name']);
}
