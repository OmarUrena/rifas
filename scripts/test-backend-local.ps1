[CmdletBinding()]
param(
    [string]$PgBin = 'C:/Program Files/PostgreSQL/17/bin',
    [ValidateRange(1024,65535)][int]$Port = 54339,
    [ValidateSet('test:integration','test:catalog','test:checkout','test:orders','test:payments','test:m4','test:m5','test:m6','test:resilience','test:stage4','test:recovery','test:stage4:verify','test:lottery','test:lookup','test:stage5','test:stage6','test:checkout:proxy','test:sales','test:stage7:browser','test:stage7:flows','test:adjustments','test:adjustments:edge')][string]$TestScript = 'test:integration',
    [switch]$PasswordAuthentication
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$workspacePath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$clusterPath = '.tmp/postgres-b1/data'
$logPath = '.tmp/postgres-b1/server.log'
$passwordFile = $null
$testPassword = $null
if ($PasswordAuthentication) {
    $scramDirectory = '.tmp/postgres-b3-scram-' + [guid]::NewGuid().ToString('N')
    $clusterPath = "$scramDirectory/data"
    $logPath = "$scramDirectory/server.log"
    $passwordFile = "$scramDirectory/init-password"
    $testPassword = [guid]::NewGuid().ToString('N')
}
$pgCtl = Join-Path $PgBin 'pg_ctl.exe'
$initDb = Join-Path $PgBin 'initdb.exe'
if (-not (Test-Path -LiteralPath $pgCtl) -or -not (Test-Path -LiteralPath $initDb)) {
    throw 'No se encontro PostgreSQL. Indicar -PgBin con su carpeta bin.'
}

function Invoke-Checked {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Fallo $Program (codigo $LASTEXITCODE)." }
}

$previousDatabaseUrl = [Environment]::GetEnvironmentVariable('TEST_DATABASE_URL', 'Process')
$previousDatabaseSsl = [Environment]::GetEnvironmentVariable('TEST_DATABASE_SSL', 'Process')
$previousNodeEnv = [Environment]::GetEnvironmentVariable('NODE_ENV', 'Process')
$previousPgBin = [Environment]::GetEnvironmentVariable('TEST_PG_BIN', 'Process')
$started = $false
Push-Location -LiteralPath $workspacePath
try {
    New-Item -ItemType Directory -Force (Split-Path -Parent $clusterPath) | Out-Null
    if (-not (Test-Path -LiteralPath (Join-Path $clusterPath 'PG_VERSION'))) {
        if ($PasswordAuthentication) {
            [IO.File]::WriteAllText((Join-Path $workspacePath $passwordFile), $testPassword + "`n")
            Invoke-Checked -Program $initDb -Arguments @('-D',$clusterPath,'-U','demo_test',
                '--auth-host=scram-sha-256','--auth-local=trust','--encoding=UTF8','--locale=C',"--pwfile=$passwordFile")
            Remove-Item -LiteralPath $passwordFile
        } else {
            Invoke-Checked -Program $initDb -Arguments @('-D',$clusterPath,'-U','demo_test',
                '--auth=trust','--encoding=UTF8','--locale=C')
        }
    }
    # Nunca detener una instancia que estuviera iniciada antes de este script.
    & $pgCtl -D $clusterPath status *> $null
    if ($LASTEXITCODE -eq 0) { throw 'La instancia de pruebas ya esta iniciada; no se modifico.' }
    Invoke-Checked -Program $pgCtl -Arguments @('-D',$clusterPath,'-l',$logPath,
        '-o',"-h 127.0.0.1 -p $Port -c timezone=UTC",'-w','start')
    $started = $true
    $testConnection = if ($PasswordAuthentication) { "postgres://demo_test:${testPassword}@127.0.0.1:$Port/postgres" } else { "postgres://demo_test@127.0.0.1:$Port/postgres" }
    [Environment]::SetEnvironmentVariable('TEST_DATABASE_URL', $testConnection, 'Process')
    [Environment]::SetEnvironmentVariable('TEST_DATABASE_SSL', 'false', 'Process')
    [Environment]::SetEnvironmentVariable('NODE_ENV', 'test', 'Process')
    [Environment]::SetEnvironmentVariable('TEST_PG_BIN', $PgBin, 'Process')
    Invoke-Checked -Program 'npm.cmd' -Arguments @('run',$TestScript)
} finally {
    if ($passwordFile -and (Test-Path -LiteralPath $passwordFile)) { Remove-Item -LiteralPath $passwordFile }
    if ($started) {
        & $pgCtl -D $clusterPath -m fast -w stop
        if ($LASTEXITCODE -ne 0) { Write-Warning 'No se pudo detener PostgreSQL temporal; revisar su estado.' }
    }
    [Environment]::SetEnvironmentVariable('TEST_DATABASE_URL', $previousDatabaseUrl, 'Process')
    [Environment]::SetEnvironmentVariable('TEST_DATABASE_SSL', $previousDatabaseSsl, 'Process')
    [Environment]::SetEnvironmentVariable('NODE_ENV', $previousNodeEnv, 'Process')
    [Environment]::SetEnvironmentVariable('TEST_PG_BIN', $previousPgBin, 'Process')
    Pop-Location
}
