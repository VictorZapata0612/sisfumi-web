# Configurar el proyecto de Firebase/GCP correcto
gcloud config set project sisfumi2

Write-Host "Buscando revisiones inactivas (con 0% de tráfico) en us-central1..." -ForegroundColor Cyan

# Obtener todas las revisiones con 0% de tráfico
$revisions = gcloud run revisions list --region=us-central1 --format="value(SERVICE,REVISION)" --filter="trafficPercent=0"

if (-not $revisions) {
    Write-Host "No se encontraron revisiones inactivas para borrar." -ForegroundColor Green
    return
}

foreach ($rev in $revisions) {
    $parts = $rev -split "\s+"
    if ($parts.Length -ge 2) {
        $service = $parts[0]
        $revision = $parts[1]
        
        Write-Host "Eliminando revisión: $revision del servicio $service..." -ForegroundColor Yellow
        gcloud run revisions delete $revision --service=$service --region=us-central1 --quiet
    }
}

Write-Host "¡Limpieza de revisiones completada con éxito!" -ForegroundColor Green