param(
  [Parameter(Mandatory = $true)][string]$CropDir,
  [Parameter(Mandatory = $true)][string]$OutFile,
  [switch]$Resume
)

# Windows OCR runner (PowerShell 5.1 / Windows Runtime).
# Reads prepared PNG crops from $CropDir and writes { "<file>": "<text>" } to $OutFile.
# ASCII only on purpose: PS 5.1 misparses UTF-8 without BOM.

Add-Type -AssemblyName System.Runtime.WindowsRuntime

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and
    $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
  })[0]

function Await($WinRtTask, $ResultType) {
  $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
  $netTask = $asTask.Invoke($null, @($WinRtTask))
  $netTask.Wait(-1) | Out-Null
  $netTask.Result
}

[Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime] | Out-Null

$engine = $null
foreach ($tag in @('ja-JP', 'ja', 'zh-Hans-CN', 'en-US')) {
  try {
    $language = New-Object -TypeName Windows.Globalization.Language -ArgumentList $tag
    $candidate = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($language)
    if ($candidate -ne $null) {
      $engine = $candidate
      break
    }
  } catch {
    # language pack not installed, try the next one
  }
}
if ($engine -eq $null) {
  $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
}
if ($engine -eq $null) {
  Write-Error 'No Windows OCR engine available. Install a Japanese or Chinese OCR language pack.'
  exit 2
}

$results = @{}

# Resume: keep results from a previous interrupted run and skip those crops.
if ($Resume -and (Test-Path $OutFile)) {
  try {
    $existing = Get-Content -Path $OutFile -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach ($p in $existing.PSObject.Properties) {
      $results[$p.Name] = [string]$p.Value
    }
  } catch {
    $results = @{}
  }
}

function Save-Results {
  $json = $results | ConvertTo-Json -Compress
  $utf8 = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($OutFile, $json, $utf8)
}

$files = @(Get-ChildItem -Path $CropDir -Filter '*.png' -File | Where-Object { -not $results.ContainsKey($_.Name) })
$total = $files.Count
$index = 0
try {
  foreach ($file in $files) {
    $index++
    $text = ''
    try {
      $storageFile = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($file.FullName)) ([Windows.Storage.StorageFile])
      $stream = Await ($storageFile.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
      $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
      $bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
      $ocrResult = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
      $text = $ocrResult.Text
      $bitmap.Dispose()
      $stream.Dispose()
    } catch {
      $text = ''
    }
    $results[$file.Name] = $text
    if (($index % 25) -eq 0) {
      Save-Results
      Write-Host "[ocr] $index / $total"
    }
  }
} finally {
  Save-Results
}

Write-Host "[ocr] wrote $($results.Count) results to $OutFile"
