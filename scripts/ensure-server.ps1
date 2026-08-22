$ErrorActionPreference = "Stop"

$healthUrl = "http://127.0.0.1:8789/"
$siteDirectory = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$nodePath = "C:\Program Files\nodejs\node.exe"

try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $healthUrl -TimeoutSec 3
    if ($response.StatusCode -eq 200) {
        exit 0
    }
} catch {
    # The server is not running yet.
}

Start-Process `
    -FilePath $nodePath `
    -ArgumentList @("scripts\preview.mjs", "8789", "0.0.0.0") `
    -WorkingDirectory $siteDirectory `
    -WindowStyle Hidden | Out-Null

for ($attempt = 0; $attempt -lt 10; $attempt++) {
    Start-Sleep -Milliseconds 500
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $healthUrl -TimeoutSec 2
        if ($response.StatusCode -eq 200) {
            exit 0
        }
    } catch {
        # Keep polling while Node starts.
    }
}

throw "The Daily Edition server did not become ready at $healthUrl."
