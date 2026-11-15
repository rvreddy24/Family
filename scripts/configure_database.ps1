$ErrorActionPreference = 'Stop'
Write-Host 'FamilyHubs private database setup'
Write-Host 'Enter your Supabase DATABASE password here. It will be hidden and will not be sent to chat.'
$databaseSecret = Read-Host 'Database password' -AsSecureString
$secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($databaseSecret)
try {
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = (Get-Command node).Source
    $startInfo.Arguments = '"' + (Join-Path $PSScriptRoot 'configure_database.js') + '"'
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardInput = $true
    $process = [System.Diagnostics.Process]::Start($startInfo)
    $process.StandardInput.Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer))
    $process.StandardInput.Close()
    $process.WaitForExit()
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer)
    $databaseSecret.Dispose()
}
Read-Host 'Press Enter to close'
