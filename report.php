<?php
/**
 * LexiCite 360 Autopilot Sync Bridge
 * Drop this file into your cPanel public_html directory.
 * It handles both single citation verifications and full dataset reports.
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $json = file_get_contents('php://input');
    
    if ($json) {
        $data = json_decode($json, true);
        
        if ($data) {
            $timestamp = date('Y-m-d H:i:s');
            $logEntry = "============================================================\n";
            
            if (isset($data['type']) && $data['type'] === 'FULL_DATASET_REPORT') {
                // Batch/Full Dataset Report
                $logEntry .= "TYPE: AUTOMATED FULL DATASET REPORT\n";
                $logEntry .= "TIMESTAMP: $timestamp\n";
                $logEntry .= "JOURNAL COUNT: " . ($data['journalCount'] ?? 0) . "\n";
                $logEntry .= "------------------------------------------------------------\n";
                
                if (isset($data['data']) && is_array($data['data'])) {
                    foreach ($data['data'] as $entry) {
                        $logEntry .= "DOC: " . ($entry['documentTitle'] ?? 'Untitled') . "\n";
                        $logEntry .= "STATS: " . json_encode($entry['stats'] ?? []) . "\n";
                        $logEntry .= "DATE: " . date('Y-m-d H:i:s', ($entry['timestamp'] / 1000)) . "\n\n";
                    }
                }
            } else {
                // Single Entry Report
                $logEntry .= "TYPE: SINGLE VERIFICATION REPORT\n";
                $logEntry .= "TIMESTAMP: $timestamp\n";
                $logEntry .= "DOCUMENT: " . ($data['documentTitle'] ?? 'Untitled') . "\n";
                $logEntry .= "ID: " . ($data['id'] ?? 'N/A') . "\n";
                $logEntry .= "STATS: " . json_encode($data['stats'] ?? []) . "\n";
                $logEntry .= "FINDINGS:\n";
                
                if (isset($data['findings']) && is_array($data['findings'])) {
                    foreach ($data['findings'] as $finding) {
                        $lawArea = ($finding['areaOfLaw'] ?? 'Unspecified');
                        $logEntry .= " - [" . strtoupper($finding['status'] ?? 'UNKNOWN') . "] " . ($finding['text'] ?? 'N/A') . " (" . ($finding['caseName'] ?? 'Unknown Case') . ") | AREA: $lawArea\n";
                    }
                }
            }
            
            $logEntry .= "============================================================\n\n";
            
            // Log to case_study_data.log
            file_put_contents('case_study_data.log', $logEntry, FILE_APPEND | LOCK_EX);
            
            echo json_encode(['status' => 'success', 'message' => 'Automated report synced to server logs.']);
        } else {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Invalid JSON payload.']);
        }
    } else {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'No data received.']);
    }
} else {
    http_response_code(405);
    echo "Method Not Allowed. Use POST to sync report data.";
}
?>