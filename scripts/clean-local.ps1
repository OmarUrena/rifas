[CmdletBinding()]
param([switch]$Apply)

$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$boundary = $workspace + [IO.Path]::DirectorySeparatorChar
$temporary = Join-Path $workspace '.tmp'
$targets = [Collections.Generic.List[string]]::new()

# Explicit disposable categories only. Unknown directories, backups, local storage,
# certificates, installed dependencies and active app builds are preserved.
if (Test-Path -LiteralPath $temporary) {
    foreach ($entry in Get-ChildItem -LiteralPath $temporary -Force) {
        $snapshot = $entry.Name -match '^(m4-(web|login-test|full-development)|playwright-web)-\d+$'
        $cluster = $entry.Name -match '^postgres-b(0|1|[23]-scram-[a-f0-9]{32})$'
        $cache = $entry.Name -in @('npm-cache','frontend-npm-cache','pnpm-cache','node-compile-cache','playwright-browsers')
        $scratch = -not $entry.PSIsContainer -and $entry.Extension -in @('.log','.txt','.ts','.cjs','.mjs','.ps1')
        if ($snapshot -or $cluster -or $cache -or $scratch) { $targets.Add($entry.FullName) }
    }
    $reportDir = Join-Path $temporary 'm6'
    if (Test-Path -LiteralPath $reportDir) {
        foreach ($dump in Get-ChildItem -LiteralPath $reportDir -File -Filter '*.dump') { $targets.Add($dump.FullName) }
    }
}
foreach ($relative in @('.pnpm-store','apps/web/test-results','apps/web/playwright-report','apps/web/tsconfig.tsbuildinfo')) {
    $target = Join-Path $workspace $relative
    if (Test-Path -LiteralPath $target) { $targets.Add($target) }
}

$trackedText = git -C $workspace -c core.quotepath=false ls-files -z
if ($LASTEXITCODE -ne 0) { throw 'No se pudo verificar el inventario de Git.' }
$tracked = @(($trackedText -join "`n").Split([char]0) | Where-Object { $_ -ne '' })
$processes = @(Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='postgres.exe'")
$eligible = [Collections.Generic.List[string]]::new()
foreach ($candidate in $targets) {
    $absolute = [IO.Path]::GetFullPath($candidate)
    if (-not $absolute.StartsWith($boundary,[StringComparison]::OrdinalIgnoreCase)) { throw "Destino fuera del repositorio: $absolute" }
    $relative = $absolute.Substring($boundary.Length).Replace('\','/')
    if (@($tracked | Where-Object { $_ -eq $relative -or $_.StartsWith($relative + '/', [StringComparison]::OrdinalIgnoreCase) }).Count) { throw "Destino contiene archivos versionados: $relative" }
    # Never traverse a junction in a parent path, even when its lexical path is local.
    $parent = [IO.Directory]::GetParent($absolute)
    while ($parent -and $parent.FullName -ne $workspace) {
        if ($parent.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Padre enlazado: $relative" }
        $parent = $parent.Parent
    }
    $active = @($processes | Where-Object {
        $_.CommandLine -and ($_.CommandLine.Replace('\','/').IndexOf($relative,[StringComparison]::OrdinalIgnoreCase) -ge 0)
    }).Count -gt 0
    $pidFile = Join-Path $absolute 'data/postmaster.pid'
    if (Test-Path -LiteralPath $pidFile) {
        $clusterProcess = Get-Process -Id ([int](Get-Content -LiteralPath $pidFile -TotalCount 1)) -ErrorAction SilentlyContinue
        if ($clusterProcess -and $clusterProcess.ProcessName -eq 'postgres') { $active = $true }
    }
    if ($active) { Write-Output "Conservado por proceso activo: $relative"; continue }
    $eligible.Add($absolute)
}
Write-Output "Destinos desechables verificados: $($eligible.Count). Aplicar: $Apply"
if (-not $Apply) { $eligible | ForEach-Object { $_.Substring($boundary.Length) }; return }

$bytes = [long]0
$files = [long]0
foreach ($absolute in $eligible) {
    # Walk without following links. Unlink junctions before recursive removal,
    # especially node_modules links in isolated browser fixtures.
    $pending = [Collections.Generic.Stack[IO.FileSystemInfo]]::new()
    $pending.Push((Get-Item -LiteralPath $absolute -Force))
    while ($pending.Count) {
        $entry = $pending.Pop()
        if (-not $entry.FullName.StartsWith($boundary,[StringComparison]::OrdinalIgnoreCase)) { throw 'Recorrido fuera del repositorio.' }
        if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            if ($entry.Attributes -band [IO.FileAttributes]::Directory) { [IO.Directory]::Delete($entry.FullName) }
            else { Remove-Item -LiteralPath $entry.FullName -Force }
        } elseif ($entry -is [IO.DirectoryInfo]) {
            foreach ($child in $entry.EnumerateFileSystemInfos()) { $pending.Push($child) }
        } else { $files++; $bytes += $entry.Length }
    }
    if (Test-Path -LiteralPath $absolute) { Remove-Item -LiteralPath $absolute -Recurse -Force }
}
Write-Output "Eliminados $($eligible.Count) destinos; $files archivos; $([Math]::Round($bytes / 1GB,2)) GiB de contenido descartable (tamanos logicos)."
