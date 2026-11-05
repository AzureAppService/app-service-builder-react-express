param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern("^https?://")]
    [string]$BaseUrl
)

$ErrorActionPreference = "Stop"
$base = $BaseUrl.TrimEnd("/")

function Assert-Response {
    param(
        [string]$Path,
        [int]$ExpectedStatus,
        [string]$ExpectedContent
    )

    try {
        $response = Invoke-WebRequest -Uri "$base$Path" -SkipHttpErrorCheck
    }
    catch {
        throw "Request to $Path failed: $($_.Exception.Message)"
    }

    if ($response.StatusCode -ne $ExpectedStatus) {
        throw "$Path returned $($response.StatusCode); expected $ExpectedStatus."
    }

    if ($ExpectedContent -and $response.Content -notmatch [regex]::Escape($ExpectedContent)) {
        throw "$Path did not contain expected content: $ExpectedContent"
    }

    Write-Host "PASS $Path ($ExpectedStatus)"
}

Assert-Response -Path "/" -ExpectedStatus 200 -ExpectedContent "App Service Builder: React + Express sample"
Assert-Response -Path "/products/widget-1" -ExpectedStatus 200 -ExpectedContent "App Service Builder: React + Express sample"
Assert-Response -Path "/unknown-client-route" -ExpectedStatus 200 -ExpectedContent "App Service Builder: React + Express sample"
Assert-Response -Path "/version.json" -ExpectedStatus 200 -ExpectedContent '"app": "app-service-builder-react-express-web"'
Assert-Response -Path "/api/health" -ExpectedStatus 200 -ExpectedContent '"status":"ok"'
Assert-Response -Path "/api/status" -ExpectedStatus 200 -ExpectedContent '"status":"available"'
Assert-Response -Path "/api/version" -ExpectedStatus 200 -ExpectedContent '"app":"app-service-builder-react-express-api"'
Assert-Response -Path "/api/request" -ExpectedStatus 200 -ExpectedContent '"path":"/api/request"'
Assert-Response -Path "/api/missing" -ExpectedStatus 404 -ExpectedContent '"error":"not_found"'

$echo = Invoke-WebRequest -Uri "$base/api/echo" -Method Post `
    -ContentType "application/json" -Body '{"message":"hello"}'
if ($echo.StatusCode -ne 200 -or ($echo.Content | ConvertFrom-Json).received.message -ne "hello") {
    throw "/api/echo did not return HTTP 200 with the expected JSON body."
}
Write-Host "PASS /api/echo (200)"

Write-Host "All full-stack routing checks passed."
