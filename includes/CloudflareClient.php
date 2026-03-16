<?php
/**
 * Cloudflare API v4 Client
 * Thin cURL wrapper for DNS zone management (custom domain automation)
 */

class CloudflareApiException extends RuntimeException
{
    public int $cloudflareErrorCode;

    public function __construct(string $message, int $cloudflareErrorCode, int $code = 0, ?\Throwable $previous = null)
    {
        $this->cloudflareErrorCode = $cloudflareErrorCode;
        parent::__construct($message, $code, $previous);
    }
}

class CloudflareClient
{
    private string $apiToken;
    private string $accountId;
    private const BASE_URL = 'https://api.cloudflare.com/client/v4';

    public function __construct(string $apiToken, string $accountId)
    {
        $this->apiToken = $apiToken;
        $this->accountId = $accountId;
    }

    // ─── Public methods ──────────────────────────────────────────

    /**
     * Create a new DNS zone for a domain
     * @return array {id, name_servers, ...}
     */
    public function createZone(string $domain): array
    {
        return $this->request('POST', '/zones', [
            'name' => $domain,
            'account' => ['id' => $this->accountId],
            'type' => 'full',
        ]);
    }

    /**
     * Add a DNS record to a zone
     */
    public function addDnsRecord(string $zoneId, string $type, string $name, string $content, bool $proxied = true): array
    {
        return $this->request('POST', "/zones/{$zoneId}/dns_records", [
            'type' => $type,
            'name' => $name,
            'content' => $content,
            'proxied' => $proxied,
        ]);
    }

    /**
     * Get zone details (check status, nameservers, etc.)
     */
    public function getZone(string $zoneId): array
    {
        return $this->request('GET', "/zones/{$zoneId}");
    }

    /**
     * Delete a zone (cleanup)
     */
    public function deleteZone(string $zoneId): array
    {
        return $this->request('DELETE', "/zones/{$zoneId}");
    }

    /**
     * List zones filtered by domain name (used to find existing zone)
     */
    public function listZones(string $domain): array
    {
        return $this->request('GET', "/zones?name=" . urlencode($domain));
    }

    // ─── Private helpers ─────────────────────────────────────────

    /**
     * Generic cURL + JSON handler for Cloudflare API v4
     */
    private function request(string $method, string $path, ?array $body = null): array
    {
        $url = self::BASE_URL . $path;

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST  => $method,
            CURLOPT_HTTPHEADER     => [
                'Authorization: Bearer ' . $this->apiToken,
                'Content-Type: application/json',
            ],
            CURLOPT_TIMEOUT        => 30,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);

        if ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
        }

        $response = curl_exec($ch);
        $error = curl_error($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

        if ($error) {
            throw new RuntimeException("Cloudflare cURL error: {$error}");
        }

        if ($response === false || $response === '') {
            throw new RuntimeException('Cloudflare returned empty response');
        }

        $decoded = json_decode($response, true);
        if ($decoded === null) {
            throw new RuntimeException('Failed to parse Cloudflare JSON response');
        }

        if (empty($decoded['success'])) {
            $errors = $decoded['errors'] ?? [];
            $errorMessages = array_map(function ($e) {
                return ($e['code'] ?? '?') . ': ' . ($e['message'] ?? 'Unknown error');
            }, $errors);
            $errorCode = $errors[0]['code'] ?? 0;

            throw new CloudflareApiException(
                'Cloudflare API error: ' . implode('; ', $errorMessages),
                (int) $errorCode
            );
        }

        return $decoded['result'];
    }
}
