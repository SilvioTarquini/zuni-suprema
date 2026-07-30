# Capturar screenshots do PDF aberto
[System.Reflection.Assembly]::LoadWithPartialName("System.Windows.Forms") | Out-Null
[System.Reflection.Assembly]::LoadWithPartialName("System.Drawing") | Out-Null

$screenshotDir = "C:\Users\Silvio\Documents\1 - Zuni Suprema\zuni-suprema\screenshots-validacao"
if (-not (Test-Path $screenshotDir)) {
    New-Item -ItemType Directory -Path $screenshotDir -Force | Out-Null
}

Write-Host "`n╔═════════════════════════════════════════════════════════╗"
Write-Host "║  CAPTURA DE SCREENSHOTS DO PDF                         ║"
Write-Host "║  Pressione Space para capturar cada página             ║"
Write-Host "╚═════════════════════════════════════════════════════════╝`n"

# Abrir PDF
$pdfPath = "C:\Users\Silvio\Documents\1 - Zuni Suprema\zuni-suprema\relatorio-juliana-mapa-expandido.pdf"
Start-Process $pdfPath

Write-Host "⏳ Aguardando PDF abrir (5 segundos)..."
Start-Sleep -Seconds 5

# Capturar 4 screenshots
for ($i = 1; $i -le 4; $i++) {
    Write-Host "`n📸 Capturando screenshot $i/4..."
    Write-Host "   Navegue para a página desejada e pressione qualquer tecla..."

    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

    # Capturar tela
    $bitmap = New-Object System.Drawing.Bitmap([System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Width, [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.CopyFromScreen([System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Location, [System.Drawing.Point]::Empty, [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Size)

    $outputPath = "$screenshotDir\screenshot-pagina-$i.png"
    $bitmap.Save($outputPath)
    $graphics.Dispose()
    $bitmap.Dispose()

    Write-Host "   ✅ Salvo: screenshot-pagina-$i.png"
}

Write-Host "`n✨ Screenshots capturadas em: $screenshotDir"
Write-Host "`n🎉 Capturas concluídas!`n"
