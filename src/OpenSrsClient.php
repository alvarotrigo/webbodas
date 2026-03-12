<?php
/**
 * OpenSRS API Client
 * Thin wrapper for the OpenSRS XML API (domain registration)
 * Supports both Horizon sandbox and production endpoints
 */

class OpenSrsClient
{
    private string $username;
    private string $apiKey;
    private string $endpoint;

    /**
     * @param string $username OpenSRS reseller username
     * @param string $apiKey   OpenSRS API key
     * @param bool   $testMode Use Horizon sandbox endpoint
     */
    public function __construct(string $username, string $apiKey, bool $testMode = true)
    {
        $this->username = $username;
        $this->apiKey = $apiKey;
        $this->endpoint = $testMode
            ? 'https://horizon.opensrs.net:55443'
            : 'https://rr-n1-tor.opensrs.net:55443';
    }

    // ─── Public methods ──────────────────────────────────────────

    /**
     * Check if a domain is available
     * Response code 210 = available, 211 = taken
     */
    public function lookupDomain(string $domain): array
    {
        $xml = $this->buildEnvelope('LOOKUP', 'DOMAIN', [
            'domain' => $domain,
        ]);
        return $this->sendRequest($xml);
    }

    /**
     * Get domain name suggestions based on a search query
     */
    public function suggestDomains(string $query, array $tlds = ['.com']): array
    {
        $xml = $this->buildEnvelope('NAME_SUGGEST', 'DOMAIN', [
            'searchstring' => $query,
            'tlds' => $tlds,
            'max_wait_time' => 5,
        ]);
        return $this->sendRequest($xml);
    }

    /**
     * Get registration price for a domain
     */
    public function getPrice(string $domain): array
    {
        $xml = $this->buildEnvelope('GET_PRICE', 'DOMAIN', [
            'domain' => $domain,
            'period' => 1,
        ]);
        return $this->sendRequest($xml);
    }

    /**
     * Register a domain in the sandbox/production
     * Uses the same contact info for all 4 roles (owner/admin/billing/tech)
     */
    public function registerDomain(string $domain, array $contact, int $period = 1): array
    {
        $contactSet = [
            'owner'   => $contact,
            'admin'   => $contact,
            'billing' => $contact,
            'tech'    => $contact,
        ];

        $xml = $this->buildEnvelope('SW_REGISTER', 'DOMAIN', [
            'domain'              => $domain,
            'period'              => $period,
            'reg_username'        => 'wbtest' . substr(md5((string)time()), 0, 6),
            'reg_password'        => 'Wbt3st!' . substr(md5((string)mt_rand()), 0, 8),
            'reg_type'            => 'new',
            'handle'              => 'process',
            'custom_tech_contact' => 0,
            'custom_nameservers'  => 0,
            'contact_set'         => $contactSet,
        ]);
        return $this->sendRequest($xml);
    }

    // ─── Private helpers ─────────────────────────────────────────

    /**
     * OpenSRS signature: md5(md5(xml + key) + key)
     */
    private function computeSignature(string $xml): string
    {
        return md5(md5($xml . $this->apiKey) . $this->apiKey);
    }

    /**
     * Send XML request via cURL
     */
    private function sendRequest(string $xml): array
    {
        $signature = $this->computeSignature($xml);

        $ch = curl_init($this->endpoint);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $xml,
            CURLOPT_HTTPHEADER     => [
                'Content-Type: text/xml',
                'X-Username: ' . $this->username,
                'X-Signature: ' . $signature,
            ],
            CURLOPT_TIMEOUT        => 30,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);

        $response = curl_exec($ch);
        $error = curl_error($ch);
        unset($ch);

        if ($error) {
            throw new RuntimeException("OpenSRS cURL error: {$error}");
        }

        if ($response === false || $response === '') {
            throw new RuntimeException('OpenSRS returned empty response');
        }

        return $this->parseResponse($response);
    }

    /**
     * Build the OPS_envelope XML expected by OpenSRS
     */
    private function buildEnvelope(string $action, string $object, array $attributes): string
    {
        $attrXml = $this->arrayToXml($attributes);

        return '<?xml version="1.0" encoding="UTF-8" standalone="no"?>' . "\n"
            . '<!DOCTYPE OPS_envelope SYSTEM "ops.dtd">' . "\n"
            . '<OPS_envelope>'
            .   '<header><version>0.9</version></header>'
            .   '<body>'
            .     '<data_block>'
            .       '<dt_assoc>'
            .         '<item key="protocol">XCP</item>'
            .         '<item key="action">' . htmlspecialchars($action) . '</item>'
            .         '<item key="object">' . htmlspecialchars($object) . '</item>'
            .         '<item key="attributes">' . $attrXml . '</item>'
            .       '</dt_assoc>'
            .     '</data_block>'
            .   '</body>'
            . '</OPS_envelope>';
    }

    /**
     * Recursively convert PHP array to OpenSRS XML format
     * Associative → <dt_assoc>, numeric → <dt_array>
     */
    private function arrayToXml(array $data): string
    {
        $isAssoc = array_keys($data) !== range(0, count($data) - 1);
        $tag = $isAssoc ? 'dt_assoc' : 'dt_array';
        $xml = "<{$tag}>";

        foreach ($data as $key => $value) {
            if (is_array($value)) {
                $xml .= '<item key="' . htmlspecialchars((string)$key) . '">'
                    . $this->arrayToXml($value)
                    . '</item>';
            } else {
                $xml .= '<item key="' . htmlspecialchars((string)$key) . '">'
                    . htmlspecialchars((string)$value)
                    . '</item>';
            }
        }

        $xml .= "</{$tag}>";
        return $xml;
    }

    /**
     * Parse OpenSRS XML response into a PHP array
     */
    private function parseResponse(string $xml): array
    {
        libxml_use_internal_errors(true);
        $doc = new DOMDocument();
        if (!$doc->loadXML($xml)) {
            throw new RuntimeException('Failed to parse OpenSRS XML response');
        }

        // Find the top-level dt_assoc inside data_block
        $dataBlocks = $doc->getElementsByTagName('data_block');
        if ($dataBlocks->length === 0) {
            throw new RuntimeException('No data_block in OpenSRS response');
        }

        $dtAssoc = $dataBlocks->item(0)->getElementsByTagName('dt_assoc')->item(0);
        if (!$dtAssoc) {
            throw new RuntimeException('No dt_assoc in OpenSRS data_block');
        }

        return $this->parseDtNode($dtAssoc);
    }

    /**
     * Recursively parse a dt_assoc or dt_array DOMElement
     */
    private function parseDtNode(DOMElement $node): array
    {
        $result = [];

        foreach ($node->childNodes as $child) {
            if ($child->nodeType !== XML_ELEMENT_NODE || $child->nodeName !== 'item') {
                continue;
            }

            $key = $child->getAttribute('key');

            // Check for nested dt_assoc or dt_array
            $nested = null;
            foreach ($child->childNodes as $inner) {
                if ($inner->nodeType === XML_ELEMENT_NODE
                    && in_array($inner->nodeName, ['dt_assoc', 'dt_array'], true)) {
                    $nested = $inner;
                    break;
                }
            }

            if ($nested) {
                $result[$key] = $this->parseDtNode($nested);
            } else {
                $result[$key] = trim($child->textContent);
            }
        }

        return $result;
    }
}
