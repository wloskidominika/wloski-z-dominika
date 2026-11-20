<?php
/* Włoski z Dominiką – le richieste del modulo «Scrivimi» arrivano per e-mail a Dominika.
   (Arrivano anche nella sua app, salvate su Supabase dal sito.) */
const DESTINATARIO = 'dominikasloma1998@gmail.com';      // dove arrivano le richieste
const MITTENTE     = 'postmaster@wloskizdominika.com';   // casella del dominio (obbligatoria su Aruba)

header('Content-Type: application/json; charset=utf-8');
header('X-Robots-Tag: noindex');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo '{"ok":false}'; exit; }

$in = json_decode(file_get_contents('php://input'), true);
if (!is_array($in)) { http_response_code(400); echo '{"ok":false}'; exit; }
if (!empty($in['hp'])) { echo '{"ok":true}'; exit; }   // robot

$clean = function ($v, $max) { $v = trim((string)($v ?? '')); $v = str_replace(["\r", "\0"], '', $v); return mb_substr($v, 0, $max); };
$one   = function ($v, $max) use ($clean) { return str_replace("\n", ' ', $clean($v, $max)); };
$name  = $one($in['name'] ?? '', 120);
$email = $one($in['email'] ?? '', 160);
$phone = $one($in['phone'] ?? '', 40);
$topic = $one($in['topic'] ?? '', 160);
$msg   = $clean($in['message'] ?? '', 5000);
$lang  = $one($in['lang'] ?? '', 5);
$page  = $one($in['page'] ?? '', 200);

if ($name === '' || ($email === '' && strlen(preg_replace('/\D/', '', $phone)) < 6)) { http_response_code(422); echo '{"ok":false}'; exit; }
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) { http_response_code(422); echo '{"ok":false}'; exit; }

/* al massimo 5 richieste ogni 10 minuti dallo stesso indirizzo */
$ip   = $_SERVER['REMOTE_ADDR'] ?? '';
$file = sys_get_temp_dir() . '/wzd_' . md5($ip);
$now  = time();
$hits = array_filter(array_map('intval', @file($file) ?: []), function ($t) use ($now) { return $t > $now - 600; });
if (count($hits) >= 5) { http_response_code(429); echo '{"ok":false}'; exit; }
$hits[] = $now; @file_put_contents($file, implode("\n", $hits));

$flags = ['it' => '🇮🇹', 'de' => '🇩🇪', 'en' => '🇬🇧', 'pl' => '🇵🇱', 'es' => '🇪🇸'];
$subject = 'Richiesta dal sito: ' . ($topic !== '' ? $topic : 'messaggio') . ' – ' . $name;
$body = "Nuova richiesta da wloskizdominika.com\n"
      . "----------------------------------------\n"
      . "Argomento: $topic\n"
      . "Nome: $name\n"
      . ($email !== '' ? "E-mail: $email\n" : '')
      . ($phone !== '' ? "Telefono/WhatsApp: $phone\n" : '')
      . ($lang  !== '' ? 'Lingua: ' . ($flags[$lang] ?? '') . " $lang\n" : '')
      . ($page  !== '' ? "Pagina: https://wloskizdominika.com$page\n" : '')
      . "\n$msg\n\n"
      . "----------------------------------------\n"
      . "La trovi anche nella tua app: https://wloskizdominika.com/app/#requests\n"
      . ($email !== '' ? "Per rispondere basta premere «Rispondi».\n" : '');

$enc = function ($s) { return mb_encode_mimeheader($s, 'UTF-8', 'B'); };
$headers = 'From: ' . $enc('Włoski z Dominiką') . ' <' . MITTENTE . ">\r\n"
         . ($email !== '' ? 'Reply-To: ' . $enc(str_replace(['"', '<', '>'], '', $name)) . ' <' . $email . ">\r\n" : '')
         . "MIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n";
$ok = @mail(DESTINATARIO, '=?UTF-8?B?' . base64_encode($subject) . '?=', $body, $headers, '-f' . MITTENTE);
http_response_code($ok ? 200 : 500);
echo json_encode(['ok' => (bool)$ok]);
