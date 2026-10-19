$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$ollamaCommand = Get-Command ollama -ErrorAction SilentlyContinue

if ($ollamaCommand) {
  $ollama = $ollamaCommand.Source
} else {
  $knownPath = Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'
  if (-not (Test-Path $knownPath)) {
    Write-Error 'Ollama no está instalado. Instálalo desde https://ollama.com/download/windows y vuelve a ejecutar este script.'
  }
  $ollama = $knownPath
}

Write-Host 'Descargando o verificando qwen2.5:7b...' -ForegroundColor Cyan
& $ollama pull qwen2.5:7b

$modelfile = Join-Path $repoRoot 'Modelfile.sisfumi'
if (-not (Test-Path $modelfile)) {
  Write-Error "No se encontró $modelfile."
}

Write-Host 'Construyendo sisfumi-assistant...' -ForegroundColor Cyan
& $ollama create sisfumi-assistant -f $modelfile

Write-Host ''
Write-Host 'Configuración terminada.' -ForegroundColor Green
Write-Host 'Prueba el modelo con: ollama run sisfumi-assistant'