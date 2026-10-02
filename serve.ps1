$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
$port = 8766
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Output "SERVING http://localhost:$port/  root=$root"
while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $resp = $ctx.Response
    $path = $req.Url.AbsolutePath
    if ($path -eq "/") { $path = "/index.html" }
    $rel = $path.TrimStart('/') -replace '/', '\'
    $file = Join-Path $root $rel
    if ((Test-Path $file -PathType Leaf) -and $file.StartsWith($root)) {
      $bytes = [System.IO.File]::ReadAllBytes($file)
      if ($file.EndsWith('.css')) { $resp.ContentType = "text/css; charset=utf-8" }
      elseif ($file.EndsWith('.js')) { $resp.ContentType = "application/javascript; charset=utf-8" }
      elseif ($file.EndsWith('.html')) { $resp.ContentType = "text/html; charset=utf-8" }
      else { $resp.ContentType = "application/octet-stream" }
      $resp.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $resp.StatusCode = 404
      $msg = [System.Text.Encoding]::UTF8.GetBytes("Not Found")
      $resp.OutputStream.Write($msg, 0, $msg.Length)
    }
    $resp.Close()
  } catch {
    # ignore per-request errors, keep serving
  }
}
