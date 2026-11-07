# /profile.json -> test-profile.json, other paths -> files in C:\out
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:8099/")
$listener.Start()
while ($listener.IsListening) {
    $context = $listener.GetContext()
    $name = [System.IO.Path]::GetFileName($context.Request.Url.AbsolutePath)
    $path = if ($name -eq "profile.json") { "C:\out\test-profile.json" } else { Join-Path "C:\out" $name }
    if ($name -ne "" -and (Test-Path -PathType Leaf $path)) {
        $bytes = [System.IO.File]::ReadAllBytes($path)
        $context.Response.ContentType = if ($path.EndsWith(".json")) { "application/json" } else { "application/octet-stream" }
        $context.Response.ContentLength64 = $bytes.Length
        $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $context.Response.StatusCode = 404
    }
    $context.Response.Close()
}
