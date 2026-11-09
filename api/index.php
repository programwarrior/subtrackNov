<?php
declare(strict_types=1);
// Never expose exception messages, SQL, request bodies or configuration values.
ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");

function reply(array $data, int $status = 200): never {
    http_response_code($status);
    echo json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
    exit;
}
function fail(string $message, int $code = 400): never { reply(['error' => $message], $code); }
function query(PDO $db, string $sql, array $args = []): PDOStatement {
    $s = $db->prepare($sql); $s->execute($args); return $s;
}
function uuid(): string {
    $b = random_bytes(16); $b[6] = chr((ord($b[6]) & 15) | 64); $b[8] = chr((ord($b[8]) & 63) | 128);
    $h = bin2hex($b); return substr($h,0,8).'-'.substr($h,8,4).'-'.substr($h,12,4).'-'.substr($h,16,4).'-'.substr($h,20);
}
function body(): array {
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 2000000) fail('Request is too large.', 413);
    $raw = file_get_contents('php://input', false, null, 0, 2000001);
    if ($raw === false || strlen($raw) > 2000000) fail('Request is too large.', 413);
    try { $b = json_decode($raw ?: '{}', true, 64, JSON_THROW_ON_ERROR); }
    catch (JsonException $e) { fail('Invalid JSON.'); }
    if (!is_array($b)) fail('Expected a JSON object.');
    return $b;
}
function valid_date(mixed $date): bool {
    if (!is_string($date) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) return false;
    [$y,$m,$d] = array_map('intval', explode('-', $date)); return checkdate($m,$d,$y);
}
function validate_record(array $r): void {
    if (!is_string($r['id'] ?? null) || !preg_match('/^[a-zA-Z0-9:_-]{1,80}$/', $r['id'])) fail('Invalid record ID.');
    if (!in_array($r['type'] ?? '', ['subscription','payment','price','settings'], true)) fail('Invalid record type.');
    if (strlen(json_encode($r, JSON_THROW_ON_ERROR)) > 30000) fail('Record is too large.');
    if (isset($r['userId']) || isset($r['user_id'])) fail('Record ownership is assigned by the server.');
    if (!empty($r['deletedAt']) && (!is_string($r['deletedAt']) || strtotime($r['deletedAt']) === false)) fail('Invalid deletion timestamp.');
    if ($r['type'] === 'subscription') {
        if (!is_string($r['name'] ?? null) || trim($r['name']) === '' || strlen($r['name']) > 320) fail('A subscription name is required.');
        if (!in_array($r['frequency'] ?? '', ['weekly','monthly','bimonthly','quarterly','semiannual','yearly','custom','once'], true)) fail('Invalid frequency.');
        if (!in_array($r['status'] ?? '', ['active','paused','cancelled'], true)) fail('Invalid status.');
        if ($r['status'] === 'active' && !valid_date($r['nextDate'] ?? null)) fail('An active subscription needs a renewal date.');
        if ($r['frequency'] === 'custom' && (!is_int($r['customInterval'] ?? null) || $r['customInterval'] < 1 || $r['customInterval'] > 3650 || !in_array($r['customUnit'] ?? '', ['days','months'], true))) fail('Invalid custom interval.');
        if (!empty($r['website']) && !preg_match('#^https?://#i', $r['website'])) fail('Website must use HTTP or HTTPS.');
    }
    if (in_array($r['type'], ['subscription','payment','price'], true)) {
        $amount = $r[$r['type'] === 'price' ? 'newAmount' : 'amount'] ?? null;
        if (!is_int($amount) || $amount < 0 || $amount > 1000000000000) fail('Invalid amount.');
        if (!is_string($r['currency'] ?? null) || !preg_match('/^[A-Z]{3}$/', $r['currency'])) fail('Invalid currency.');
    }
    if (in_array($r['type'], ['payment','price'], true)) {
        if (!valid_date($r['date'] ?? null) || !is_string($r['subscriptionId'] ?? null)) fail('History needs a valid date and subscription.');
        if ($r['type'] === 'payment' && !in_array($r['status'] ?? '', ['confirmed','estimated','pending','failed'], true)) fail('Invalid payment status.');
    }
}
function rate_limit(PDO $db, array $config, string $kind, int $limit): void {
    $secret = $config['rate_limit_secret'] ?? '';
    if (strlen($secret) < 32) fail('Account security configuration is incomplete.', 503);
    $bucket = hash_hmac('sha256', $kind.'|'.($_SERVER['REMOTE_ADDR'] ?? '').'|'.intdiv(time(),900), $secret);
    query($db, 'INSERT INTO st_rate_limits(bucket,hits,expires_at) VALUES (?,1,DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 MINUTE)) ON DUPLICATE KEY UPDATE hits=hits+1', [$bucket]);
    if ((int)query($db, 'SELECT hits FROM st_rate_limits WHERE bucket=?', [$bucket])->fetchColumn() > $limit) fail('Too many attempts. Please try again in 15 minutes.', 429);
}
function session_response(PDO $db, array $user): array {
    $token = bin2hex(random_bytes(32));
    query($db, 'INSERT INTO st_sessions(token_hash,user_id,expires_at) VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 30 DAY))', [hash('sha256',$token),$user['id']]);
    return ['token'=>$token,'userId'=>$user['id'],'email'=>$user['email']];
}

try {
    $path = getenv('SUBTRACK_CONFIG_FILE') ?: '';
    if (!$path || !is_file($path)) fail('Backend hosting is not configured yet.', 503);
    $config = require $path;
    if (!is_array($config)) fail('Backend configuration is invalid.', 503);
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin && !hash_equals($config['allowed_origin'] ?? '', $origin)) fail('This application origin is not allowed.', 403);
    if ($origin) { header('Access-Control-Allow-Origin: '.$origin); header('Vary: Origin'); }
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
    if (empty($_SERVER['HTTPS']) || $_SERVER['HTTPS'] === 'off') fail('HTTPS is required.', 400);
    $host = $config['db_host'] ?? 'localhost';
    $options = [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES=>false];
    if (!in_array($host, ['localhost','127.0.0.1','::1'], true)) {
        if (empty($config['db_ssl_ca'])) fail('Remote database TLS configuration is required.', 503);
        $options[PDO::MYSQL_ATTR_SSL_CA] = $config['db_ssl_ca'];
        $options[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = true;
    }
    $db = new PDO('mysql:host='.$host.';port='.($config['db_port'] ?? 3306).';dbname='.$config['db_name'].';charset=utf8mb4', $config['db_user'], $config['db_password'], $options);
    query($db, "SET time_zone = '+00:00'");
    $route = $_GET['route'] ?? '';
    $method = $_SERVER['REQUEST_METHOD'];
    if (!in_array($method, ['GET','POST'], true)) fail('Method not allowed.', 405);
    if ($route === 'health' && $method === 'GET') reply(['ok'=>true,'version'=>1]);
    if ($method !== 'POST' && $route !== 'changes') fail('Method not allowed.', 405);
    $input = $method === 'POST' ? body() : [];
    if (in_array($route, ['login','register','recover','reset'], true)) {
        rate_limit($db,$config,$route,$route==='login'?20:5);
        $email = strtolower(trim((string)($input['email'] ?? '')));
        $password = (string)($input['password'] ?? '');
        if ($route !== 'reset' && (!filter_var($email,FILTER_VALIDATE_EMAIL) || strlen($email)>254)) fail('Enter a valid email address.');
        if (strlen($password)>1024) fail('Password is too long.');
        if ($route === 'register') {
            if (empty($config['allow_registration'])) fail('Registration is not enabled. Contact the app owner.',403);
            if (strlen($password)<12) fail('Use a password with at least 12 characters.');
            $user=['id'=>uuid(),'email'=>$email];
            try { query($db,'INSERT INTO st_users(id,email,password_hash) VALUES (?,?,?)',[$user['id'],$email,password_hash($password,PASSWORD_DEFAULT)]); }
            catch (PDOException $e) { if ($e->getCode()==='23000') fail('Unable to create this account. Try signing in or recovering your password.',409); throw $e; }
            reply(session_response($db,$user),201);
        }
        if ($route === 'login') {
            $user=query($db,'SELECT id,email,password_hash FROM st_users WHERE email=?',[$email])->fetch(PDO::FETCH_ASSOC);
            $dummy='$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.';
            if (!password_verify($password,$user['password_hash'] ?? $dummy) || !$user) fail('Email or password is incorrect.',401);
            if (password_needs_rehash($user['password_hash'],PASSWORD_DEFAULT)) query($db,'UPDATE st_users SET password_hash=? WHERE id=?',[password_hash($password,PASSWORD_DEFAULT),$user['id']]);
            reply(session_response($db,$user));
        }
        if ($route === 'recover') {
            if (empty($config['recovery_enabled']) || !filter_var($config['mail_from'] ?? '',FILTER_VALIDATE_EMAIL)) fail('Password recovery email is not configured yet.',503);
            $user=query($db,'SELECT id FROM st_users WHERE email=?',[$email])->fetch(PDO::FETCH_ASSOC);
            if ($user) {
                $token=bin2hex(random_bytes(32));
                query($db,'DELETE FROM st_recovery WHERE user_id=?',[$user['id']]);
                query($db,'INSERT INTO st_recovery(token_hash,user_id,expires_at) VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 30 MINUTE))',[hash('sha256',$token),$user['id']]);
                $text="You requested a Subtrack password reset.\n\nOpen ".$config['app_url']." and choose Account > Have a recovery token?\n\nYour token: ".$token."\n\nThis single-use token expires in 30 minutes. If you did not request this, ignore this email.";
                if (!mail($email,'Reset your Subtrack password',$text,['From'=>$config['mail_from']])) error_log('Subtrack: recovery email delivery failed.');
            }
            reply(['ok'=>true]);
        }
        if ($route === 'reset') {
            if (strlen($password)<12) fail('Use a password with at least 12 characters.');
            $hash=hash('sha256',(string)($input['token'] ?? ''));
            $db->beginTransaction();
            $recovery=query($db,'SELECT user_id FROM st_recovery WHERE token_hash=? AND expires_at>UTC_TIMESTAMP() FOR UPDATE',[$hash])->fetch(PDO::FETCH_ASSOC);
            if (!$recovery) { $db->rollBack(); fail('This recovery token is invalid or expired.',400); }
            query($db,'UPDATE st_users SET password_hash=? WHERE id=?',[password_hash($password,PASSWORD_DEFAULT),$recovery['user_id']]);
            query($db,'DELETE FROM st_recovery WHERE user_id=?',[$recovery['user_id']]);
            query($db,'DELETE FROM st_sessions WHERE user_id=?',[$recovery['user_id']]);
            $db->commit(); reply(['ok'=>true]);
        }
    }
    $authorization=$_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    if (!preg_match('/^Bearer ([a-f0-9]{64})$/',$authorization,$matches)) fail('Please sign in.',401);
    $tokenHash=hash('sha256',$matches[1]);
    $userId=query($db,'SELECT user_id FROM st_sessions WHERE token_hash=? AND expires_at>UTC_TIMESTAMP()',[$tokenHash])->fetchColumn();
    if (!$userId) fail('Your session expired. Sign in again; local edits are retained.',401);
    if ($route==='logout') { query($db,'DELETE FROM st_sessions WHERE token_hash=?',[$tokenHash]); reply(['ok'=>true]); }
    if ($route==='changes') {
        $cursor=max(0,(int)($_GET['cursor'] ?? 0));
        $rows=query($db,'SELECT sequence_id,payload FROM st_changes WHERE user_id=? AND sequence_id>? ORDER BY sequence_id LIMIT 201',[$userId,$cursor])->fetchAll(PDO::FETCH_ASSOC);
        $hasMore=count($rows)>200; if($hasMore)array_pop($rows);
        $records=[];foreach($rows as $r){$records[]=json_decode($r['payload'],true,64,JSON_THROW_ON_ERROR);$cursor=(int)$r['sequence_id'];}
        reply(['records'=>$records,'cursor'=>$cursor,'hasMore'=>$hasMore]);
    }
    if ($route==='records') {
        $ids=$input['ids'] ?? [];if(!is_array($ids)||count($ids)>400)fail('Invalid record request.');
        $records=[];foreach($ids as $id){if(!is_string($id))fail('Invalid ID.');$row=query($db,'SELECT payload FROM st_records WHERE user_id=? AND id=?',[$userId,$id])->fetchColumn();if($row)$records[]=json_decode($row,true,64,JSON_THROW_ON_ERROR);}
        reply(['records'=>$records]);
    }
    if ($route!=='sync') fail('Route not found.',404);
    $batch=$input['batch'] ?? null;
    if(!is_array($batch)||!is_string($batch['id'] ?? null)||!preg_match('/^[a-zA-Z0-9_-]{1,80}$/',$batch['id'])||!is_array($batch['changes'] ?? null)||count($batch['changes'])<1||count($batch['changes'])>400)fail('Invalid change batch. Empty snapshots cannot replace account data.');
    $ids=[];$incoming=[];
    foreach($batch['changes'] as $change){
        if(!is_array($change)||!is_array($change['record'] ?? null)||!is_int($change['baseVersion'] ?? null)||$change['baseVersion']<0)fail('Invalid change version.');
        $r=$change['record'];validate_record($r);if(isset($ids[$r['id']]))fail('Duplicate record in batch.');$ids[$r['id']]=true;$incoming[$r['id']]=$r;
    }
    $db->beginTransaction();
    // Serializes a user's mutations, including requests from different devices.
    query($db,'SELECT id FROM st_users WHERE id=? FOR UPDATE',[$userId]);
    $prior=query($db,'SELECT response FROM st_batches WHERE user_id=? AND batch_id=?',[$userId,$batch['id']])->fetchColumn();
    if($prior){$db->commit();reply(json_decode($prior,true,64,JSON_THROW_ON_ERROR));}
    $conflicts=[];$old=[];$deleteCount=0;
    foreach($batch['changes'] as $change){
        $r=$change['record'];$row=query($db,'SELECT version,payload,kind FROM st_records WHERE user_id=? AND id=?',[$userId,$r['id']])->fetch(PDO::FETCH_ASSOC);
        $old[$r['id']]=$row?json_decode($row['payload'],true,64,JSON_THROW_ON_ERROR):null;
        if((int)($row['version'] ?? 0)!==$change['baseVersion'])$conflicts[]=['id'=>$r['id'],'remote'=>$old[$r['id']]];
        if($row&&$row['kind']!==$r['type']){$db->rollBack();fail('Record type cannot be changed.');}
        if(!empty($r['deletedAt'])&&empty($old[$r['id']]['deletedAt']))$deleteCount++;
    }
    if($conflicts){$db->rollBack();reply(['error'=>'These records changed on another device. Review the conflict before continuing.','conflicts'=>$conflicts],409);}
    if($deleteCount>5&&($batch['confirmedDeletes'] ?? 0)!==$deleteCount){$db->rollBack();fail('Bulk deletion requires explicit confirmation.',422);}
    foreach($incoming as $r){
        if(in_array($r['type'],['payment','price'],true)){
            $parent=$incoming[$r['subscriptionId']] ?? null;
            if(!$parent){$raw=query($db,'SELECT payload FROM st_records WHERE user_id=? AND id=?',[$userId,$r['subscriptionId']])->fetchColumn();$parent=$raw?json_decode($raw,true):null;}
            if(!$parent||$parent['type']!=='subscription'||$parent['currency']!==$r['currency']){$db->rollBack();fail('History must belong to a subscription in your account with the same currency.',403);}
        }
    }
    $saved=[];
    foreach($batch['changes'] as $change){
        $r=$change['record'];$r['version']=$change['baseVersion']+1;$r['updatedAt']=gmdate('Y-m-d\TH:i:s\Z');
        $json=json_encode($r,JSON_THROW_ON_ERROR);
        query($db,'INSERT INTO st_changes(user_id,record_id,payload) VALUES (?,?,?)',[$userId,$r['id'],$json]);$sequence=(int)$db->lastInsertId();
        query($db,'INSERT INTO st_records(user_id,id,kind,version,payload,sequence_id) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE version=VALUES(version),payload=VALUES(payload),sequence_id=VALUES(sequence_id)',[$userId,$r['id'],$r['type'],$r['version'],$json,$sequence]);
        $saved[]=$r;
    }
    $response=['records'=>$saved];query($db,'INSERT INTO st_batches(user_id,batch_id,response) VALUES (?,?,?)',[$userId,$batch['id'],json_encode($response,JSON_THROW_ON_ERROR)]);
    $db->commit();reply($response);
} catch (Throwable $e) {
    if(isset($db)&&$db->inTransaction())$db->rollBack();
    error_log('Subtrack API failed: '.get_class($e));
    fail('The server could not complete this request. Your local changes are retained.',503);
}
